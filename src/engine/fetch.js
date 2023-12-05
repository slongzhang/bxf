// 浏览器 fetch 请求
import { isJson, isNumeric, each, isEmpty, getType, blobToText, getCharset, getTimeout } from "../helpers/util"
import { createError } from "../core/error";
export const esFetch = async (config) => {
    // 最终请求配置参数
    const options = {}
        , defaultField = {
            method: 'method',
            body: 'data',
            headers: 'headers',
        }
    // 处理超时
    const controller = new AbortController();
    options.signal = controller.signal;
    let abortMsg = '', abortTimer = null;
    if (config.hasOwnProperty('timeout') && isNumeric(config.timeout) && config.timeout > 0) {
        // options.signal = AbortSignal.timeout(getTimeout(config.timeout))
        abortTimer = setTimeout(() => {
            abortMsg = 'signal timed out'
            controller.abort();
        }, getTimeout(config.timeout))
    }

    // 遍历合法参数
    each(defaultField, function (key, item) {
        if (config.hasOwnProperty(item)) {
            options[key] = config[item]
        }
    })

    // 处理原生参数
    if (config.hasOwnProperty('rawFields') && getType(config.rawFields) === 'object') {
        each(config.rawFields, function (key, item) {
            options[key] = item
        })
    }
    // 判断是否有定义取消请求
    if (config.cancelToken) {
        config.cancelToken.promise
            .then((reason) => {
                clearTimeout(abortTimer) // 清除中断定时器
                abortMsg = 'The user aborted a request'
                controller.abort();
            })
            .catch(() => { });
    }
    // 发送前回调通知
    if (getType(config.beforeSend) == 'function') {
        let beforeSendRes = config.beforeSend(config);
        if (beforeSendRes instanceof Promise) {
            try {
                beforeSendRes = await beforeSendRes;
            }catch(err) {}
        }
        if (beforeSendRes === false) {
            return Promise.reject('被beforeSend拦截')
        }
    }
    // 解决在浏览器扩展报错的 Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation
    config.engine = typeof document === 'undefined'? config.engine.bind(globalThis): config.engine;
    return config.engine(config.url, options).then(response => {
        clearTimeout(abortTimer) // 清除中断定时器
        const result = {
            data: null, // 响应内容
            responseText: null, // 响应原始字符串
            status: response.status, // 状态码
            statusText: response.statusText, // 状态描述
            headers: {}, // 响应头
            config, // 请求配置
            response: response.clone(),
        }
        // 遍历请求头
        response.headers.forEach((item, key) => {
            result.headers[key] = item;
        })

        // 响应输出处理
        const responseFinalProcess = () => {
            // 如果状态码在 200-300 之间正常 resolve，否则 reject 错误
            if (result.status >= 200 && result.status < 300) {
                return result;
            } else {
                return Promise.reject(
                    createError(
                        `Request failed with status code ${result.status}`,
                        config,
                        null,
                        null,
                        result
                    )
                );
            }
        }

        const responseType = config.responseType == 'blobText' ? 'blob' : config.responseType
        // 最终结果响应输出
        const responseOutput = (text) => {
            let data = text
            if (isJson(text)) {
                data = JSON.parse(text)
            } else {
                if (responseType == 'json') {
                    data = {}
                }
            }
            result.data = data
            result.responseText = text;
            return responseFinalProcess()
        }
        if (responseType != 'json' && typeof response[responseType] === 'function') {
            return response[responseType]().then(data => {
                if (config.responseType == 'blobText') {
                    return blobToText(data, getCharset(config, result.headers)).then(responseOutput)
                }
                else {
                    result.data = data
                    return responseFinalProcess()
                }
            })
        }
        else {
            return response.text().then(responseOutput)
        }
    }).catch(err => {
        if (typeof err == 'object' && !isEmpty(err.name)) {
            if (err.name === 'AbortError') {
                // 处理成abort报错模式
                throw new DOMException(abortMsg, err.name);
            }
        }
        throw err;
    })
}
export default esFetch