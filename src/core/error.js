export class HttpRequestError extends Error {
    isHttpRequestError;
    config;
    code;
    request;
    response;

    constructor(message, config, code, request, response) {
        super(message);
        this.config = config;
        this.code = code;
        this.request = request;
        this.response = response;
        this.isHttpRequestError = true;
    }
}

export function createError(message, config, code, request, response) {
    return new HttpRequestError(message, config, code, request, response);
}