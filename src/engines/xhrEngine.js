import BxfError from '../core/BxfError.js';
import { getRequestEngine } from '../core/dispatchRequest.js';
import { normalizeResponse } from '../core/normalizeResponse.js';
import { createResponse } from '../core/httpMessage.js';
import {
    XHR_PROTECTED_KEYS,
    isObject,
    isFunction,
    warnOnce,
} from '../utils/index.js';

/** 把 XHR 的 response 统一成 Uint8Array，作为 Response 的 body */
function toBodyBytes(response) {
    if (response === null || response === undefined) return new Uint8Array(0);
    if (response instanceof ArrayBuffer) return new Uint8Array(response);
    if (ArrayBuffer.isView(response)) {
        return new Uint8Array(response.buffer, response.byteOffset, response.byteLength);
    }
    if (typeof response === 'string') return new TextEncoder().encode(response);
    return new Uint8Array(0);
}

function makeCancelError(spec) {
    return spec.signal && spec.signal.reason !== undefined
        ? spec.signal.reason
        : Object.assign(new Error('Request canceled'), { name: 'AbortError', code: BxfError.ERR_CANCELED });
}

function makeNetworkError() {
    return Object.assign(new Error('Network Error'), {
        name: 'TypeError',
        code: BxfError.ERR_NETWORK,
    });
}

/** XHR 无法表达的 fetch 一等公民能力，明确提示而不是静默忽略 */
function warnUnsupportedCapabilities(spec) {
    const unsupported = [];
    for (const key of ['mode', 'cache', 'referrer', 'referrerPolicy', 'integrity', 'keepalive']) {
        if (spec[key] !== undefined) unsupported.push(key);
    }
    if (spec.redirect && spec.redirect !== 'follow') unsupported.push('redirect');
    if (unsupported.length) {
        warnOnce(
            `xhr-unsupported-${unsupported.join('-')}`,
            `XHR 引擎不支持 ${unsupported.join(', ')}，这些字段已忽略；如需生效请指定 engine="fetch"。`,
        );
    }
}

/**
 * XHR 适配器：Request -> XMLHttpRequest -> Response。
 * 统一用 responseType='arraybuffer' 读原始字节，再构造 WHATWG Response，
 * 因此上层拿到的东西与 fetch 引擎完全一致。
 */
export const xhrEngine = function (spec, request) {
    return new Promise(async (resolve, reject) => {
        let settled = false;
        let xhr = null;

        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            cleanup();
            fn(value);
        };

        const cleanup = () => {
            if (isFunction(spec.cleanup)) spec.cleanup();
            if (request.signal && onAbort) {
                request.signal.removeEventListener('abort', onAbort);
            }
            if (xhr) {
                xhr.onload = null;
                xhr.onerror = null;
                xhr.onabort = null;
                xhr.ontimeout = null;
                xhr.onprogress = null;
                if (xhr.upload) xhr.upload.onprogress = null;
            }
        };

        const onAbort = () => {
            try { if (xhr) xhr.abort(); } catch (e) { /* ignore */ }
            finish(reject, makeCancelError(spec));
        };

        try {
            if (request.signal && request.signal.aborted) {
                return finish(reject, makeCancelError(spec));
            }

            const XHR = await getRequestEngine('xhr', spec.nativeEngine);
            if (typeof XHR !== 'function') {
                return finish(reject, new BxfError(
                    '当前环境没有可用的 XMLHttpRequest',
                    BxfError.ERR_UNSUPPORTED,
                    spec.source || spec,
                ));
            }
            if (settled) return;
            xhr = new XHR();

            warnUnsupportedCapabilities(spec);
            if (request.signal) {
                request.signal.addEventListener('abort', onAbort, { once: true });
            }

            // 全部从 WHATWG Request 读取，不再各自解释 spec
            xhr.open(request.method, request.url, true);

            if (isObject(spec.xhrOptions)) {
                for (const [key, value] of Object.entries(spec.xhrOptions)) {
                    if (XHR_PROTECTED_KEYS.includes(key.toLowerCase())) continue;
                    try { xhr[key] = value; } catch (e) { /* 只读属性 */ }
                }
            }
            xhr.withCredentials = request.credentials === 'include';
            xhr.responseType = 'arraybuffer';
            request.headers.forEach((value, key) => xhr.setRequestHeader(key, value));

            if (isFunction(spec.onUploadProgress) && xhr.upload) {
                xhr.upload.onprogress = spec.onUploadProgress;
            }
            if (isFunction(spec.onDownloadProgress)) {
                xhr.onprogress = spec.onDownloadProgress;
            }

            xhr.onload = () => {
                if (xhr.status === 0) return finish(reject, makeNetworkError());
                // XHR 结果 -> 标准 Response（204/304 等无 body 状态由 createResponse 处理）
                // 对齐 msw create-response.ts 的 `url: request.responseURL`：
                // XHR 会跟随重定向，responseURL 是最终地址；不补齐的话手工构造的
                // Response.url 恒为空串、redirected 恒 false，与 fetch 引擎不一致。
                const response = createResponse({
                    status: xhr.status,
                    statusText: xhr.statusText || '',
                    headers: isFunction(xhr.getAllResponseHeaders) ? xhr.getAllResponseHeaders() : '',
                    body: toBodyBytes(xhr.response),
                    url: xhr.responseURL || request.url,
                    requestUrl: request.url,
                });
                normalizeResponse(response, spec, request.url).then(
                    result => finish(resolve, result),
                    error => finish(reject, error),
                );
            };
            xhr.onerror = () => finish(reject, makeNetworkError());
            xhr.onabort = () => finish(reject, makeCancelError(spec));
            xhr.ontimeout = () => finish(reject, Object.assign(
                new Error('TimeoutError: signal timed out'),
                { name: 'TimeoutError', code: BxfError.ETIMEDOUT },
            ));

            // Request 的 body 只能消费一次；一次性请求体走 fetch 引擎
            let body = null;
            if (request.body) {
                body = new Uint8Array(await request.arrayBuffer());
            }
            xhr.send(body);
        } catch (error) {
            finish(reject, BxfError.from(error, BxfError.ERR_BAD_REQUEST, spec.source || spec));
        }
    });
};

export default xhrEngine;
