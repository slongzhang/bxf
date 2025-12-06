import { isObject } from '../utils/index';
/**
 * 构建 axios 风格拦截器链
 * request: 后添加先执行（栈）
 * response: 先添加先执行（队列）
 * all 链中全是 Promise 的 resolved/rejected handler
 */
export function dispatchWithInterceptors(config, requestFn, interceptors) {
    let promise = Promise.resolve(config);

    const chain = [];

    // 1) request 拦截器（倒序：后添加先执行）
    interceptors.request.handlers.forEach((h) => {
        if (h && isObject(h)) {
            chain.unshift(h.fulfilled, h.rejected);    
        }
    });

    // 2) dispatch request (核心请求)
    chain.push(
        requestFn,      // resolved 执行请求
        undefined       // rejected 不处理
    );

    // 3) response 拦截器（顺序执行）
    interceptors.response.handlers.forEach((h) => {
        chain.push(h.fulfilled, h.rejected);
    });

    // 逐个链接
    while (chain.length) {
        const onFulfilled = chain.shift();
        const onRejected = chain.shift();
        promise = promise.then(onFulfilled, onRejected);
    }

    return promise;
}
