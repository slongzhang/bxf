import BxfError from "../core/BxfError";
import { getRequestEngine, responseTypes } from "../core/dispatchRequest";
import { normalizeResponse } from "../core/normalizeResponse"
import { isJson, isObject, blobToText, isFunction } from "../utils";

export const fetchEngine = async function(config) {
    const _request = await getRequestEngine('fetch', config.nativeEngine)
    const url = config.url;
    const opts = {
        method: config.method,
        headers: config.headers,
        signal: config.signal, // fetch中断信号
    }
    
    // 判断是否有请求体
    if (typeof config.data !== 'undefined') {
        opts.body = config.data;
    }

    // 处理原生字段
    if (isObject(config.rawFields)) {
        Object.assign(opts, config.rawFields);
    }

    // 定义统一输出对象
    const reason = {
        config: Object.assign(config, opts),
    };
    
    return _request.call(globalThis, url, opts).then(async response => {
        // 请求成功，清楚定时器
        if (typeof config.cleanup === 'function') {
            config.cleanup();
        }
        reason.status = response.status;
        reason.statusText = response.statusText;
        reason.headers = Object.fromEntries(response.headers.entries());
        // 判断处理响应
        // 判断是否指定响应类型
        const responseType = (
            config.responseType !== "document" &&
            responseTypes[config.responseType]
        )
            ? responseTypes[config.responseType]
            : "text";

        // 特殊 blobText 解析处理
        if (config.responseType === "blobtext") {
            const blob = await response[responseType]();
            reason.raw = blob;

            if (
                response.headers.has("content-type") &&
                /charset\s*=\s*([a-zA-Z\-\d]*);?/i.test(response.headers.get("content-type"))
            ) {
                config.charset = RegExp.$1;
            }

            // reason.data = await blobToText(blob, config.charset)
            return blobToText(blob, config.charset).then(data => {
                reason.data = data;
                return normalizeResponse(reason);
            }).catch(error => {
                return Promise.reject(BxfError.from(error, BxfError.ERR_BAD_RESPONSE, config, void 0, normalizeResponse(reason)));
            })
        }
        else {
            const rawData = await response[responseType]();
            reason.raw = rawData;
            // 判断是否是json字符串
            reason.data = (responseType === "text" && config.responseType !== "text" && isJson(rawData))? JSON.parse(rawData): rawData;

            return normalizeResponse(reason);
        }
    })
}

export default fetchEngine;