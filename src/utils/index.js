export const HAS_DATA_METHODS = ['post', 'put', 'patch'];
export const NO_DATA_METHODS = ["get", "delete", "head", "options"];

// 获取变量类型
export function getType(checkValue, toLow = true) {
    const typeName = Object.prototype.toString.call(checkValue).slice(8, -1);
    return toLow ? typeName.toLowerCase() : typeName;
}

// 是否字符串
export function isString(checkValue) {
    return getType(checkValue, false) === 'String';
}

// 是否是函数
export function isFunction(checkValue) {
    return getType(checkValue, false) === 'Function';
}

// 是否是对象
export function isObject(checkValue) {
    return getType(checkValue, false) === 'Object';
}

// 是否是json字符串
export function isJson(checkValue, backJson = false) {
    if (typeof checkValue === 'string') {
        try {
            let result = JSON.parse(checkValue);
            return backJson ? result : true;
        } catch (e) { }
    }
    return false;
}

// 是否是数字
export function isNumeric(checkValue, isStrict = false) {
    // 修复数组被当作数字问题['123'] == 123
    if (!['string', 'number'].includes(getType(checkValue)) || checkValue === '') {
        return false;
    }
    return isStrict ? checkValue === checkValue - 0 : checkValue == checkValue - 0;
}

// 是否整形
export function isInt(checkValue, isStrict = false) {
    return isNumeric(checkValue, isStrict) && checkValue % 1 === 0;
}

// 判断是否合法url
export function isUrl(str) {
    let v = new RegExp('^(?!mailto:)(?:(?:http|https|ftp)://|//)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$', 'i');
    return v.test(str)
}

// 判断是否绝对地址
export function isAbsoluteURL(url) {
    return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/**
 * 深度合并多个对象。数组为浅拷贝。
 * 最后一个参数可选传入 `true` 以启用 key 小写转换。
 */
export function deepMerge(...sources) {
    const result = {};
    const last = sources[sources.length - 1];
    const lowerCase = typeof last === 'boolean' ? sources.pop() : false;

    for (const source of sources) {
        if (!isObject(source)) continue;

        for (let key in source) {
            if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

            const rawKey = key;
            key = lowerCase ? key.toString().toLowerCase() : key;

            const val = source[rawKey];
            const existing = result[key];

            if (isObject(val) && isObject(existing)) {
                result[key] = deepMerge(existing, val, lowerCase);
            } else if (Array.isArray(val)) {
                result[key] = val.slice();
            } else if (isObject(val)) {
                result[key] = deepMerge({}, val, lowerCase);
            } else {
                result[key] = val;
            }
        }
    }

    return result;
}

/**
 * 判断 HTTP 状态码是否命中 resolveStatus 规则（左闭右开区间）。
 *
 *   number                -> 精确匹配
 *   [min, max]            -> 区间 [min, max)（必须嵌套在数组里）
 *   Array                 -> 任一项命中，可混合 number / 区间 / function
 *   function              -> (status, response) => boolean
 *
 * 注意：[200, 300] 作为顶层规则表示「200 或 300」两个单一码；
 * 要表达 200..299 区间须写成 [[200, 300]]。
 */
export function matchesHttpStatus(rule, status, response) {
    if (rule === undefined || rule === null) return true;
    const target = Number(status);

    if (typeof rule === 'function') return Boolean(rule(target, response));
    if (typeof rule === 'number') return Number.isFinite(rule) && rule === target;

    if (Array.isArray(rule)) {
        return rule.some((item) => {
            if (Array.isArray(item) && item.length === 2 &&
                typeof item[0] === 'number' && typeof item[1] === 'number') {
                return item[0] <= target && target < item[1];
            }
            if (typeof item === 'function') return Boolean(item(target, response));
            if (typeof item === 'number') return item === target;
            return false;
        });
    }
    return false;
}

/* ------------------------------------------------------------------ *
 * 以下为双引擎统一层专用工具
 * 设计依据：@mswjs/interceptors 用 WHATWG Headers / Request / Response
 * 作为引擎无关的中间表示（web.ts:54、create-response.ts:7-31）。
 * bxf 不拦截请求、且必须保留 XHR 引擎，因此只借 Headers 作为统一载体。
 * ------------------------------------------------------------------ */

/** 引擎专属逃生舱不允许覆盖的核心字段（fetch 侧） */
export const FETCH_PROTECTED_KEYS = [
    'method', 'headers', 'body', 'signal', 'url', 'window',
];

/** 引擎专属逃生舱不允许覆盖的核心字段（xhr 侧，全部小写比较） */
export const XHR_PROTECTED_KEYS = [
    'open', 'send', 'abort', 'setrequestheader', 'getallresponseheaders',
    'getresponseheader', 'onreadystatechange', 'onload', 'onloadend',
    'onerror', 'onabort', 'ontimeout', 'onprogress', 'upload',
    'timeout', 'responsetype', 'response', 'responsetext', 'responsexml',
    'responseurl', 'status', 'statustext', 'readystate', 'withcredentials',
    'method', 'url', 'async', 'user', 'password',
];

/**
 * 把任意来源的请求/响应头统一成 WHATWG Headers 实例。
 * 支持：Headers 实例、普通对象、[key,value][] 数组、XHR 原始头字符串。
 * 重复头用 append 累积，与 fetch 的 Headers 行为完全一致
 * （旧版 XHR 的 parseRawHeaders 是后者覆盖前者，会造成两引擎结果不同）。
 */
export function toHeaders(input) {
    if (typeof Headers === 'undefined') {
        throw new Error('当前环境不支持 Headers，无法使用统一请求层');
    }
    if (input instanceof Headers) return new Headers(input);

    const headers = new Headers();
    if (!input) return headers;

    if (typeof input === 'string') {
        for (const line of input.split(/\r?\n/)) {
            const text = line.trim();
            if (!text) continue;
            const idx = text.indexOf(':');
            if (idx < 1) continue;
            try {
                headers.append(text.slice(0, idx).trim(), text.slice(idx + 1).trim());
            } catch (e) { /* 非法头名直接忽略 */ }
        }
    } else {
        const entries = Array.isArray(input) ? input : (isObject(input) ? Object.entries(input) : []);
        for (const [name, value] of entries) {
            if (value === undefined || value === null) continue;
            try {
                headers.append(String(name), String(value));
            } catch (e) { /* 非法头名直接忽略 */ }
        }
    }
    return headers;
}

/** Headers -> 普通对象。重复头由 Headers 规范合并为 "a, b"，两引擎一致。 */
export function headersToObject(headers) {
    const out = {};
    if (!headers || typeof headers.forEach !== 'function') return out;
    headers.forEach((value, key) => { out[key] = value; });
    return out;
}

/** 从 content-type 中提取字符集 */
export function getCharset(contentType) {
    if (!contentType) return null;
    const matched = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType);
    return matched ? matched[1] : null;
}

/**
 * 字节解码。用 TextDecoder 而非 FileReader：
 * MV3 Service Worker 里没有 FileReader / document，旧版 blobToText 会直接抛错。
 */
export function decodeBytes(bytes, charset) {
    if (bytes === null || bytes === undefined) return '';
    if (typeof bytes === 'string') return bytes;
    const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    try {
        return new TextDecoder(charset || 'utf-8').decode(view);
    } catch (e) {
        return new TextDecoder('utf-8').decode(view);
    }
}

/** Uint8Array -> 独立的 ArrayBuffer 拷贝 */
export function toArrayBuffer(bytes) {
    if (bytes === null || bytes === undefined) return new ArrayBuffer(0);
    if (bytes instanceof ArrayBuffer) return bytes;
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

/** Uint8Array -> Blob */
export function toBlob(bytes, contentType) {
    return new Blob([bytes || new Uint8Array(0)], { type: contentType || '' });
}

/** 拼接流式读取得到的多个 Uint8Array 分片 */
export function concatBytes(chunks) {
    if (!chunks || chunks.length === 0) return new Uint8Array(0);
    if (chunks.length === 1) return new Uint8Array(chunks[0]);
    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return out;
}

/** 只 warn 一次，避免高频请求刷屏 */
const warned = new Set();
export function warnOnce(key, message) {
    if (warned.has(key) || typeof console === 'undefined' || !console.warn) return;
    warned.add(key);
    console.warn(`[bxf] ${message}`);
}
