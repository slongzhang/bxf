// 存放HttpRequest类
import {dispatchRequest, processConfig} from "./dispatchRequest"
import { isEmpty } from "../helpers/util"
import InterceptorManager from "./InterceptorManager"
class HttpRequest {
    // 用来存储配置信息
    config = {}
    constructor(initConfig) {
        // 实例化时接收一个配置信息,并保存到config属性中
        this.config = initConfig;
        // 拦截器对象中包含：request拦截器以及response拦截器
        this.interceptors = {
            request: new InterceptorManager(),
            response: new InterceptorManager()
        }
    }

    // 该类有一个request方法,它可以用来发送请求
    request(config, printConfig = false) {
        if (isEmpty(config)) {
            let err = TypeError('配置参数错误或已被请求拦截,请检查代码')
            return Promise.reject(err)
        }
        // 处理传入的配置
        config = processConfig(config);
        if (printConfig) {
            return Promise.resolve(config)
        }
        // 定义一个数组，数组中放入，会发送真实请求的对象，可以想象成它也是一个拦截器
        const chain = [
            {
                resolved: dispatchRequest,
                rejected: undefined
            }
        ]
        // 当用户使用 axios.interceptors.request.use(...) 推入了多个请求拦截器时
        // this.interceptors.request 这里面就有多个拦截器，通过遍历拦截器，插入 chain 数组的前面
        this.interceptors.request.forEach(interceptor => {
            chain.unshift(interceptor)
        })
        // 当用户使用 axios.interceptors.response.use(...) 推入多个响应拦截器时
        // this.interceptors.response 这里面就有多个拦截器，通过遍历拦截器，插入 chain 数组的后面
        this.interceptors.response.forEach(interceptor => {
            chain.push(interceptor)
        })

        // // 此时的 chain 应该是这样的
        // [
        //     {
        //         resolved: (config) => {/*...*/ }, // 用户自定义请求拦截器
        //         rejected: (config) => {/*...*/ }
        //     },
        //     /*...*/
        //     {
        //         resolved: dispatchRequest,
        //         rejected: undefined
        //     },
        //     /*...*/
        //     {
        //         resolved: (res) => {/*...*/ }, // 用户自定义响应拦截器
        //         rejected: (res) => {/*...*/ }
        //     },
        // ]


        let promise = Promise.resolve(config)
        // 如果 chain 数组中有值就进入循环遍历
        while (chain.length) {
            // 每次取出数组的第一个元素，并从数组中删除
            const { resolved, rejected } = chain.shift();
            // promise 复制为下一次 promise.then，实现拦截器链式传递
            promise = promise.then(resolved, rejected)
        }
        // 最终全部执行完成之后，返回最后的执行结果
        return promise
    }
}

// 不需要带data参数的方法
const withoutDataMethods = ['get', 'delete', 'head', 'options'];
for (let method of withoutDataMethods) {
    HttpRequest.prototype[method] = function (url, config) {
        return this.request(Object.assign(config || {}, {
            method,
            url
        }))
    }
}

// 需要带data参数的方法
const withDataMethods = ['post', 'put', 'patch'];
for (let method of withDataMethods) {
    HttpRequest.prototype[method] = function (url, data, config) {
        return this.request(Object.assign(config || {}, {
            method,
            data,
            url
        }))
    }
}

export default HttpRequest