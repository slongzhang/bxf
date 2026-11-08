import {
    headersToObject,
    decodeBytes,
    getCharset,
    toBlob,
    isFunction,
    isObject,
    warnOnce,
} from '../utils/index.js';
import BxfError from './BxfError.js';

/* ------------------------------------------------------------------ *
 * 统一响应层（对齐 @mswjs/interceptors）
 *
 * 引擎边界只流动 WHATWG 标准对象：
 *   请求 RequestSpec -> Request -> 引擎
 *   响应 引擎 -> Response -> 本层
 * 因此这里不再接触 XHR 的 responseText / response、也不需要自己拼
 * status/statusText/headers —— 全部从 Response 读取，解析逻辑只有一份。
 * ------------------------------------------------------------------ */

/** 判断是否为 bxf 响应（onlyData 不再依赖 config 的引用相等） */
export function isBxfResponse(value) {
    return isObject(value) &&
        Object.prototype.hasOwnProperty.call(value, 'data') &&
        Object.prototype.hasOwnProperty.call(value, 'status') &&
        Object.prototype.hasOwnProperty.call(value, 'config');
}

/**
 * BxfResponse 固定 5 字段。对外既不暴露原生 Response 句柄，也不输出 raw 中间产物：
 *   - 普通模式下解析层已消费 body，句柄是空壳（clone() 会抛错），没有使用价值；
 *   - 确实需要原生句柄时用 responseType:'raw'，此时 data 就是未消费的原生 Response，
 *     它的 body 流从 data.body 取；
 *   - 解析前的字节 / 文本不再单独输出 —— 引擎边界已按 msw 方案统一成 WHATWG
 *     Response，早期「按引擎给不同原生句柄」的 raw 失去了存在理由，且与 data
 *     大量重复（text/blob/arraybuffer 下两者本就是同一个值）。
 * 小写 response 只出现在 BxfError 上，表示「被 resolveStatus 拒绝的整包 BxfResponse」。
 */
function makeResponse(response, spec, data) {
    return {
        // 业务数据（两引擎语义完全一致）
        data,
        status: response.status,
        statusText: response.statusText || '',
        headers: headersToObject(response.headers),
        // 与 axios 对齐：成功响应拿到的 config 就是可直接回喂 bxf() 的配置
        config: spec.source || spec,
    };
}

/**
 * 帧级流式读取：只做「UTF-8 解码 + 行尾归一化 + 按空行分帧」。
 *
 * 库不解释帧内字段、不拼接多行 data、不做 JSON.parse —— 一次回调 / 一次累积
 * 恒为一条完整帧原文（注释帧、event/id/retry 帧都在），数据不丢失、内容确定。
 * onStream(frame) 一参；二选一，绝不重复存：
 *   有回调 -> 只逐帧交给调用方，res.data 恒为 []
 *   无回调 -> 只累积帧文本，res.data 为帧数组
 * 未以空行结束的尾帧残留也交给调用方，库不替用户决定丢弃。
 */
async function parseStream(response, spec) {
    const stream = response.body;
    if (!stream || typeof stream.getReader !== 'function') {
        // 不传第 4 参：能力错误没有「已完成解析的 BxfResponse 包装」，
        // err.response 必须恒为 BxfResponse 或 undefined，不能漏出原生句柄。
        throw new BxfError(
            '当前引擎不支持流式响应，请使用 engine="fetch"',
            BxfError.ERR_UNSUPPORTED,
            spec.source || spec,
        );
    }

    const reader = stream.getReader();
    // SSE 规范强制 UTF-8（不允许 charset 覆盖）；流式解码负责跨块多字节
    const decoder = new TextDecoder('utf-8');
    const callback = isFunction(spec.onStream) ? spec.onStream : null;
    const frames = [];

    // 增量分帧。早期写法 `buffer += text` 后对「整份累积缓冲」做 replace()/split()，
    // 每来一块都要重扫一遍历史内容：单帧 20MB（322 块）实测 4.6s、heap +158MB，
    // 复杂度 O(n²)。这里改成片段数组 + 只扫描新增文本，仅在帧闭合时 join 一次，
    // 每块只处理一次，变成 O(n)。
    const segments = [];   // 当前未完成帧的文本片段（已归一化行尾）
    let lastChar = '';      // 片段拼接后的末字符，用于识别跨块的 '\n\n'
    let carry = '';         // 跨块 CRLF 前半的 '\r'
    let started = false;

    const emit = (frame) => {
        if (!frame.trim()) return;
        if (callback) callback(frame);
        else frames.push(frame);
    };
    const pushSegment = (text) => {
        if (!text) return;
        segments.push(text);
        lastChar = text[text.length - 1];
    };
    const takeFrame = () => {
        const frame = segments.join('');
        segments.length = 0;
        lastChar = '';
        return frame;
    };
    /** 丢掉未完成帧末尾一个字符（跨块 '\n\n' 时前一个 '\n' 属于分隔符） */
    const dropLastChar = () => {
        const last = segments[segments.length - 1];
        if (!last) return;
        if (last.length === 1) segments.pop();
        else segments[segments.length - 1] = last.slice(0, -1);
        const tail = segments[segments.length - 1];
        lastChar = tail ? tail[tail.length - 1] : '';
    };

    /** 喂入一段解码后的文本，切出所有完整帧；未闭合的尾部留在 segments */
    const feed = (text) => {
        // 拼上上一块留下的 '\r' 再统一行尾（SSE 三种行尾等价：CRLF / CR / LF -> LF）
        let chunk = carry + text;
        carry = '';
        // 末尾的 \r 可能是跨块 CRLF 的前半：留到下一块，否则会误提前分帧
        if (chunk.endsWith('\r')) {
            carry = '\r';
            chunk = chunk.slice(0, -1);
        }
        chunk = chunk.replace(/\r\n|\r/g, '\n');
        if (!started) {
            started = true;
            if (chunk.charCodeAt(0) === 0xFEFF) chunk = chunk.slice(1);
        }

        // 分隔符 '\n\n' 可能横跨两块：上一块以 \n 结尾、本块以 \n 开头
        if (lastChar === '\n' && chunk.charCodeAt(0) === 10) {
            dropLastChar();
            emit(takeFrame());
            chunk = chunk.slice(1);
        }

        let from = 0;
        while (true) {
            const idx = chunk.indexOf('\n\n', from);
            if (idx < 0) break;
            pushSegment(chunk.slice(from, idx));
            emit(takeFrame());
            from = idx + 2;
        }
        if (from < chunk.length) pushSegment(chunk.slice(from));
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) feed(text);
        }
        // 终刷残留多字节，并把未闭合的尾帧一并交给调用方
        const tail = decoder.decode();
        if (tail) feed(tail);
        const pending = segments.join('') + carry;
        if (pending.trim()) emit(pending);
    } catch (error) {
        try { await reader.cancel(); } catch (e) { /* ignore */ }
        throw error;
    } finally {
        try { reader.releaseLock(); } catch (e) { /* ignore */ }
    }

    return makeResponse(response, spec, frames);
}

/**
 * JSON 文本 -> 值；非法 JSON 保持原字符串（对齐 README FAQ）。
 *
 * 早期写法是 `isJson(text) ? JSON.parse(text) : text`，而 isJson 内部本身
 * 就调了一次 JSON.parse —— 等于把整包 JSON 解析两遍。20MB 响应实测多花
 * 一倍解析耗时、多一份 AST 临时内存。这里只解析一次。
 */
function parseJsonOrText(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        return text;
    }
}

/**
 * 把 WHATWG Response 解析为唯一形态的 BxfResponse。
 * @param {Response} response 引擎产出的标准响应对象
 * @param {object} spec 最终 RequestSpec
 */
export async function normalizeResponse(response, spec) {
    const contentType = response.headers.get('content-type') || '';
    // 用户显式指定的 charset 优先：1688 等页面响应头可能错写 charset=utf-8、字节却是 GBK，
    // 此时必须能靠 config.charset 覆盖，否则 text / auto 都救不了乱码。
    const charset = spec.charset || getCharset(contentType) || 'utf-8';
    const type = spec.responseType;

    // raw：不消费响应体。data 就是原生 WHATWG Response（唯一原生句柄入口），
    //   它的 body 流从 data.body 取，调用方可自行 clone / getReader / 做流中转。
    if (type === 'raw') {
        return makeResponse(response, spec, response);
    }

    // stream：边读边回调
    if (type === 'stream') {
        return await parseStream(response, spec);
    }

    // 二进制类型完全不需要文本。早期实现无条件 `decodeBytes()` 生成整份
    // UTF-16 字符串，20MB 下载会白白多出 20MB+(非 Latin1 时 40MB) 临时内存
    // 与一次全量解码，且 arraybuffer 还会再 slice() 拷贝一份。
    if (type === 'arraybuffer' || type === 'blob') {
        // Response.arrayBuffer() 返回的已是本次解析独占的新缓冲区，直接交给调用方，
        // 不需要 toArrayBuffer() 再 slice() 一次（那会额外复制整包字节）。
        const buffer = await response.arrayBuffer();
        if (type === 'arraybuffer') {
            return makeResponse(response, spec, buffer);
        }
        return makeResponse(response, spec, toBlob(new Uint8Array(buffer), contentType));
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = decodeBytes(bytes, charset);

    switch (type) {
        case 'text':
            return makeResponse(response, spec, text);

        case 'json':
            return makeResponse(response, spec, parseJsonOrText(text));

        case 'document': {
            if (typeof DOMParser === 'undefined') {
                // MV3 Service Worker 没有 DOMParser，明确降级而不是给出两个引擎不同的结果
                warnOnce(
                    'document-unsupported',
                    '当前环境没有 DOMParser，responseType="document" 已降级为字符串。',
                );
                return makeResponse(response, spec, text);
            }
            const mime = /xml/i.test(contentType) ? 'application/xml' : 'text/html';
            try {
                return makeResponse(response, spec, new DOMParser().parseFromString(text, mime));
            } catch (error) {
                // 同上：解析失败不挂原生 Response，保持 err.response 形状唯一
                throw BxfError.from(error, BxfError.ERR_BAD_RESPONSE, spec.source || spec);
            }
        }

        case 'auto':
        default:
            return makeResponse(response, spec, parseJsonOrText(text));
    }
}

export default normalizeResponse;
