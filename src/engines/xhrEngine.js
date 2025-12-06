import { getRequestEngine, responseTypes } from "../core/dispatchRequest";
import { normalizeResponse } from "../core/normalizeResponse"
import {isJson, parseRawHeaders, blobToText, isObject} from "../utils/index"
import BxfError from "../core/BxfError";

// 导出xhr请求引擎
export const xhrEngine = function(config) {
    
    return new Promise(async (resolve, reject) => {      
        if (config?.signal?.aborted) {
            return reject(new BxfError('signal is aborted without reason', BxfError.ERR_CANCELED, config))
        }

        // 获取请求实例
        const _request = new (await getRequestEngine('xhr', config.nativeEngine));
        // 响应体
        const reason = {
            config,
            request: _request,
        };

        // 清除监听
        const cleanup = function() {
            if (typeof config.cleanup === 'function') {
                config.cleanup();
            }
            // 移除abort事件监听
            if (config?.signal) {
                config.signal.removeEventListener('abort', onAbort);
            }
            // 清理XHR事件监听
            _request.onerror = null;
            _request.onreadystatechange = null;
            _request.upload.onprogress = null;
            _request.onprogress = null;
        }

        // 捕获到中断事件
        const onAbort = function(event) {
            _request.abort()
            const target = event.target;
            let message = target.message? target.message: BxfError.ERR_ABORT_SIGNAL;
            if (target instanceof AbortSignal) {
                message = target.reason;
            }
            reject(new BxfError(message, BxfError.ECONNABORTED, config, _request, reason));
        }

        // 监听abort事件
        if (config?.signal) {
            config.signal.addEventListener('abort', onAbort, {once: true});
        }

        // 初始化请求(method, url, async, username, password)
        // xx.open('post', 'http://www.xxx.com', true, 'zhangsan', '123456') 则 url => http://zhangsan:123455@www.xxx.com
        _request.open(config.method, config.url, true);

        // 处理请求头
        if (isObject(config.headers)) {
            for (let [key, item] of Object.entries(config.headers)) {
                _request.setRequestHeader(key, item);
            }
        }
        
        // 处理响应类型
        const responseType = config.responseType? config.responseType: '';
        // 判断用户是否设置了返回数据类型
        if (responseType && responseTypes[responseType]) {
            _request.responseType = (responseType === 'blobtext') ? 'blob' : responseType;
        }

        // 判断是否有原生字段
        if (isObject(config.rawFields)) {
            const banKeys = ['open', 'onreadystatechange', 'ontimeout', 'timeout', 'onerror', 'setrequestheader', 'send']
            for (let [key, item] of Object.entries(config.rawFields)) {
                let _key = key.toString().toLowerCase();
                if (!banKeys.includes(_key)) {
                    _request[key] = item;
                }
            }
        }

        // 判断是否有监听上传
        if (typeof config.onUploadProgress === 'function') {
            _request.upload.onprogress = config.onUploadProgress
        }

        // 判断是否有下载监听
        if (typeof config.onDownloadProgress === 'function') {
            _request.onprogress = config.onDownloadProgress;
        }

        // 监听错误
        _request.onerror = function(event) {
            reject(BxfError.from(event.target, void 0, config, _request, normalizeResponse(reason)));
        }

        // 解析响应结果
        const parseResponse = async function() {
            try {
                // 原始响应
                const raw = (!responseType || responseType === 'text')? _request.responseText : _request.response;
                reason.raw = raw;
                reason.status = _request.status;
                reason.statusText = _request.statusText;

                // 响应头
                reason.headers = parseRawHeaders(_request.getAllResponseHeaders())
                // 判断响应类型
                if (_request.responseType  === 'text') {
                    reason.data = _request.responseText;
                }
                else if (responseType === 'blobtext') {
                    await blobToText(_request.response, config.charset).then(data => {
                        reason.data = data;
                    })
                }
                else {
                    if (typeof raw === 'string' && isJson(raw)) {
                        reason.data = JSON.parse(raw)
                    }
                    else {
                        reason.data = raw;
                    }
                }
            }
            catch (error) {
                cleanup();
                return Promise.reject(BxfError.from(error, BxfError.ERR_BAD_RESPONSE, config, _request, normalizeResponse(reason)));
            }
            cleanup();
            return normalizeResponse(reason);
        }

        // 监听 请求状态的改变 ，接收响应数据
        _request.onreadystatechange = function() {
            if (_request.readyState !== 4 || _request.status === 0) {
                return
            }
            parseResponse().then(resolve).catch(reject);
        }

        // 发送请求
        try {
            _request.send(config.data);
        } catch (sendErr) {
            cleanup();
            reject(BxfError.from(sendErr, BxfError.ERR_BAD_REQUEST, config, _request, normalizeResponse(reason)));
        }
    })
}

export default xhrEngine;