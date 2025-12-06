import {isObject, HAS_DATA_METHODS, NO_DATA_METHODS } from '../utils/index';
import { InterceptorManager } from '../interceptors/interceptorManager.js';
import bxf from './bxf'

export function createClient(defaults) {
    defaults = isObject(defaults)? defaults: {};
    // 基础baseURL
	const baseURL = (defaults.baseURL && typeof defaults.baseURL == 'string')? defaults.baseURL.replace(/(\/)*$/g, '') + '/': '';
    
    // 拦截器
    const interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager(),
    }

    // 注入this
    const client = bxf.bind({
        defaults,
        baseURL,
        interceptors,
    })

    // 默认配置
    client.defaults = defaults;

    // 拦截
    client.interceptors = interceptors;

    // 通用请求
    client.request = client;

    // 创建子实例
    client.create = createClient;

    // // 终止当前实例的所有请求
    // client.abortAll = 

    // 有data请求体的方法
    for (let method of HAS_DATA_METHODS) {
        client[method] = (url, data, config) => client(url, config, method, data);
    }

    // 没有data请求体的方法
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
    
    // 取消函数
    // client.CancelToken = 

    return client;
}