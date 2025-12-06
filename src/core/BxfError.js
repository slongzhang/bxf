'use strict';


class BxfError extends Error {
    static from(error, code, config, request, response, customProps) {
        const bxfError = new BxfError(error.message, code || error.code, config, request, response);
        bxfError.cause = error;
        bxfError.name = error.name;
        customProps && Object.assign(bxfError, customProps);
        return bxfError;
    }

    /**
     * Create an Error with the specified message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [config] The config.
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     *
     * @returns {Error} The created error.
     */
    constructor(message, code, config, request, response) {
        super(message);
        this.name = 'BxfError';
        this.isBxfError = true;
        this.code = code? code : 'ERR_UNKNOWN';
        // code && (this.code = code);
        config && (this.config = config);
        request && (this.request = request);
        if (response) {
            this.response = response;
            this.status = response.status;
        }
    }

    toJSON() {
        return {
            // Standard
            message: this.message,
            name: this.name,
            // Microsoft
            description: this.description,
            number: this.number,
            // Mozilla
            fileName: this.fileName,
            lineNumber: this.lineNumber,
            columnNumber: this.columnNumber,
            stack: this.stack,
            // Axios
            config: this.config,
            code: this.code,
            status: this.status,
            response: this.response,
        };
    }
}

// 错误的配置项值(如timeout字段值只能是正整型，而用户配置了负数或浮点数)
BxfError.ERR_BAD_OPTION_VALUE = 'ERR_BAD_OPTION_VALUE';
// 无效的配置项(如timeou字段用户写成TimeOut等字段拼写错误)
BxfError.ERR_BAD_OPTION = 'ERR_BAD_OPTION';
// 请求被中止（请求因超时 / 手动取消被中断）
BxfError.ECONNABORTED = 'ECONNABORTED';
// 请求超时(分为两种超时：1. 连接超时：无法在指定时间内与服务器建立 TCP 连接（如服务器宕机、网络不通）；2. 响应超时：连接建立后，服务器未在指定时间返回响应。)
BxfError.ETIMEDOUT = 'ETIMEDOUT';
// 网络错误(底层网络层异常，请求无法发送 / 接收。例：前端断网（WiFi/4G 断开）、跨域未配置、防火墙拦截、DNS 解析失败、服务器端口未开放。)
BxfError.ERR_NETWORK = 'ERR_NETWORK';
// // 重定向次数过多(请求触发的 HTTP 重定向（3xx 状态码）超过 Axios 配置的 maxRedirects 上限（默认 21 次）。例：A→B→C→… 循环重定向、重定向链过长。)
// BxfError.ERR_FR_TOO_MANY_REDIRECTS = 'ERR_FR_TOO_MANY_REDIRECTS';
// // 已废弃的 API / 配置
// BxfError.ERR_DEPRECATED = 'ERR_DEPRECATED';
// 无效的响应(服务器返回了 非标准 HTTP 响应（无法解析）)
BxfError.ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE';
// 错误的请求(请求本身格式非法，服务器无法处理（区别于 400 状态码，是客户端 / 网络层的请求构建错误）。例：请求头格式错误、请求体编码异常、URL 包含非法字符（未编码）)
BxfError.ERR_BAD_REQUEST = 'ERR_BAD_REQUEST';
// 请求被取消(用户通过传入的signal 进行abort取消)
BxfError.ERR_CANCELED = 'ERR_CANCELED';
// 无效的 URL
BxfError.ERR_INVALID_URL = 'ERR_INVALID_URL';
// onlyDate 拒绝
BxfError.ERR_ONLYDATA_STATUS = 'ERR_ONLYDATA_STATUS';
// 用户在beforeInterceptors 返回false终止后续操作
BxfError.BEFORE_TERMINATE = 'BEFORE_TERMINATE';
// abortSignal 信号终止
BxfError.ERR_ABORT_SIGNAL = 'ERR_ABORT_SIGNAL';

/*
if (false) {
    // 使用案例
    const asDemo = function () {
        const config = {}, // 请求配置
            request = {}, // xhr的请求句柄
            response = {}; // 响应结果{data, raw, status, statusText, headers}
        // 1.手动抛出错误
        const myErr = new BxfError('手动抛出错误', 'ERR_TEST', config, request, response);
        // 系统等其他catch捕获到的error
        try {
            const a = 1;
            a = 2;
        } catch (error) {
            const unErr = BxfError.from(error, void 0, config, request, response);
        }
    }
}
*/

export default BxfError;