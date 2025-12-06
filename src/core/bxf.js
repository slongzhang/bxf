import { deepMerge, HAS_DATA_METHODS, isFunction, onlyDataHttpStatus } from '../utils/index';
import queryEncode from '../utils/queryEncode.js';
import { dispatchRequest } from './dispatchRequest';
import { abortController } from "./abortController";
import { dispatchWithInterceptors  } from '../interceptors/dispatchWithInterceptors.js'
import BxfError from './BxfError.js'

// 请求类型常量
const CT = "content-type";
const CT_JSON = 'application/json';
const CT_QUERY = 'application/x-www-form-urlencoded'

// 核心请求函数
export function bxf(urlOrConfig, config, _method, data, _undefined) {
    // 基础根域名
    const baseURL = this.baseURL;

    // 解析url请求地址
    let url = (typeof urlOrConfig !== 'string'? (config = urlOrConfig).url : urlOrConfig);

    // 合并请求参数
    const options = deepMerge(this.defaults, config);

    // 请求类型
    const method = (_method || options.method || 'get').toLowerCase();
    
    // 自定义请求头
    const customHeaders = {};
    // 判断是否需要授权参数
    if (options.auth) {
        customHeaders.authorization = options.auth;
    }

    // 处理请求data
    data = data || options.data;

    // 判断data是否简单data对象
    const isPlainData = (data &&
        typeof data === 'object' &&                  // 是对象
        typeof data.append !== 'function' &&         // 不是 FormData（或类似）
        typeof data.text !== 'function'              // 不是 Blob、File、Response 等
    );

    // 判断请求体`data`是否需要转换成queryURL
    const hasData = HAS_DATA_METHODS.includes(method);

    if (hasData) {
        const requestType = options.requestType
        // 判断是否有指定请求类型
        if (requestType === 'query') {
            data = queryEncode(data)
            customHeaders[CT] = CT_QUERY;
        }
        else if (isPlainData) {
            data = JSON.stringify(data);
            customHeaders[CT] = CT_JSON;
        }
        // 用户指定了提交类型了(同时需要满足不是表单)
        if (requestType === 'json' && (!data || isPlainData)) {
            customHeaders[CT] = CT_JSON;
        }
    }
    else {
        if (!options.params && isPlainData) {
            options.params = data;
        }
        // 如果是get等没有请求体的则删除data
        data = void 0;
    }

    // 判断是否有xsrf请求头
    if (options.xsrfHeaderName && options.xsrfCookieName) {
        try {
            // @ts-ignore providing the cookie name without header name is nonsensical anyway
            customHeaders[options.xsrfHeaderName] = decodeURIComponent(
                // @ts-ignore accessing match()[2] throws for no match, which is intentional
                document.cookie.match(RegExp('(^|; )' + options.xsrfCookieName + '=([^;]*)'))[2]
            );
        } catch (e) {}
    }

    // 处理url
    if (/^(?!.*\/\/)\/?/.test(url)) {
        if (baseURL) {
            url = url.replace(/^(?!.*\/\/)\/?/, baseURL);
        }
        else if (typeof URL === 'function' && typeof location === 'object') {
            try {
                url = new URL(url, location).href;
            } catch (err) {}
        }
        else if (typeof document === 'object') {
            try {
                const a = document.createElement('a');
                a.href = url;
                url = a.href;
            } catch(err) {}
        }
    }

    // 处理get请求参数
    if (options.params) {
        url += 
            (~url.indexOf('?') ? '&' : '?') +
			(isFunction(options.paramsSerializer) ? options.paramsSerializer(options.params) : queryEncode(options.params));
    }

    // 响应类型
    const responseType = options?.responseType ? options.responseType.toLowerCase(): '';

    // 合并请求头
	options.headers = deepMerge(options.headers, customHeaders, true)

    // 判断是否有监听上传进度，如果有上传进度监听则自动降级xhr
    if (typeof options.onUploadProgress === 'function' 
        || typeof options.onDownloadProgress === 'function'
    ) {
        options.engine = 'xhr';
    }

    // 判断使用的请求引擎
    const requestEngine = dispatchRequest(options.engine);

    // 处理请求拦截和响应拦截相关
    const interceptors = this.interceptors;

    // 统一处理中断和超时
    const {signal, cleanup, abort} = abortController(config);

    // 合并最终请求参数
    Object.assign(options, {
        url,
        method: method.toUpperCase(),
        data,
        responseType,
        signal,
        cleanup,
        abort
    });

    let handle = Promise.resolve(true);
    // 请求前拦截
    if (typeof options.beforeInterceptors === 'function') {
        const biRes = options.beforeInterceptors(options);
        if (biRes instanceof Promise) {
            handle = biRes;
        }
        else {
            handle = Promise.resolve(biRes)
        }
    }

    return handle.then(value => {
        if (value === false) {
            return Promise.reject(new BxfError('BeforeInterceptors terminate', BxfError.BEFORE_TERMINATE, options));
        }
        else {
            return dispatchWithInterceptors(options, requestEngine, interceptors);
        }
    }).then(result => {
        // 判断是否有仅获取响应数据
        if (options?.onlyData && result?.config === options) {
            const status = result.status;
            let onlyDataStatus = options?.onlyDataStatus ? options.onlyDataStatus: '200, 300';
            if (onlyDataStatus === '*') {
                return result.data;
            }
            if (Array.isArray(onlyDataStatus)) {
                for (let item of onlyDataStatus) {
                    if (onlyDataHttpStatus(item, status)) {
                        return result.data;
                    }
                }
            }
            else {
                if (onlyDataHttpStatus(onlyDataStatus, status)) {
                    return result.data;
                }
            }
            return Promise.reject(new BxfError('OnlyData thrown', BxfError.ERR_ONLYDATA_STATUS, options, options.request, result));
        }
        return result;
    })
}

export default bxf;