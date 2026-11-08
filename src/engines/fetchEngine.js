import BxfError from '../core/BxfError.js';
import { getRequestEngine } from '../core/dispatchRequest.js';
import { normalizeResponse } from '../core/normalizeResponse.js';
import { toFetchInit } from '../core/httpMessage.js';
import { isFunction } from '../utils/index.js';

/**
 * fetch 适配器：Request -> fetch -> Response。
 * 本引擎不解析响应、不拼装字段，差异全部封在这里。
 */
export const fetchEngine = async function (spec, request) {
    const rawFetch = await getRequestEngine('fetch', spec.nativeEngine);
    if (typeof rawFetch !== 'function') {
        throw new BxfError('当前环境没有可用的 fetch', BxfError.ERR_UNSUPPORTED, spec.source || spec);
    }

    try {
        let response;
        if (spec.nativeEngine) {
            // iframe realm 里的原生 fetch 未必接受主 realm 的 Request 实例，
            // 改传 (url, init)，body 用 spec 的原始值（未被消费）。
            response = await rawFetch.call(globalThis, request.url, toFetchInit(request, spec));
        } else {
            response = await rawFetch.call(globalThis, request);
        }
        return await normalizeResponse(response, spec, request.url);
    } finally {
        // timeout 覆盖到「引擎交出响应」为止：raw 拿到响应头就交出，长流不受影响
        if (isFunction(spec.cleanup)) spec.cleanup();
    }
};

export default fetchEngine;
