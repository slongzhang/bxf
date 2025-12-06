import { isObject } from "../utils";

export function normalizeResponse(res) {
    const { data, raw, status, statusText, headers, config } = isObject(res)? res: {};
    return {
        // 由服务器提供的响应(如果是json字符串或blobText则会进行解码转义，否则等同rawData)
        data
        // 服务端提供的原始响应
        , raw
        // http状态码
        , status
        // http状态描述
        , statusText
        // 响应请求头
        , headers
        // 最终请求配置
        , config
    };
}
