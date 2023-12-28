/* xhr请求函数 */
import { isJson, isNumeric, each, isEmpty, getType, blobToText, getCharset, getTimeout } from "../helpers/util"
import { parseHeaders } from "../helpers/headers"
import { createError } from "../core/error";

export const xhr = (config) => {
    return new Promise(async (resolve, reject) => {
        // 发送前回调通知
        if (getType(config.beforeSend) == 'function') {
            let beforeSendRes = config.beforeSend(config);
            if (beforeSendRes instanceof Promise) {
                try {
                    beforeSendRes = await beforeSendRes;
                }catch(err) {}
            }
            if (beforeSendRes === false) {
                return reject(
                    createError(
                        `当前请求,被beforeSend拦截`,
                        config,
                        null,
                        null,
                        null
                    )
                )
            }
        }
        // 解构config, data 如果不传默认认为null, method 不传默认 get, url则是必传参数
        const { data = null, url, method = 'get', headers = {}, responseType, cancelToken } = config

        // responseType
        const responseTypeArr = ['json', 'text', 'arrayBuffer', 'blob', 'blobText'];


        // 实例化 XMLHttpRequest
        const request = new config.engine();

        // 初始化一个请求
        request.open(method.toUpperCase(), url, true);

        // 是否有设置超时
        if (config.hasOwnProperty('timeout') && isNumeric(config.timeout) && config.timeout > 0) {
            request.timeout = getTimeout(config.timeout)
        }
        request.ontimeout = function (e) {
            reject(
                createError(
                    'xhr 响应超时',
                    config,
                    null,
                    request,
                    e
                )
            )
        }
        // 判断用户是否设置了返回数据类型
        if (responseType && responseTypeArr.includes(responseType)) {
            request.responseType = (responseType == 'blobText') ? 'blob' : responseType
        }

        // 监听 onreadystatechange 函数，接收后台返回数据
        request.onreadystatechange = () => {
            if (request.readyState !== 4) {
                return
            }

            if (request.status === 0) {
                return
            }

            // 返回的 header 是字符串类型，通过 parseHeaders 解析成对象类型
            const responseHeaders = parseHeaders(request.getAllResponseHeaders());
            const isResponseString = typeof request.response == 'string';
            const responseData = isResponseString? ((text) => {
                    let data = text
                    if (isJson(text)) {
                        data = JSON.parse(text)
                    } else {
                        if (responseType == 'json') {
                            data = {}
                        }
                    }
                    return data
            })(request.responseText): request.response;
            const result = {
                data: responseData,
                responseText: isResponseString? request.responseText : null,
                status: request.status,
                statusText: request.statusText,
                headers: responseHeaders,
                config,
                xhr: request
            }


            // 响应输出处理
            const responseFinalProcess = () => {
                // 如果状态码在 200-300 之间正常 resolve，否则 reject 错误
                if (result.status >= 200 && result.status < 300) {
                    resolve(config.toDataOnly? result.data :result);
                } else {
                    reject(
                        createError(
                            `Request failed with status code ${result.status}`,
                            config,
                            result.status,
                            request,
                            result
                        )
                    );
                }
            }



            // 通过 resolve 返回数据
            if (responseType == 'blobText') {
                blobToText(responseData, getCharset(config, responseHeaders)).then(text => {
                    let data                
                    if (isJson(text)) {
                        data = JSON.parse(text)
                    } else {
                        if (responseType == 'json') {
                            data = {}
                        }
                    }
                    result.data = data
                    result.responseText = text;
                    responseFinalProcess()
                })
            }
            else {
                responseFinalProcess()
            }
        }

        // 监听错误
        request.onerror = (err) => {
            reject(
                createError(
                    `Network Error`,
                    config,
                    null,
                    request,
                    err
                )
            );
        }

        // 遍历所有处理后的 headers
        each(headers, function (key, item) {
            // 给请求设置上 header
            request.setRequestHeader(key, item)
        })
        // xhr字段设置
        if (config.hasOwnProperty('rawFields') && getType(config.rawFields) === 'object') {
            const banKeys = ['open', 'setRequestHeader', 'send']
            each(config.rawFields, function (key, item) {
                if (!banKeys.includes(key)) {
                    request[key] = item
                }
            })
        }
        // 获取xhr句柄(自定义xhr事件如获取上传进度)
        let isContinue = true;
        if (config.hasOwnProperty('xhr') && getType(config.xhr) == 'function') {
            if (config.xhr(request, config) === false) {
                isContinue = false
            }
        }

        // 判断是否有定义取消请求
        if (cancelToken) {
            cancelToken.promise
                .then((reason) => {
                    request.abort();
                    reject(
                        createError(
                            reason.message,
                            config,
                            null,
                            request
                        )
                    );
                })
                .catch(() => { });
        }
        // 发送请求
        isContinue && request.send(data);
    })
}

export default xhr
