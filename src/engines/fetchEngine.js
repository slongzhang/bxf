import BxfError from "../core/BxfError";
import { getRequestEngine, responseTypes } from "../core/dispatchRequest";
import { normalizeResponse } from "../core/normalizeResponse"
import { isJson, isObject, blobToText, isFunction } from "../utils";

export const fetchEngine = async function (config) {
    const _request = await getRequestEngine('fetch', config.nativeEngine)
    const url = config.url;
    const opts = {
        method: config.method,
        headers: config.headers,
        signal: config.signal, // fetch中断信号
    }

    // 处理原生字段
    if (isObject(config.rawFields)) {
        Object.assign(opts, config.rawFields);
    }

    // 定义统一输出对象
    const reason = {
        config: Object.assign(config, opts),
    };

    // 判断是否有请求体
    if (typeof config.data !== 'undefined') {
        opts.body = config.data;
    }

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
        // 处理流消息
        else if (config.responseType === "stream" && typeof config.onStream === 'function') {
            // 流式读取响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = ''; // 缓存分片，避免消息截断
            const resData = [], resDaw = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // 拼接二进制流为文本
                buffer += decoder.decode(value, { stream: true });

                // SSE 消息分隔符：\n\n
                const chunks = buffer.split('\n\n');
                buffer = chunks.pop() || ''; // 最后一段不完整，留到下次

                // 逐条解析
                for (const chunk of chunks) {
                    if (!chunk.trim()) continue;
                    resDaw.push(chunk);
                    // 提取 data: 内容
                    const match = chunk.match(/^data:\s*(.*)$/m);
                    let msg = '';
                    if (match?.[1]) {
                        msg = match[1];
                        msg = isJson(msg)? JSON.parse(msg): msg;
                        resData.push(msg);
                    }
                    config.onStream(msg, chunk); // 单条消息回调
                }
            }

            reason.raw = resDaw;
            // 判断是否是json字符串
            reason.data = resData;

            return normalizeResponse(reason);
        }
        else if (config.responseType === 'raw') {
            return response;
        }
        else {
            const rawData = await response[responseType]();
            reason.raw = rawData;
            // 判断是否是json字符串
            reason.data = (responseType === "text" && config.responseType !== "text" && isJson(rawData)) ? JSON.parse(rawData) : rawData;

            return normalizeResponse(reason);
        }
    })
}

export default fetchEngine;