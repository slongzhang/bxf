import { isObject, HAS_DATA_METHODS, NO_DATA_METHODS } from '../utils/index.js';
import { InterceptorManager } from '../interceptors/interceptorManager.js';
import bxf from './bxf.js';

/**
 * 创建实例。公开调用形态保持不变：
 *   bxf(config) / bxf(url, config) / bxf.get(url, config) / bxf.post(url, data, config)
 *   bxf.request === bxf，bxf.create(defaults) 创建不共享 defaults 的子实例
 */
export function createClient(defaults) {
    defaults = isObject(defaults) ? defaults : {};
    // baseURL 统一以 / 结尾，供 RequestSpec 拼相对地址
    const baseURL = (defaults.baseURL && typeof defaults.baseURL === 'string')
        ? defaults.baseURL.replace(/(\/)*$/g, '') + '/'
        : '';

    const interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager(),
    };

    // 注入 this：defaults / baseURL / interceptors
    const client = bxf.bind({ defaults, baseURL, interceptors });

    client.defaults = defaults;
    client.interceptors = interceptors;
    client.request = client;
    client.create = createClient;

    // 有 data 请求体的方法
    for (let method of HAS_DATA_METHODS) {
        client[method] = (url, data, config) => client(url, config, method, data);
    }

    // 没有 data 请求体的方法
    for (let method of NO_DATA_METHODS) {
        client[method] = (url, config) => client(url, config, method);
    }

    /** @public */
    client.all = Promise.all.bind(Promise);

    /**
     * @public
     * @template Args, R
     * @param {(...args: Args[]) => R} fn
     * @returns {(array: Args[]) => R}
     */
    client.spread = (fn) => /** @type {any} */ (fn.apply.bind(fn, fn));

    return client;
}
