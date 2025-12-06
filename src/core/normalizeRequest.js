import { isObject } from "../utils";

export function normalizeRequest(opts) {
    if (!isObject(opts)) {
        throw new Error('请求配置错误')
    }
    // 默认的配置
    const defOpts = {
        // 请求地址
        url: '',
        // 请求方法
        method: 'get',
        // url参数, 对象或query字符串
        params: void 0,
        // params处理函数
        paramsSerializer: void 0,
        // 请求体
        data: void 0,
        // 全局拦截前的拦截处理函数
        beforeInterceptors: void 0,
        // headers请求头
        headers: {},
        // 请求权限,如token
        auth: void 0,
        // xsrf请求头
        xsrfHeaderName: void 0,
        xsrfCookieName: void 0,
        // 请求引擎 ['fetch', 'xhr'] 或 函数
        engine: 'fetch',
        // 是否要提取干净的请求引擎
        nativeEngine: false,
        // 超时单位毫秒，大于0则进行超时配置，否则忽略超时
        timeout: 0, 
        // 中断信号只接受 new AbortController()
        abortController: void 0, 
        // 请求类型
        requestType: void 0,
        // 响应类型
        responseType: void 0,
        // 是否仅响应data,默认仅响应data
        onlyData: true,
        // 原生属性挂载
        rawFields: {},
        // 上传进度监控函数
        onUploadProgress: void 0,
        // 下载进度
        onDownloadProgress: void 0,
    }
    return Object.assign(defOpts, opts)
}
