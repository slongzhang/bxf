'use strict';

/**
 * 双引擎共用的错误类型。
 * 无论请求走 fetch 还是 XHR，失败时对外一定是 BxfError，
 * 且 code / config / response 字段形状一致。
 * config 由调用方保证传入可回喂的快照（spec.source），错误对象不再做隐式剥离。
 */
class BxfError extends Error {
    static from(error, code, config, response, customProps) {
        // error 可能是 Error、DOMException、XHR 实例（无 message）、字符串或 undefined
        let message;
        if (typeof error === 'string') {
            message = error;
        } else if (error && typeof error === 'object') {
            message = error.message || error.statusText ||
                (error.name ? String(error.name) : 'Unknown error');
        } else {
            message = 'Unknown error';
        }

        const bxfError = new BxfError(
            message,
            code || (error && error.code),
            config,
            response,
        );
        bxfError.cause = error;
        // 底层原始错误名保留在 causeName，对外 name 恒为 BxfError（双引擎一致）
        if (error && error.name) bxfError.causeName = error.name;
        customProps && Object.assign(bxfError, customProps);
        return bxfError;
    }

    constructor(message, code, config, response) {
        super(message);
        this.name = 'BxfError';
        this.isBxfError = true;
        this.code = code ? code : 'ERR_UNKNOWN';
        if (config) this.config = config;
        if (response) {
            this.response = response;
            this.status = response.status;
        }
    }

    toJSON() {
        return {
            message: this.message,
            name: this.name,
            description: this.description,
            number: this.number,
            fileName: this.fileName,
            lineNumber: this.lineNumber,
            columnNumber: this.columnNumber,
            stack: this.stack,
            config: this.config,
            code: this.code,
            status: this.status,
            response: this.response,
        };
    }
}

// 错误的配置项值(如timeout字段值只能是正整型)
BxfError.ERR_BAD_OPTION_VALUE = 'ERR_BAD_OPTION_VALUE';
// 无效的配置项(如 timeout 字段拼写错误)
BxfError.ERR_BAD_OPTION = 'ERR_BAD_OPTION';
// 请求超时（连接或响应超时，由 AbortSignal.timeout 触发）
BxfError.ETIMEDOUT = 'ETIMEDOUT';
// 请求被用户主动取消
BxfError.ERR_CANCELED = 'ERR_CANCELED';
// 兼容旧版：被中止的统称（现在优先使用上面两个更精确的 code）
BxfError.ECONNABORTED = 'ECONNABORTED';
// 网络错误(断网、跨域未配置、DNS 失败等)
BxfError.ERR_NETWORK = 'ERR_NETWORK';
// 无效的响应(响应体无法按预期解析)
BxfError.ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE';
// 错误的请求(请求构建/发送阶段异常)
BxfError.ERR_BAD_REQUEST = 'ERR_BAD_REQUEST';
// 无效的 URL
BxfError.ERR_INVALID_URL = 'ERR_INVALID_URL';
// 当前引擎不支持该能力
BxfError.ERR_UNSUPPORTED = 'ERR_UNSUPPORTED';
// HTTP 状态码未命中 resolveStatus 规则
BxfError.ERR_HTTP_STATUS = 'ERR_HTTP_STATUS';
// 用户在 beforeInterceptors 返回 false 终止后续操作
BxfError.BEFORE_TERMINATE = 'BEFORE_TERMINATE';
// abortSignal 信号终止
BxfError.ERR_ABORT_SIGNAL = 'ERR_ABORT_SIGNAL';

/**
 * 把底层抛出的任意错误映射成统一的 BxfError code。
 * fetch 原生可能抛 AbortError / TimeoutError / TypeError('Failed to fetch')，
 * XHR 抛的是事件对象，这里做唯一收口。
 */
BxfError.resolveCode = function (error, signal) {
    if (error && error.isBxfError && error.code && error.code !== 'ERR_UNKNOWN') {
        return error.code;
    }
    if (error && error.code && typeof error.code === 'string' && error.code !== 'ERR_UNKNOWN') {
        return error.code;
    }
    const reason = (signal && signal.reason) || undefined;
    const name = (error && error.name) || (reason && reason.name) || '';
    const message = (error && error.message) || '';

    if (name === 'TimeoutError' || /timed out|timeout/i.test(message)) {
        return BxfError.ETIMEDOUT;
    }
    if (name === 'AbortError' || (signal && signal.aborted)) {
        return BxfError.ERR_CANCELED;
    }
    if (name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(message)) {
        return BxfError.ERR_NETWORK;
    }
    if (name === 'SyntaxError') {
        return BxfError.ERR_BAD_RESPONSE;
    }
    return 'ERR_UNKNOWN';
};

export default BxfError;
