import { toHeaders, isObject, FETCH_PROTECTED_KEYS } from '../utils/index.js';
import BxfError from './BxfError.js';

/* ------------------------------------------------------------------ *
 * WHATWG 中间表示层（对齐 @mswjs/interceptors 的思路）
 *
 * msw 把 XHR / fetch / http 的差异全部压进适配器，中间只流动
 * Request / Response（web.ts:54、xml-http-request-controller.ts:875-895、
 * create-response.ts:7-31）。bxf 是主动请求库、且必须保留 XHR 引擎与
 * 原生 API 逃生通道，所以：
 *   - 请求：RequestSpec -> Request，两个引擎都从 Request 读取
 *   - 响应：两个引擎都产出 Response，解析层只认 Response
 *
 * new Response() 有硬限制（status 200-599、204/205/304 不能有 body），
 * 这里按 msw FetchResponse 的做法封装，不能直接裸构造。
 * ------------------------------------------------------------------ */

// 对齐 msw fetch-utils.ts: FetchResponse.STATUS_CODES_WITHOUT_BODY
export const BODYLESS_STATUS = [101, 103, 204, 205, 304];
export const isConfigurableStatus = (status) => status >= 200 && status <= 599;
export const canHaveBody = (status) => !BODYLESS_STATUS.includes(status);

/**
 * 对齐 msw src/utils/get-value-by-symbol.ts。
 * undici 把 Response 的内部状态挂在 Symbol(state) 上，浏览器则没有。
 */
function getValueBySymbol(symbolName, source) {
    const symbol = Object.getOwnPropertySymbols(source)
        .find((item) => item.description === symbolName);
    return symbol ? Reflect.get(source, symbol) : undefined;
}

function toURL(value) {
    if (!value || value === 'about:') return null;
    try { return new URL(value); } catch (e) { return null; }
}

const kUrl = Symbol('kUrl');

/**
 * 对齐 msw FetchResponse.setUrl()（fetch-utils.ts）。
 *
 * `Response.url` / `Response.redirected` 都是只读 getter，`new Response()` 不接受
 * 这两个 init 字段，所以手工构造的 Response 永远是 url=""、redirected=false。
 * msw 的做法是按运行时分两条路补齐：
 *   - undici：往 state.urlList 里 push URL，让原型的 getter 自然推导 url/redirected
 *   - 其它实现：Object.defineProperty 覆盖实例属性，并手动转发给 clone()
 *
 * 这里额外传入 requestUrl（原始请求地址），用于把 redirected 也算对：
 * 只有最终 URL 与原始 URL 不同才算发生过重定向，与 fetch 引擎语义一致。
 */
function setResponseUrl(url, response, requestUrl) {
    const finalUrl = toURL(url);
    if (!finalUrl) return;
    const originUrl = toURL(requestUrl);
    const redirected = Boolean(originUrl && originUrl.href !== finalUrl.href);

    const state = getValueBySymbol('state', response);
    if (state && Array.isArray(state.urlList)) {
        // undici：urlList 长度 > 1 时 redirected 自然为 true，url 取最后一个。
        // 只有原始地址与最终地址不同时才压入两条，否则同址会被误判为重定向。
        if (redirected && originUrl) state.urlList.push(originUrl);
        state.urlList.push(finalUrl);
    } else {
        Object.defineProperty(response, 'url', {
            value: url, enumerable: true, configurable: true, writable: false,
        });
        Object.defineProperty(response, 'redirected', {
            value: redirected, enumerable: true, configurable: true, writable: false,
        });
        // own property 不会随 clone() 传递（msw 源码注释明确指出），包一层转发
        const originalClone = response.clone;
        Object.defineProperty(response, 'clone', {
            value: function clone() {
                const cloned = originalClone.call(this);
                setResponseUrl(url, cloned, requestUrl);
                return cloned;
            },
            enumerable: false, configurable: true, writable: true,
        });
    }

    Object.defineProperty(response, kUrl, { value: url, enumerable: false });
}

/**
 * 引擎的原始结果 -> WHATWG Response。
 * 对齐 msw XMLHttpRequest/utils/create-response.ts：
 *   new FetchResponse(body, { url: request.responseURL, status, statusText, headers })
 */
export function createResponse({
    status = 200, statusText = '', headers, body, url, requestUrl,
}) {
    const safeStatus = isConfigurableStatus(status) ? status : 200;
    const responseBody = canHaveBody(status) ? (body === undefined ? null : body) : null;
    const response = new Response(responseBody, {
        status: safeStatus,
        statusText,
        headers: toHeaders(headers),
    });
    if (url) setResponseUrl(url, response, requestUrl);
    return response;
}

/** RequestSpec 里的 RequestInit 合法字段 */
const INIT_KEYS = [
    'mode', 'cache', 'redirect', 'referrer',
    'referrerPolicy', 'integrity', 'keepalive',
];

/** RequestSpec -> WHATWG Request（引擎统一入参） */
export function createRequest(spec) {
    const init = {
        method: spec.method,
        headers: toHeaders(spec.headers),
        credentials: spec.credentials,
    };
    for (const key of INIT_KEYS) {
        if (spec[key] !== undefined) init[key] = spec[key];
    }
    // 逃生舱先铺，核心字段由 RequestSpec 独占
    if (isObject(spec.fetchOptions)) {
        for (const [key, value] of Object.entries(spec.fetchOptions)) {
            if (!FETCH_PROTECTED_KEYS.includes(key)) init[key] = value;
        }
    }
    if (spec.signal) init.signal = spec.signal;
    if (spec.data !== undefined && !['GET', 'HEAD'].includes(spec.method)) {
        init.body = spec.data;
        if (typeof ReadableStream !== 'undefined' && spec.data instanceof ReadableStream) {
            init.duplex = 'half';
        }
    }

    try {
        return new Request(spec.url, init);
    } catch (error) {
        // 相对地址在无 location 的环境（如某些 Worker）无法直接构造
        if (typeof location === 'object') {
            try {
                return new Request(new URL(spec.url, location.href).href, init);
            } catch (e) { /* fall through */ }
        }
        throw new BxfError(
            `无法构造 Request：${error.message}`,
            BxfError.ERR_INVALID_URL,
            spec.source || spec,
        );
    }
}

/**
 * 从 Request 还原 (url, init) 调用形式。
 * 仅用于 nativeEngine：iframe realm 里的原生 fetch 未必接受主 realm 的
 * Request 实例（brand check），此时改传 url + init，body 用 spec 的原始值。
 */
export function toFetchInit(request, spec) {
    const init = {
        method: request.method,
        headers: new Headers(request.headers),
        credentials: request.credentials,
        signal: request.signal,
    };
    for (const key of INIT_KEYS) {
        if (spec[key] !== undefined) init[key] = spec[key];
    }
    if (isObject(spec.fetchOptions)) {
        for (const [key, value] of Object.entries(spec.fetchOptions)) {
            if (!FETCH_PROTECTED_KEYS.includes(key)) init[key] = value;
        }
    }
    if (spec.data !== undefined && !['GET', 'HEAD'].includes(spec.method)) {
        init.body = spec.data;
        if (typeof ReadableStream !== 'undefined' && spec.data instanceof ReadableStream) {
            init.duplex = 'half';
        }
    }
    return init;
}
