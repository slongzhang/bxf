/*!
* name: bxf
* version: 1.0.5
* author: slongzhang <slongZhang@126.com> (https://gitee.com/slongzhag || https://github.com/slongzhang)
* date: 2023/12/4 23:43:34
* description: 一个基于 promise 的网络请求库,支持XMLHttpRequest和fetch两种可选请求接口
*/
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["bxf"] = factory();
	else
		root["bxf"] = factory();
})(this, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/cancel/cancel.js":
/*!******************************!*\
  !*** ./src/cancel/cancel.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Cancel: () => (/* binding */ Cancel),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   isCancel: () => (/* binding */ isCancel)
/* harmony export */ });
class Cancel {
    message;

    constructor(message) {
        this.message = message;
    }
}

function isCancel(value) {
    return value instanceof Cancel;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Cancel);

/***/ }),

/***/ "./src/cancel/cancelToken.js":
/*!***********************************!*\
  !*** ./src/cancel/cancelToken.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ CancelToken)
/* harmony export */ });
/* harmony import */ var _cancel__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./cancel */ "./src/cancel/cancel.js");

class CancelToken {
    promise;// 定义 promise 变量，用来存储状态
    reason; // 定义错误原因变量

    constructor(executor) {
        // 定义一个空变量，用它来存储一个 promise 实例的 resolve 方法
        let resolvePromise;
        this.promise = new Promise(resolve => {
            resolvePromise = resolve
        })

        const paramFn = message => {
            if (this.reason) {
                return
            }
            this.reason = new _cancel__WEBPACK_IMPORTED_MODULE_0__["default"](message)
            resolvePromise(this.reason)
        };
        // 执行实例化时传入的方法，并使用 paramFn 作为参数传入
        executor(paramFn)
    }

    throwIfRequested() {
        if (this.reason) {
            throw this.reason
        }
    }
    // 定义 source 静态方法，导出 CancelToken 实例以及取消方法 cancel
    static source() {
        let cancel;
        const token = new CancelToken(c => {
            cancel = c
        })
        return {
            cancel,
            token
        }
    }
}


/***/ }),

/***/ "./src/core/HttpRequest.js":
/*!*********************************!*\
  !*** ./src/core/HttpRequest.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _dispatchRequest__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./dispatchRequest */ "./src/core/dispatchRequest.js");
/* harmony import */ var _helpers_util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../helpers/util */ "./src/helpers/util.js");
/* harmony import */ var _InterceptorManager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./InterceptorManager */ "./src/core/InterceptorManager.js");
// 存放HttpRequest类



class HttpRequest {
    // 用来存储配置信息
    config = {}
    constructor(initConfig) {
        // 实例化时接收一个配置信息,并保存到config属性中
        this.config = initConfig;
        // 拦截器对象中包含：request拦截器以及response拦截器
        this.interceptors = {
            request: new _InterceptorManager__WEBPACK_IMPORTED_MODULE_2__["default"](),
            response: new _InterceptorManager__WEBPACK_IMPORTED_MODULE_2__["default"]()
        }
    }

    // 该类有一个request方法,它可以用来发送请求
    request(config, printConfig = false) {
        if ((0,_helpers_util__WEBPACK_IMPORTED_MODULE_1__.isEmpty)(config)) {
            let err = TypeError('配置参数错误或已被请求拦截,请检查代码')
            return Promise.reject(err)
        }
        // 处理传入的配置
        config = (0,_dispatchRequest__WEBPACK_IMPORTED_MODULE_0__.processConfig)(config);
        if (printConfig) {
            return Promise.resolve(config)
        }
        // 定义一个数组，数组中放入，会发送真实请求的对象，可以想象成它也是一个拦截器
        const chain = [
            {
                resolved: _dispatchRequest__WEBPACK_IMPORTED_MODULE_0__.dispatchRequest,
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

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (HttpRequest);

/***/ }),

/***/ "./src/core/InterceptorManager.js":
/*!****************************************!*\
  !*** ./src/core/InterceptorManager.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
// 拦截器相关
class InterceptorManager {
    // 定义一个数组，用来存储拦截器
    interceptors = [];

    use(resolved, rejected) {
        // 向数组推入拦截器对象
        this.interceptors.push({
            resolved,
            rejected,
        })
        // 返回拦截器在数组中索引
        return this.interceptors.length - 1
    }

    // 遍历数组
    forEach(fn) {
        this.interceptors.forEach(interceptor => {
            if (interceptor !== null) {
                fn(interceptor)
            }
        })
    }
    
    // 根据索引删除拦截器
    eject(id) {
        if (this.interceptors[id]) {
            this.interceptors[id] = null
        }
    }
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (InterceptorManager);

/***/ }),

/***/ "./src/core/dispatchRequest.js":
/*!*************************************!*\
  !*** ./src/core/dispatchRequest.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   dispatchRequest: () => (/* binding */ dispatchRequest),
/* harmony export */   processConfig: () => (/* binding */ processConfig)
/* harmony export */ });
/* harmony import */ var _helpers_util__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../helpers/util */ "./src/helpers/util.js");
/* harmony import */ var _helpers_data__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../helpers/data */ "./src/helpers/data.js");
/* harmony import */ var _helpers_url__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../helpers/url */ "./src/helpers/url.js");
/* harmony import */ var _helpers_headers__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../helpers/headers */ "./src/helpers/headers.js");
/* harmony import */ var _engine_fetch__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../engine/fetch */ "./src/engine/fetch.js");
/* harmony import */ var _engine_xhr__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../engine/xhr */ "./src/engine/xhr.js");
// 触发请求










// 预处理配置
const processConfig = (config) => {
  // 处理请求方法
  const methods = ['get', 'post', 'put', 'delete', 'options', 'head', 'patch', 'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'];
  if ((0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(config.method) || !methods.includes(config.method)) {
      config.method = 'GET'
  }
  // 统一处理为大写
  config.method = config.method.toUpperCase();


  // 处理请求体格式
  let dataType = (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getType)(config.data)
  if (dataType == 'formdata') {
      config.requestType = 'formdata'
  }
  else {
      if (dataType === 'undefined') {
          config.data = null
      }
      if (!(0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(config.requestType)) {
          config.requestType = config.requestType.toLowerCase()
          if (!['query', 'json', 'form', 'formdata'].includes(config.requestType)) {
              config.requestType = 'query'
          }
      }
      else {
          config.requestType = 'query'
      }
  }


  // 处理请求体（必须位于处理url前，才能正确转换data和params混用）
  if (['GET', 'DELETE', 'HEAD'].includes(config.method)) {
      if (!config.hasOwnProperty('params') && !(0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(config.data)) {
          config.params = config.data
          config.data = null
      }
  }
  else {
      config.data = (0,_helpers_data__WEBPACK_IMPORTED_MODULE_1__.transformRequestData)(config.data, config.requestType)
  }


  // 处理url
  config.url = (0,_helpers_url__WEBPACK_IMPORTED_MODULE_2__.transformURL)(config)
  config.params = null

  // 处理请求头
  config.headers = (0,_helpers_headers__WEBPACK_IMPORTED_MODULE_3__.transformHeaders)(config)
  

  // 处理请求引擎
  config.engine = getEngine(config)


  return config;
}


// 获取适配器，通过判断是否有 XMLHttpRequest 来判断是普通web还是浏览器插件MV3,再进行xhr或fetch的选择
const getEngine = (config) => {
  // 判断处理请求引擎问题
  let engine = config.engine, engineType = (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getType)(engine);
  
  // 如果没有传入请求引擎或请求引擎不是我们定义的则由我们自行判断调用默认引擎
  if (engineType === 'undefined' || (engineType === 'function' && engine.name && !['XMLHttpRequest', 'fetch'].includes(engine.name))) {
    if (typeof XMLHttpRequest !== "undefined") {
      engine = 'xhr'
    }
    else {
      engine = 'fetch'
    }
    engineType = 'string'
  }
  
  if (engineType == 'string') {
      // 统一转换为小写
      engine = engine.toLowerCase()
      if (engine == 'xhr' && typeof XMLHttpRequest == 'function') {
        config.engine = XMLHttpRequest
      }
      else {
        config.engine = typeof fetch == 'function'? fetch: XMLHttpRequest
      }
  }

  
  return config.engine
};

const dispatchRequest = (config) => {
  // if (isEmpty(config)) {
  //   let err = TypeError('配置参数错误或已被请求拦截,请检查代码')
  //   return Promise.reject(err)
  // }
  // // 处理传入的配置
  // config = processConfig(config);

  // 判断并调用请求引擎
  if ((0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getType)(config.engine) == 'function' && config.engine.name === 'fetch') {
    return (0,_engine_fetch__WEBPACK_IMPORTED_MODULE_4__.esFetch)(config) 
  }
  else {
    return (0,_engine_xhr__WEBPACK_IMPORTED_MODULE_5__.xhr)(config)
  }
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (dispatchRequest);

/***/ }),

/***/ "./src/core/error.js":
/*!***************************!*\
  !*** ./src/core/error.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   HttpRequestError: () => (/* binding */ HttpRequestError),
/* harmony export */   createError: () => (/* binding */ createError)
/* harmony export */ });
class HttpRequestError extends Error {
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

function createError(message, config, code, request, response) {
    return new HttpRequestError(message, config, code, request, response);
}

/***/ }),

/***/ "./src/engine/fetch.js":
/*!*****************************!*\
  !*** ./src/engine/fetch.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   esFetch: () => (/* binding */ esFetch)
/* harmony export */ });
/* harmony import */ var _helpers_util__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../helpers/util */ "./src/helpers/util.js");
/* harmony import */ var _core_error__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../core/error */ "./src/core/error.js");
// 浏览器 fetch 请求


const esFetch = (config) => {
    // 最终请求配置参数
    const options = {}
        , defaultField = {
            method: 'method',
            body: 'data',
            headers: 'headers',
        }
    // 处理超时
    const controller = new AbortController();
    options.signal = controller.signal;
    let abortMsg = '', abortTimer = null;
    if (config.hasOwnProperty('timeout') && (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.isNumeric)(config.timeout) && config.timeout > 0) {
        // options.signal = AbortSignal.timeout(getTimeout(config.timeout))
        abortTimer = setTimeout(() => {
            abortMsg = 'signal timed out'
            controller.abort();
        }, (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getTimeout)(config.timeout))
    }

    // 遍历合法参数
    (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.each)(defaultField, function (key, item) {
        if (config.hasOwnProperty(item)) {
            options[key] = config[item]
        }
    })

    // 处理原生参数
    if (config.hasOwnProperty('rawFields') && (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getType)(config.rawFields) === 'object') {
        (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.each)(config.rawFields, function (key, item) {
            options[key] = item
        })
    }
    // 判断是否有定义取消请求
    if (config.cancelToken) {
        config.cancelToken.promise
            .then((reason) => {
                clearTimeout(abortTimer) // 清除中断定时器
                abortMsg = 'The user aborted a request'
                controller.abort();
            })
            .catch(() => { });
    }
    // 发送前回调通知
    if ((0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getType)(config.beforeSend) == 'function') {
        let beforeSendRes = config.beforeSend(config);
        if (beforeSendRes === false) {
            return Promise.reject('被beforeSend拦截')
        }
    }
    return config.engine.bind(globalThis)(config.url, options).then(response => {
        clearTimeout(abortTimer) // 清除中断定时器
        const result = {
            data: null, // 响应内容
            responseText: null, // 响应原始字符串
            status: response.status, // 状态码
            statusText: response.statusText, // 状态描述
            headers: {}, // 响应头
            config, // 请求配置
            response: response.clone(),
        }
        // 遍历请求头
        response.headers.forEach((item, key) => {
            result.headers[key] = item;
        })

        // 响应输出处理
        const responseFinalProcess = () => {
            // 如果状态码在 200-300 之间正常 resolve，否则 reject 错误
            if (result.status >= 200 && result.status < 300) {
                return result;
            } else {
                return Promise.reject(
                    (0,_core_error__WEBPACK_IMPORTED_MODULE_1__.createError)(
                        `Request failed with status code ${result.status}`,
                        config,
                        null,
                        null,
                        result
                    )
                );
            }
        }

        const responseType = config.responseType == 'blobText' ? 'blob' : config.responseType
        // 最终结果响应输出
        const responseOutput = (text) => {
            let data = text
            if ((0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.isJson)(text)) {
                data = JSON.parse(text)
            } else {
                if (responseType == 'json') {
                    data = {}
                }
            }
            result.data = data
            result.responseText = text;
            return responseFinalProcess()
        }
        if (responseType != 'json' && typeof response[responseType] === 'function') {
            return response[responseType]().then(data => {
                if (config.responseType == 'blobText') {
                    return (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.blobToText)(data, (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getCharset)(config, result.headers)).then(responseOutput)
                }
                else {
                    result.data = data
                    return responseFinalProcess()
                }
            })
        }
        else {
            return response.text().then(responseOutput)
        }
    }).catch(err => {
        if (typeof err == 'object' && !(0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(err.name)) {
            if (err.name === 'AbortError') {
                // 处理成abort报错模式
                throw new DOMException(abortMsg, err.name);
            }
        }
        throw err;
    })
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (esFetch);

/***/ }),

/***/ "./src/engine/xhr.js":
/*!***************************!*\
  !*** ./src/engine/xhr.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   xhr: () => (/* binding */ xhr)
/* harmony export */ });
/* harmony import */ var _helpers_util__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../helpers/util */ "./src/helpers/util.js");
/* harmony import */ var _helpers_headers__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../helpers/headers */ "./src/helpers/headers.js");
/* harmony import */ var _core_error__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../core/error */ "./src/core/error.js");
/* xhr请求函数 */




const xhr = (config) => {
    return new Promise((resolve, reject) => {
        // 发送前回调通知
        if ((0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getType)(config.beforeSend) == 'function') {
            let beforeSendRes = config.beforeSend(config);
            if (beforeSendRes === false) {
                return reject('被beforeSend拦截')
            }
        }
        // 解构config, data 如果不传默认认为null, method 不传默认 get, url则是必传参数
        const { data = null, url, method = 'get', headers = {}, responseType, cancelToken } = config

        // responseType
        const responseTypeArr = ['arrayBuffer', 'blob', 'blobText', 'formData'];


        // 实例化 XMLHttpRequest
        const request = new config.engine();

        // 初始化一个请求
        request.open(method.toUpperCase(), url, true);

        // 是否有设置超时
        if (config.hasOwnProperty('timeout') && (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.isNumeric)(config.timeout) && config.timeout > 0) {
            request.timeout = (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getTimeout)(config.timeout)
            request.ontimeout = function () {
                let err = TypeError('xhr 响应超时')
                reject(err);
            }
        }
        // 判断用户是否设置了返回数据类型
        if (responseType && responseTypeArr.includes(responseType)) {
            request.responseType = (responseType == 'blobText') ? 'blob' : responseType
        }

        // 监听 onreadystatechange 函数，接收后台返回数据
        request.onreadystatechange = () => {
            if (request.readyState !== 4) {
                return
            }

            if (request.status === 0) {
                return
            }

            // 返回的 header 是字符串类型，通过 parseHeaders 解析成对象类型
            const responseHeaders = (0,_helpers_headers__WEBPACK_IMPORTED_MODULE_1__.parseHeaders)(request.getAllResponseHeaders());
            const responseData = ((text) => {
                    let data = text
                    if ((0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.isJson)(text)) {
                        data = JSON.parse(text)
                    } else {
                        if (responseType == 'json') {
                            data = {}
                        }
                    }
                    return data
            })(request.responseText)
            const result = {
                data: responseData,
                responseText: Object.getPrototypeOf(request).hasOwnProperty('responseText') ? request.responseText : null,
                status: request.status,
                statusText: request.statusText,
                headers: responseHeaders,
                config,
                xhr: request
            }


            // 响应输出处理
            const responseFinalProcess = () => {
                // 如果状态码在 200-300 之间正常 resolve，否则 reject 错误
                if (result.status >= 200 && result.status < 300) {
                    resolve(result);
                } else {
                    reject(
                        (0,_core_error__WEBPACK_IMPORTED_MODULE_2__.createError)(
                            `Request failed with status code ${result.status}`,
                            config,
                            null,
                            request,
                            result
                        )
                    );
                }
            }



            // 通过 resolve 返回数据
            if (responseType == 'blobText') {
                (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.blobToText)(responseData, (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getCharset)(config, responseHeaders)).then(text => {
                    let data                
                    if ((0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.isJson)(text)) {
                        data = JSON.parse(text)
                    } else {
                        if (responseType == 'json') {
                            data = {}
                        }
                    }
                    result.data = data
                    result.responseText = text;
                    return responseFinalProcess()
                })
            }
            else {
                responseFinalProcess()
            }
        }

        // 监听错误
        request.onerror = () => {
            reject((0,_core_error__WEBPACK_IMPORTED_MODULE_2__.createError)(`Network Error`, config, null, request));
        };
        // 监听超时
        request.ontimeout = () => {
            // ECONNABORTED 通常表示一个被中止的请求
            reject(
                (0,_core_error__WEBPACK_IMPORTED_MODULE_2__.createError)(
                    `Timeout of ${config.timeout} ms exceeded`,
                    config,
                    "ECONNABORTED",
                    request
                )
            );
        };

        // 遍历所有处理后的 headers
        (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.each)(headers, function (key, item) {
            // 给请求设置上 header
            request.setRequestHeader(key, item)
        })
        // xhr字段设置
        if (config.hasOwnProperty('rawFields') && (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getType)(config.rawFields) === 'object') {
            const banKeys = ['open', 'setRequestHeader', 'send']
            ;(0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.each)(config.xhrFields, function (key, item) {
                if (!banKeys.includes(key)) {
                    request[key] = item
                }
            })
        }
        // 获取xhr句柄(自定义xhr事件如获取上传进度)
        let isContinue = true;
        if (config.hasOwnProperty('xhr') && (0,_helpers_util__WEBPACK_IMPORTED_MODULE_0__.getType)(config.xhr) == 'function') {
            if (config.xhr(request, config) === false) {
                isContinue = false
            }
        }

        // 判断是否有定义取消请求
        if (cancelToken) {
            cancelToken.promise
                .then((reason) => {
                    request.abort();
                    reject(reason);
                })
                .catch(() => { });
        }
        // 发送请求
        isContinue && request.send(data);
    })
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (xhr);


/***/ }),

/***/ "./src/helpers/data.js":
/*!*****************************!*\
  !*** ./src/helpers/data.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   transformRequestData: () => (/* binding */ transformRequestData),
/* harmony export */   transformRequestDataArray: () => (/* binding */ transformRequestDataArray),
/* harmony export */   transformRequestDataArrayToTarget: () => (/* binding */ transformRequestDataArrayToTarget),
/* harmony export */   transformRequestDataHandleAOO: () => (/* binding */ transformRequestDataHandleAOO),
/* harmony export */   transformRequestDataObject: () => (/* binding */ transformRequestDataObject),
/* harmony export */   transformRequestDataQuery: () => (/* binding */ transformRequestDataQuery),
/* harmony export */   transformRequestDataString: () => (/* binding */ transformRequestDataString)
/* harmony export */ });
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util */ "./src/helpers/util.js");
/* 转换数据相关函数 */


/*
* name: 转换请求参数
* data: array|plainObject|URLSearchParams|string|formData
*       array: ['a=1', 'b=2&c=3', {d: 4}, {e: [5, 6]}, [f, {f1: 7, f2: 8}]] 
*            => a=1&b=2&c=3&d=4&e[]=5&e[]=6&f[f1]=7&f[f2]=8
*       planObject: {a: 1, e: [5, 6], f: {f1: 7, f2: 8}}
*            => a=1&e[]=5&e[]=6&f[f1]=7&f[f2]=8
*       URLSearchParams: (new URLSearchParams('a=1&b=2')).toString()
*            => a=1&b=2
*       string 和 formData以及未知类型原样返回
* target: {query: 'urlencoded', json: 'json', form: 'formData'}
.*/
const transformRequestData = (data, requestType) => {
    if ((0,_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(data)) {
        return transformRequestDataArrayToTarget(data, requestType)
    }
    let dataType = (0,_util__WEBPACK_IMPORTED_MODULE_0__.getType)(data)
    switch (dataType) {
        case 'array':
            data = transformRequestDataArray(data);
            break;
        case 'object':
            data = transformRequestDataObject(data);
            break;
        case 'urlsearchparams':
            data = transformRequestDataQuery(data);
            break;
        case 'string':
            // 字符串参数不再进行转换处理
            data = transformRequestDataString(data);
            break;
    }
    return transformRequestDataArrayToTarget(data, requestType)
}


// 转换请求参数数组或对象通用处理
const transformRequestDataHandleAOO = (key, val) => {
    let result = [];
    let valType = (0,_util__WEBPACK_IMPORTED_MODULE_0__.getType)(val);
    if (valType == 'array') {
        key += '[]'
        ;(0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(val, function (k, v) {
            result.push([key, v])
        })
    }
    else if (valType == 'object') {
        (0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(val, function (k, v) {
            result.push([`${key}[${k}]`, v])
        })
    }
    // else if (valType == 'date') {
    //     result.push([key, val.valueOf()]);
    // }
    else {
        result.push([key, val])
    }
    return result;
}

// 转换请求参数数组 => 目标格式
const transformRequestDataArrayToTarget = (data, target = 'query') => {
    let result, specialKeys;
    if (!Array.isArray(data)) {
        let dataType = (0,_util__WEBPACK_IMPORTED_MODULE_0__.getType)(data)
        if (dataType == 'object') {
            data = JSON.stringify(data);
        }
        result = data
    }
    else {
        if (target == 'query') {
            let usp = new URLSearchParams();
            (0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(data, function (index, [key, item]) {
                usp.append(key, item)
            })
            result = usp.toString()
        }
        else if (target == 'json') {
            result = {}, specialKeys = {};
            (0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(data, function (index, [key, item]) {
                if (/(^.*?)\[([^\[\]]*)\]/.test(key)) {
                    let parentKey = RegExp.$1, childredKey = RegExp.$2;
                    if (!!childredKey) {
                        if (!specialKeys.hasOwnProperty(parentKey)) {
                            specialKeys[parentKey] = {}
                        }
                        specialKeys[parentKey][childredKey] = item
                    }
                    else {
                        if (!specialKeys.hasOwnProperty(parentKey)) {
                            specialKeys[parentKey] = []
                        }
                        specialKeys[parentKey].push(item)
                    }
                }
                else {
                    result[key] = item
                }
            })
            // 遍历特殊key
            ;(0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(specialKeys, function (key, item) {
                result[key] = item
            })
            result = JSON.stringify(result)
        }
        else if (target == 'form' || target == 'formdata') {
            result = new FormData()
            ;(0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(data, function (index, [key, item]) {
                result.append(key, item)
            })
        }
        else {
            result = data
        }
    }

    return result;
}

// 处理请求参数数组格式
const transformRequestDataArray = (data) => {
    let ergodicData = Object.values(data)
    let result = []
    for (let item of ergodicData) {
        let itemType = (0,_util__WEBPACK_IMPORTED_MODULE_0__.getType)(item);
        switch (itemType) {
            case 'string': {
                let itemParam = new URLSearchParams(item)
                ;(0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(itemParam, function (k, v) {
                    result.push([k, v]);
                })
            }
                break;
            case 'array': {
                let itemLen = item.length
                for (let i = 1; i < itemLen; i += 2) {
                    let key = item[i - 1];
                    let val = item[i];
                    result.push(...transformRequestDataHandleAOO(key, val))
                }
            }
                break;
            case 'object': {
                (0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(item, function (key, val) {
                    result.push(...transformRequestDataHandleAOO(key, val))
                })
            }
                break;
        }
    }
    return result
}

// 处理请求参数对象格式
const transformRequestDataObject = (data) => {
    let result = []
    ;(0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(data, function (key, val) {
        result.push(...transformRequestDataHandleAOO(key, val))
    })
    return result
}

// 处理请求参数URLSearchParams格式
const transformRequestDataQuery = (data) => {
    let result = []
    data.forEach((item, key) => {
        result.push([key, item])
    })
    return result
}

// 处理请求参数 字符串 格式
const transformRequestDataString = (data) => {
    let result = []
    if ((0,_util__WEBPACK_IMPORTED_MODULE_0__.isJson)(data)) {
        let dataTemp = JSON.parse(data)
        if ((0,_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(dataTemp)) {
            result = data;
        }
        else {
            (0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(dataTemp, (item, key) => {
                result.push([key, item])
            })
        }
    }
    else {
        // const usp = new URLSearchParams(data), uspArr = []
        // usp.forEach((item, key) => {
        //     uspArr.push([key, item])
        // })
        // // 判断是不是URLSearchParams格式的参数
        // if (uspArr.length > 1 || !isEmpty(uspArr[0][1].replaceAll('=', ''))) {
        //   result = uspArr
        // }
        // else {
        //   result = data;
        // }
        result = data;
    }
    return result
}


/***/ }),

/***/ "./src/helpers/headers.js":
/*!********************************!*\
  !*** ./src/helpers/headers.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   normalizeHeaderName: () => (/* binding */ normalizeHeaderName),
/* harmony export */   parseHeaders: () => (/* binding */ parseHeaders),
/* harmony export */   processHeaders: () => (/* binding */ processHeaders),
/* harmony export */   transformHeaders: () => (/* binding */ transformHeaders)
/* harmony export */ });
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util */ "./src/helpers/util.js");
/* 处理header相关(请求头和响应头) */

// 解析原始响应头
const parseHeaders = (headers) => {
    let parsed = {}
    if (!headers) {
        return parsed;
    }
    const EOL = '__EOL__'
    // 处理换行符，兼容不同平台的换行
    headers = headers.replaceAll('\r\n', EOL).replaceAll('\r', EOL).replaceAll('\n', EOL)
    headers.split(EOL).forEach((line) => {
        let [key, ...vals] = line.split(":");
        key = key.trim();
        if (!key) {
            return;
        }
        vals = vals.join(":").trim()
        parsed[key.toLowerCase()] = vals
    });
    return parsed;
}

// 处理请求头-标准化请求头
const normalizeHeaderName = (headers, normalizedNames) => {
    if ((0,_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(headers) || (0,_util__WEBPACK_IMPORTED_MODULE_0__.getType)(headers) != 'object') {
        return {}
    }
    let headersMap = {}
    ;(0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(headers, function (key, item) {
        headersMap[key.toUpperCase()] = key;
    })
    // 如果是字符串则转换成数组
    if ((0,_util__WEBPACK_IMPORTED_MODULE_0__.getType)(normalizedNames) === 'string') {
        normalizedNames = [normalizedNames]
    }
    (0,_util__WEBPACK_IMPORTED_MODULE_0__.each)(normalizedNames, function (key, item) {
        let name = item.toUpperCase()
        // normalizedNameObj[item] = [itemTemp, itemTemp.replaceAll('-', '')]
        if (headersMap.hasOwnProperty(name) || (name = name.replaceAll('-', ''), headersMap.hasOwnProperty(name))) {
            name = headersMap[name]
            headers[item] = headers[name]
            delete headers[name]
        }
    })
    return headers;
}

// 处理请求头-预处理请求头
const processHeaders = (headers, contentType, charset) => {
    normalizeHeaderName(headers, 'content-type')
    const formData = 'multipart/form-data'
        , urlencoded = 'application/x-www-form-urlencoded'
    const contentTypeObj = {
        json: 'application/json',
        formData,
        formdata: formData,
        urlencoded,
        query: urlencoded,
        xw: urlencoded,
        text: 'text/plain'
    }
    if (!headers['content-type'] && (0,_util__WEBPACK_IMPORTED_MODULE_0__.getType)(contentType) == 'string') {
        let contentTypeTemp;
        if (contentTypeObj.hasOwnProperty(contentType)) {
            contentTypeTemp = contentTypeObj[contentType];
            let charsetType = (0,_util__WEBPACK_IMPORTED_MODULE_0__.getType)(charset);
            if (charsetType == 'boolean' && charset) {
                charset = 'UTF-8'
                charsetType = 'string';
            }
            if (!(0,_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(charset) && charsetType == 'string') {
                contentTypeTemp = [contentTypeTemp, '; charset=', charset].join('')
            }
        }
        else {
            contentTypeTemp = contentType;
        }
        headers['content-type'] = contentTypeTemp
    }
    return headers
}

// 处理请求头-转换处理请求头
const transformHeaders = (config) => {
    let { headers, contentType, charset } = config;
    let headersType = (0,_util__WEBPACK_IMPORTED_MODULE_0__.getType)(headers), headersTemp = {}
    if (headersType == 'headers') {
        headers.forEach((item, key) => {
            headersTemp[key] = item
        })
        headers = headersTemp;
    }
    else {
        headers = headersType == 'object' ? headers : {}
    }
    // 只要contentType 不是 [false,'', 0] 则一律按照requestType来定义contentType
    if (!(0,_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(contentType) || typeof contentType === 'undefined') {
        if (typeof config.requestType != 'undefined') {
            contentType = config.requestType
        }
        else {
            contentType = 'query'
        }
    }
    config.headers = processHeaders(headers, contentType, charset)
    // 如果没有data则不用设置请求头(['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(config.method))
    if (config.data === null && config.headers.hasOwnProperty('content-type')) {
        delete config.headers['content-type']
    }
    return config.headers
}


/***/ }),

/***/ "./src/helpers/url.js":
/*!****************************!*\
  !*** ./src/helpers/url.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildURL: () => (/* binding */ buildURL),
/* harmony export */   combineURLs: () => (/* binding */ combineURLs),
/* harmony export */   isAbsoluteURL: () => (/* binding */ isAbsoluteURL),
/* harmony export */   transformURL: () => (/* binding */ transformURL)
/* harmony export */ });
/* harmony import */ var _util__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./util */ "./src/helpers/util.js");
/* harmony import */ var _data__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./data */ "./src/helpers/data.js");
/* 处理url相关函数 */



// 转换来自query的参数
const transformURL = (config) => {
    let { baseUrl, url, params } = config;
    if (!isAbsoluteURL(url) && baseUrl) {
        url = combineURLs(baseUrl, url)
    }
    return buildURL(url, params);
}

// 判断是否绝对地址
function isAbsoluteURL(url) {
    // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
    // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
    // by any combination of letters, digits, plus, period, or hyphen.
    return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}


/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 *
 * @returns {string} The combined URL
 */
function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
}

// 构建url
const buildURL = (url, params) => {
    if ((0,_util__WEBPACK_IMPORTED_MODULE_0__.isEmpty)(params)) {
        return url
    }
    // 定义一个变量，用来保存最终拼接后的参数
    let serializedParams = (0,_data__WEBPACK_IMPORTED_MODULE_1__.transformRequestData)(params, 'query')
    if (serializedParams) {
        // 处理 hash 的情况
        const markIndex = url.indexOf('#')
        if (markIndex !== -1) {
            url = url.slice(0, markIndex)
        }
        // 处理，如果传入已经带有参数，则拼接在其后面，否则要手动添加上一个 ?
        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams
    }
    // 输出完整的 URL
    return url
}

/***/ }),

/***/ "./src/helpers/util.js":
/*!*****************************!*\
  !*** ./src/helpers/util.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   blobToText: () => (/* binding */ blobToText),
/* harmony export */   each: () => (/* binding */ each),
/* harmony export */   extend: () => (/* binding */ extend),
/* harmony export */   getCharset: () => (/* binding */ getCharset),
/* harmony export */   getTimeout: () => (/* binding */ getTimeout),
/* harmony export */   getType: () => (/* binding */ getType),
/* harmony export */   isEmpty: () => (/* binding */ isEmpty),
/* harmony export */   isJson: () => (/* binding */ isJson),
/* harmony export */   isNumeric: () => (/* binding */ isNumeric),
/* harmony export */   isObject: () => (/* binding */ isObject),
/* harmony export */   isPlainObject: () => (/* binding */ isPlainObject),
/* harmony export */   merge: () => (/* binding */ merge)
/* harmony export */ });
/* 通用工具类 */
// 获取对象类型
function getType(value, toLower = true) {
    let result = Object.prototype.toString.call(value).slice(8, -1);
    if (toLower) {
        result = result.toLowerCase();
    }
    return result;
}

// 是否是数字
function isNumeric(checkValue, isStrict = false) {
    // 修复数组被当作数字问题['123'] == 123
    if (!['string', 'number'].includes(getType(checkValue)) || checkValue === '') {
        return false;
    }
    return isStrict ? checkValue === checkValue - 0 : checkValue == checkValue - 0;
}

// 判断是否为空
function isEmpty(checkValue, isStrict = false) {
    if (null === checkValue) {
        return true;
    } else if (typeof checkValue === 'object') {
        let result = true;
        if (!!Object.getPrototypeOf(checkValue)) {
            if (Object.getPrototypeOf(checkValue).hasOwnProperty('entries')) {
                for (let [key, item] of checkValue.entries()) {
                    result = false;
                    break;
                }
            } else if (checkValue.constructor.hasOwnProperty('entries')) {
                for (let [key, item] of Object.entries(checkValue)) {
                    result = false;
                    break;
                }
            }
            else if (checkValue.hasOwnProperty('length') || Object.getPrototypeOf(checkValue).hasOwnProperty("length")) {
                result = checkValue.length === 0
            }
            else {
                console.warn({
                    msg: 'isEmpty Exception',
                    data: checkValue
                })
                // 检测失败，不在定义范围
                result = undefined;
            }
        }
        else {
            try {
                if (Object.keys(checkValue).length > 0) {
                    result = false;
                }
            }
            catch (e) {

            }
        }
        return result;
    } else if (checkValue === 0 || checkValue === '0') {
        return isStrict ? checkValue === 0 : true;
    } else {
        return !checkValue;
    }
}

// 是否是json字符串
function isJson(checkValue, backJson = false) {
    if (typeof checkValue === 'string') {
        try {
            let result = JSON.parse(checkValue);
            return backJson ? result : true;
        } catch (e) { }
    }
    return false;
}


// 是否是对象
function isObject(checkValue) {
    return getType(checkValue, false) === 'Object';
}

// 判断是否普通对象
function isPlainObject(checkValue) {
    if (getType(checkValue, false) !== 'Object') {
        return false;
    }

    let prototype = Object.getPrototypeOf(checkValue);
    return prototype === null || prototype === Object.prototype;
}

// 对象遍历
function each(obj, callback) {
    if (typeof obj === 'object') {
        if (Object.getPrototypeOf(obj).hasOwnProperty('entries')) {
            for (let [key, item] of obj.entries()) {
                if (callback.call(item, key, item) === false) {
                    break;
                }
            }
        } else if (obj.constructor.hasOwnProperty('entries')) {
            for (let [key, item] of Object.entries(obj)) {
                if (callback.call(item, key, item) === false) {
                    break;
                }
            }
        }
        else if (Object.getPrototypeOf(obj).hasOwnProperty("length")) {
            let key = 0;
            for (let item of obj) {
                if (callback.call(item, key++, item) === false) {
                    break;
                }
            }
        }
        else {
            return false
        }
        return true
    }
    return false
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(...args/* obj1, obj2, obj3, ... */) {
    var result = {};

    function assignValue(key, val) {
        if (isPlainObject(result[key]) && isPlainObject(val)) {
            result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
            result[key] = merge({}, val);
        } else if (Array.isArray(val)) {
            result[key] = val.slice();
        } else {
            result[key] = val;
        }
    }

    for (var i = 0, l = args.length; i < l; i++) {
        each(args[i], assignValue);
    }
    return result;
}


// blob转字符串
function blobToText(blob, charset = 'UTF-8') {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = function (e) {
            resolve(reader.result)
        }
        reader.readAsText(blob, charset)
    })
}

// 获取编码
function getCharset(config, responseHeaders) {
    let charCode = config.charset;
    if (responseHeaders.hasOwnProperty('content-type') && /charset\s*=\s*([a-zA-Z\-\d]*);?/i.test(responseHeaders['content-type'])) {
        charCode = RegExp.$1;
    }
    return charCode
}

// 获取超时
function getTimeout(timeout) {
    timeout = timeout < 100 ? timeout * 1000 : timeout;
    if (timeout < 1) {
        timeout = 1
    }
    return timeout
}

// 继承
function extend(to, from, ctx) {
    // 继承方法
    Object.getOwnPropertyNames(from).forEach((key) => {
        to[key] = from[key].bind(ctx);
    });
    // 继承 ctx 自身属性（不继承原型链上属性，因此需要 hasOwnProperty 进行判断）
    for (let val in ctx) {
        if (ctx.hasOwnProperty(val)) {
            to[val] = ctx[val];
        }
    }
    return to;
}

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _core_HttpRequest__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core/HttpRequest */ "./src/core/HttpRequest.js");
/* harmony import */ var _helpers_util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./helpers/util */ "./src/helpers/util.js");
/* harmony import */ var _cancel_cancelToken__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./cancel/cancelToken */ "./src/cancel/cancelToken.js");
/* harmony import */ var _cancel_cancel__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./cancel/cancel */ "./src/cancel/cancel.js");
// 入口文件






function createInstance(initConfig) {
  const context = new _core_HttpRequest__WEBPACK_IMPORTED_MODULE_0__["default"](initConfig);

  const instance = _core_HttpRequest__WEBPACK_IMPORTED_MODULE_0__["default"].prototype.request.bind(context);

  (0,_helpers_util__WEBPACK_IMPORTED_MODULE_1__.extend)(instance, _core_HttpRequest__WEBPACK_IMPORTED_MODULE_0__["default"].prototype, context);

  return instance;
}

// 默认配置
const defaultConfig = {
  baseUrl: '', // 根域名
  url: '', // 实际请求地址，如果不是http|https等完整开头的会自动拼接上baseUrl
  method: "get", // 请求方法
  params: null, // url后面的get参数
  data: null, // get或post的参数会自动处理
  requestType: 'query',
  responseType: null,
  charset: false, // 是否为content-type 加上编码，可选值{true: 'utf-8', false: '不添加', ...其他任意编码字符串}
  engine: 'auto', // 引擎可选值['xhr', 'fetch', 以及自定义函数]不符合可选值如auto则进入自动判断选择
  beforeSend: null, // 发送前的函数回调，只有是函数才会调用其他参数会被忽略
  //contentType: undefined,
  // xhr或fetch的原生字段
  rawFields: {

  }
};

const bxf = createInstance(defaultConfig);

bxf.CancelToken = _cancel_cancelToken__WEBPACK_IMPORTED_MODULE_2__["default"];
bxf.Cancel = _cancel_cancel__WEBPACK_IMPORTED_MODULE_3__.Cancel;
bxf.isCancel = _cancel_cancel__WEBPACK_IMPORTED_MODULE_3__.isCancel;

bxf.create = function (config) {
  return createInstance((0,_helpers_util__WEBPACK_IMPORTED_MODULE_1__.merge)(defaultConfig, config));
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (bxf);
})();

__webpack_exports__ = __webpack_exports__["default"];
/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7Ozs7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7OztBQ3ZIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7Ozs7OztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDOUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDeEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDNU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7O0FDL01BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ1BBOzs7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vYnhmL3dlYnBhY2svdW5pdmVyc2FsTW9kdWxlRGVmaW5pdGlvbiIsIndlYnBhY2s6Ly9ieGYvLi9zcmMvY2FuY2VsL2NhbmNlbC5qcyIsIndlYnBhY2s6Ly9ieGYvLi9zcmMvY2FuY2VsL2NhbmNlbFRva2VuLmpzIiwid2VicGFjazovL2J4Zi8uL3NyYy9jb3JlL0h0dHBSZXF1ZXN0LmpzIiwid2VicGFjazovL2J4Zi8uL3NyYy9jb3JlL0ludGVyY2VwdG9yTWFuYWdlci5qcyIsIndlYnBhY2s6Ly9ieGYvLi9zcmMvY29yZS9kaXNwYXRjaFJlcXVlc3QuanMiLCJ3ZWJwYWNrOi8vYnhmLy4vc3JjL2NvcmUvZXJyb3IuanMiLCJ3ZWJwYWNrOi8vYnhmLy4vc3JjL2VuZ2luZS9mZXRjaC5qcyIsIndlYnBhY2s6Ly9ieGYvLi9zcmMvZW5naW5lL3hoci5qcyIsIndlYnBhY2s6Ly9ieGYvLi9zcmMvaGVscGVycy9kYXRhLmpzIiwid2VicGFjazovL2J4Zi8uL3NyYy9oZWxwZXJzL2hlYWRlcnMuanMiLCJ3ZWJwYWNrOi8vYnhmLy4vc3JjL2hlbHBlcnMvdXJsLmpzIiwid2VicGFjazovL2J4Zi8uL3NyYy9oZWxwZXJzL3V0aWwuanMiLCJ3ZWJwYWNrOi8vYnhmL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL2J4Zi93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vYnhmL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vYnhmL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vYnhmLy4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiB3ZWJwYWNrVW5pdmVyc2FsTW9kdWxlRGVmaW5pdGlvbihyb290LCBmYWN0b3J5KSB7XG5cdGlmKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0Jylcblx0XHRtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcblx0ZWxzZSBpZih0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpXG5cdFx0ZGVmaW5lKFtdLCBmYWN0b3J5KTtcblx0ZWxzZSBpZih0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpXG5cdFx0ZXhwb3J0c1tcImJ4ZlwiXSA9IGZhY3RvcnkoKTtcblx0ZWxzZVxuXHRcdHJvb3RbXCJieGZcIl0gPSBmYWN0b3J5KCk7XG59KSh0aGlzLCAoKSA9PiB7XG5yZXR1cm4gIiwiZXhwb3J0IGNsYXNzIENhbmNlbCB7XHJcbiAgICBtZXNzYWdlO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2UpIHtcclxuICAgICAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaXNDYW5jZWwodmFsdWUpIHtcclxuICAgIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENhbmNlbDtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgQ2FuY2VsIiwiaW1wb3J0IENhbmNlbCBmcm9tIFwiLi9jYW5jZWxcIjtcclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ2FuY2VsVG9rZW4ge1xyXG4gICAgcHJvbWlzZTsvLyDlrprkuYkgcHJvbWlzZSDlj5jph4/vvIznlKjmnaXlrZjlgqjnirbmgIFcclxuICAgIHJlYXNvbjsgLy8g5a6a5LmJ6ZSZ6K+v5Y6f5Zug5Y+Y6YePXHJcblxyXG4gICAgY29uc3RydWN0b3IoZXhlY3V0b3IpIHtcclxuICAgICAgICAvLyDlrprkuYnkuIDkuKrnqbrlj5jph4/vvIznlKjlroPmnaXlrZjlgqjkuIDkuKogcHJvbWlzZSDlrp7kvovnmoQgcmVzb2x2ZSDmlrnms5VcclxuICAgICAgICBsZXQgcmVzb2x2ZVByb21pc2U7XHJcbiAgICAgICAgdGhpcy5wcm9taXNlID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XHJcbiAgICAgICAgICAgIHJlc29sdmVQcm9taXNlID0gcmVzb2x2ZVxyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIGNvbnN0IHBhcmFtRm4gPSBtZXNzYWdlID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMucmVhc29uKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLnJlYXNvbiA9IG5ldyBDYW5jZWwobWVzc2FnZSlcclxuICAgICAgICAgICAgcmVzb2x2ZVByb21pc2UodGhpcy5yZWFzb24pXHJcbiAgICAgICAgfTtcclxuICAgICAgICAvLyDmiafooYzlrp7kvovljJbml7bkvKDlhaXnmoTmlrnms5XvvIzlubbkvb/nlKggcGFyYW1GbiDkvZzkuLrlj4LmlbDkvKDlhaVcclxuICAgICAgICBleGVjdXRvcihwYXJhbUZuKVxyXG4gICAgfVxyXG5cclxuICAgIHRocm93SWZSZXF1ZXN0ZWQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMucmVhc29uKSB7XHJcbiAgICAgICAgICAgIHRocm93IHRoaXMucmVhc29uXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8g5a6a5LmJIHNvdXJjZSDpnZnmgIHmlrnms5XvvIzlr7zlh7ogQ2FuY2VsVG9rZW4g5a6e5L6L5Lul5Y+K5Y+W5raI5pa55rOVIGNhbmNlbFxyXG4gICAgc3RhdGljIHNvdXJjZSgpIHtcclxuICAgICAgICBsZXQgY2FuY2VsO1xyXG4gICAgICAgIGNvbnN0IHRva2VuID0gbmV3IENhbmNlbFRva2VuKGMgPT4ge1xyXG4gICAgICAgICAgICBjYW5jZWwgPSBjXHJcbiAgICAgICAgfSlcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBjYW5jZWwsXHJcbiAgICAgICAgICAgIHRva2VuXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsIi8vIOWtmOaUvkh0dHBSZXF1ZXN057G7XHJcbmltcG9ydCB7ZGlzcGF0Y2hSZXF1ZXN0LCBwcm9jZXNzQ29uZmlnfSBmcm9tIFwiLi9kaXNwYXRjaFJlcXVlc3RcIlxyXG5pbXBvcnQgeyBpc0VtcHR5IH0gZnJvbSBcIi4uL2hlbHBlcnMvdXRpbFwiXHJcbmltcG9ydCBJbnRlcmNlcHRvck1hbmFnZXIgZnJvbSBcIi4vSW50ZXJjZXB0b3JNYW5hZ2VyXCJcclxuY2xhc3MgSHR0cFJlcXVlc3Qge1xyXG4gICAgLy8g55So5p2l5a2Y5YKo6YWN572u5L+h5oGvXHJcbiAgICBjb25maWcgPSB7fVxyXG4gICAgY29uc3RydWN0b3IoaW5pdENvbmZpZykge1xyXG4gICAgICAgIC8vIOWunuS+i+WMluaXtuaOpeaUtuS4gOS4qumFjee9ruS/oeaBryzlubbkv53lrZjliLBjb25maWflsZ7mgKfkuK1cclxuICAgICAgICB0aGlzLmNvbmZpZyA9IGluaXRDb25maWc7XHJcbiAgICAgICAgLy8g5oum5oiq5Zmo5a+56LGh5Lit5YyF5ZCr77yacmVxdWVzdOaLpuaIquWZqOS7peWPinJlc3BvbnNl5oum5oiq5ZmoXHJcbiAgICAgICAgdGhpcy5pbnRlcmNlcHRvcnMgPSB7XHJcbiAgICAgICAgICAgIHJlcXVlc3Q6IG5ldyBJbnRlcmNlcHRvck1hbmFnZXIoKSxcclxuICAgICAgICAgICAgcmVzcG9uc2U6IG5ldyBJbnRlcmNlcHRvck1hbmFnZXIoKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyDor6XnsbvmnInkuIDkuKpyZXF1ZXN05pa55rOVLOWug+WPr+S7peeUqOadpeWPkemAgeivt+axglxyXG4gICAgcmVxdWVzdChjb25maWcsIHByaW50Q29uZmlnID0gZmFsc2UpIHtcclxuICAgICAgICBpZiAoaXNFbXB0eShjb25maWcpKSB7XHJcbiAgICAgICAgICAgIGxldCBlcnIgPSBUeXBlRXJyb3IoJ+mFjee9ruWPguaVsOmUmeivr+aIluW3suiiq+ivt+axguaLpuaIqizor7fmo4Dmn6Xku6PnoIEnKVxyXG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKVxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyDlpITnkIbkvKDlhaXnmoTphY3nva5cclxuICAgICAgICBjb25maWcgPSBwcm9jZXNzQ29uZmlnKGNvbmZpZyk7XHJcbiAgICAgICAgaWYgKHByaW50Q29uZmlnKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoY29uZmlnKVxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyDlrprkuYnkuIDkuKrmlbDnu4TvvIzmlbDnu4TkuK3mlL7lhaXvvIzkvJrlj5HpgIHnnJ/lrp7or7fmsYLnmoTlr7nosaHvvIzlj6/ku6Xmg7PosaHmiJDlroPkuZ/mmK/kuIDkuKrmi6bmiKrlmahcclxuICAgICAgICBjb25zdCBjaGFpbiA9IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZWQ6IGRpc3BhdGNoUmVxdWVzdCxcclxuICAgICAgICAgICAgICAgIHJlamVjdGVkOiB1bmRlZmluZWRcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIF1cclxuICAgICAgICAvLyDlvZPnlKjmiLfkvb/nlKggYXhpb3MuaW50ZXJjZXB0b3JzLnJlcXVlc3QudXNlKC4uLikg5o6o5YWl5LqG5aSa5Liq6K+35rGC5oum5oiq5Zmo5pe2XHJcbiAgICAgICAgLy8gdGhpcy5pbnRlcmNlcHRvcnMucmVxdWVzdCDov5nph4zpnaLlsLHmnInlpJrkuKrmi6bmiKrlmajvvIzpgJrov4fpgY3ljobmi6bmiKrlmajvvIzmj5LlhaUgY2hhaW4g5pWw57uE55qE5YmN6Z2iXHJcbiAgICAgICAgdGhpcy5pbnRlcmNlcHRvcnMucmVxdWVzdC5mb3JFYWNoKGludGVyY2VwdG9yID0+IHtcclxuICAgICAgICAgICAgY2hhaW4udW5zaGlmdChpbnRlcmNlcHRvcilcclxuICAgICAgICB9KVxyXG4gICAgICAgIC8vIOW9k+eUqOaIt+S9v+eUqCBheGlvcy5pbnRlcmNlcHRvcnMucmVzcG9uc2UudXNlKC4uLikg5o6o5YWl5aSa5Liq5ZON5bqU5oum5oiq5Zmo5pe2XHJcbiAgICAgICAgLy8gdGhpcy5pbnRlcmNlcHRvcnMucmVzcG9uc2Ug6L+Z6YeM6Z2i5bCx5pyJ5aSa5Liq5oum5oiq5Zmo77yM6YCa6L+H6YGN5Y6G5oum5oiq5Zmo77yM5o+S5YWlIGNoYWluIOaVsOe7hOeahOWQjumdolxyXG4gICAgICAgIHRoaXMuaW50ZXJjZXB0b3JzLnJlc3BvbnNlLmZvckVhY2goaW50ZXJjZXB0b3IgPT4ge1xyXG4gICAgICAgICAgICBjaGFpbi5wdXNoKGludGVyY2VwdG9yKVxyXG4gICAgICAgIH0pXHJcblxyXG4gICAgICAgIC8vIC8vIOatpOaXtueahCBjaGFpbiDlupTor6XmmK/ov5nmoLfnmoRcclxuICAgICAgICAvLyBbXHJcbiAgICAgICAgLy8gICAgIHtcclxuICAgICAgICAvLyAgICAgICAgIHJlc29sdmVkOiAoY29uZmlnKSA9PiB7LyouLi4qLyB9LCAvLyDnlKjmiLfoh6rlrprkuYnor7fmsYLmi6bmiKrlmahcclxuICAgICAgICAvLyAgICAgICAgIHJlamVjdGVkOiAoY29uZmlnKSA9PiB7LyouLi4qLyB9XHJcbiAgICAgICAgLy8gICAgIH0sXHJcbiAgICAgICAgLy8gICAgIC8qLi4uKi9cclxuICAgICAgICAvLyAgICAge1xyXG4gICAgICAgIC8vICAgICAgICAgcmVzb2x2ZWQ6IGRpc3BhdGNoUmVxdWVzdCxcclxuICAgICAgICAvLyAgICAgICAgIHJlamVjdGVkOiB1bmRlZmluZWRcclxuICAgICAgICAvLyAgICAgfSxcclxuICAgICAgICAvLyAgICAgLyouLi4qL1xyXG4gICAgICAgIC8vICAgICB7XHJcbiAgICAgICAgLy8gICAgICAgICByZXNvbHZlZDogKHJlcykgPT4gey8qLi4uKi8gfSwgLy8g55So5oi36Ieq5a6a5LmJ5ZON5bqU5oum5oiq5ZmoXHJcbiAgICAgICAgLy8gICAgICAgICByZWplY3RlZDogKHJlcykgPT4gey8qLi4uKi8gfVxyXG4gICAgICAgIC8vICAgICB9LFxyXG4gICAgICAgIC8vIF1cclxuXHJcblxyXG4gICAgICAgIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKGNvbmZpZylcclxuICAgICAgICAvLyDlpoLmnpwgY2hhaW4g5pWw57uE5Lit5pyJ5YC85bCx6L+b5YWl5b6q546v6YGN5Y6GXHJcbiAgICAgICAgd2hpbGUgKGNoYWluLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAvLyDmr4/mrKHlj5blh7rmlbDnu4TnmoTnrKzkuIDkuKrlhYPntKDvvIzlubbku47mlbDnu4TkuK3liKDpmaRcclxuICAgICAgICAgICAgY29uc3QgeyByZXNvbHZlZCwgcmVqZWN0ZWQgfSA9IGNoYWluLnNoaWZ0KCk7XHJcbiAgICAgICAgICAgIC8vIHByb21pc2Ug5aSN5Yi25Li65LiL5LiA5qyhIHByb21pc2UudGhlbu+8jOWunueOsOaLpuaIquWZqOmTvuW8j+S8oOmAklxyXG4gICAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKHJlc29sdmVkLCByZWplY3RlZClcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8g5pyA57uI5YWo6YOo5omn6KGM5a6M5oiQ5LmL5ZCO77yM6L+U5Zue5pyA5ZCO55qE5omn6KGM57uT5p6cXHJcbiAgICAgICAgcmV0dXJuIHByb21pc2VcclxuICAgIH1cclxufVxyXG5cclxuLy8g5LiN6ZyA6KaB5bimZGF0YeWPguaVsOeahOaWueazlVxyXG5jb25zdCB3aXRob3V0RGF0YU1ldGhvZHMgPSBbJ2dldCcsICdkZWxldGUnLCAnaGVhZCcsICdvcHRpb25zJ107XHJcbmZvciAobGV0IG1ldGhvZCBvZiB3aXRob3V0RGF0YU1ldGhvZHMpIHtcclxuICAgIEh0dHBSZXF1ZXN0LnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24gKHVybCwgY29uZmlnKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdChPYmplY3QuYXNzaWduKGNvbmZpZyB8fCB7fSwge1xyXG4gICAgICAgICAgICBtZXRob2QsXHJcbiAgICAgICAgICAgIHVybFxyXG4gICAgICAgIH0pKVxyXG4gICAgfVxyXG59XHJcblxyXG4vLyDpnIDopoHluKZkYXRh5Y+C5pWw55qE5pa55rOVXHJcbmNvbnN0IHdpdGhEYXRhTWV0aG9kcyA9IFsncG9zdCcsICdwdXQnLCAncGF0Y2gnXTtcclxuZm9yIChsZXQgbWV0aG9kIG9mIHdpdGhEYXRhTWV0aG9kcykge1xyXG4gICAgSHR0cFJlcXVlc3QucHJvdG90eXBlW21ldGhvZF0gPSBmdW5jdGlvbiAodXJsLCBkYXRhLCBjb25maWcpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KE9iamVjdC5hc3NpZ24oY29uZmlnIHx8IHt9LCB7XHJcbiAgICAgICAgICAgIG1ldGhvZCxcclxuICAgICAgICAgICAgZGF0YSxcclxuICAgICAgICAgICAgdXJsXHJcbiAgICAgICAgfSkpXHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IEh0dHBSZXF1ZXN0IiwiLy8g5oum5oiq5Zmo55u45YWzXHJcbmNsYXNzIEludGVyY2VwdG9yTWFuYWdlciB7XHJcbiAgICAvLyDlrprkuYnkuIDkuKrmlbDnu4TvvIznlKjmnaXlrZjlgqjmi6bmiKrlmahcclxuICAgIGludGVyY2VwdG9ycyA9IFtdO1xyXG5cclxuICAgIHVzZShyZXNvbHZlZCwgcmVqZWN0ZWQpIHtcclxuICAgICAgICAvLyDlkJHmlbDnu4TmjqjlhaXmi6bmiKrlmajlr7nosaFcclxuICAgICAgICB0aGlzLmludGVyY2VwdG9ycy5wdXNoKHtcclxuICAgICAgICAgICAgcmVzb2x2ZWQsXHJcbiAgICAgICAgICAgIHJlamVjdGVkLFxyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLy8g6L+U5Zue5oum5oiq5Zmo5Zyo5pWw57uE5Lit57Si5byVXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuaW50ZXJjZXB0b3JzLmxlbmd0aCAtIDFcclxuICAgIH1cclxuXHJcbiAgICAvLyDpgY3ljobmlbDnu4RcclxuICAgIGZvckVhY2goZm4pIHtcclxuICAgICAgICB0aGlzLmludGVyY2VwdG9ycy5mb3JFYWNoKGludGVyY2VwdG9yID0+IHtcclxuICAgICAgICAgICAgaWYgKGludGVyY2VwdG9yICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBmbihpbnRlcmNlcHRvcilcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIOagueaNrue0ouW8leWIoOmZpOaLpuaIquWZqFxyXG4gICAgZWplY3QoaWQpIHtcclxuICAgICAgICBpZiAodGhpcy5pbnRlcmNlcHRvcnNbaWRdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaW50ZXJjZXB0b3JzW2lkXSA9IG51bGxcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IEludGVyY2VwdG9yTWFuYWdlciIsIi8vIOinpuWPkeivt+axglxyXG5pbXBvcnQgeyBpc0VtcHR5LCBnZXRUeXBlIH0gZnJvbSBcIi4uL2hlbHBlcnMvdXRpbFwiXHJcbmltcG9ydCB7IHRyYW5zZm9ybVJlcXVlc3REYXRhIH0gZnJvbSBcIi4uL2hlbHBlcnMvZGF0YVwiXHJcbmltcG9ydCB7IHRyYW5zZm9ybVVSTCB9IGZyb20gXCIuLi9oZWxwZXJzL3VybFwiXHJcbmltcG9ydCB7dHJhbnNmb3JtSGVhZGVyc30gZnJvbSBcIi4uL2hlbHBlcnMvaGVhZGVyc1wiXHJcbmltcG9ydCB7IGVzRmV0Y2ggfSBmcm9tIFwiLi4vZW5naW5lL2ZldGNoXCJcclxuaW1wb3J0IHsgeGhyIH0gZnJvbSBcIi4uL2VuZ2luZS94aHJcIlxyXG5cclxuXHJcblxyXG5cclxuLy8g6aKE5aSE55CG6YWN572uXHJcbmV4cG9ydCBjb25zdCBwcm9jZXNzQ29uZmlnID0gKGNvbmZpZykgPT4ge1xyXG4gIC8vIOWkhOeQhuivt+axguaWueazlVxyXG4gIGNvbnN0IG1ldGhvZHMgPSBbJ2dldCcsICdwb3N0JywgJ3B1dCcsICdkZWxldGUnLCAnb3B0aW9ucycsICdoZWFkJywgJ3BhdGNoJywgJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUycsICdIRUFEJywgJ1BBVENIJ107XHJcbiAgaWYgKGlzRW1wdHkoY29uZmlnLm1ldGhvZCkgfHwgIW1ldGhvZHMuaW5jbHVkZXMoY29uZmlnLm1ldGhvZCkpIHtcclxuICAgICAgY29uZmlnLm1ldGhvZCA9ICdHRVQnXHJcbiAgfVxyXG4gIC8vIOe7n+S4gOWkhOeQhuS4uuWkp+WGmVxyXG4gIGNvbmZpZy5tZXRob2QgPSBjb25maWcubWV0aG9kLnRvVXBwZXJDYXNlKCk7XHJcblxyXG5cclxuICAvLyDlpITnkIbor7fmsYLkvZPmoLzlvI9cclxuICBsZXQgZGF0YVR5cGUgPSBnZXRUeXBlKGNvbmZpZy5kYXRhKVxyXG4gIGlmIChkYXRhVHlwZSA9PSAnZm9ybWRhdGEnKSB7XHJcbiAgICAgIGNvbmZpZy5yZXF1ZXN0VHlwZSA9ICdmb3JtZGF0YSdcclxuICB9XHJcbiAgZWxzZSB7XHJcbiAgICAgIGlmIChkYXRhVHlwZSA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgIGNvbmZpZy5kYXRhID0gbnVsbFxyXG4gICAgICB9XHJcbiAgICAgIGlmICghaXNFbXB0eShjb25maWcucmVxdWVzdFR5cGUpKSB7XHJcbiAgICAgICAgICBjb25maWcucmVxdWVzdFR5cGUgPSBjb25maWcucmVxdWVzdFR5cGUudG9Mb3dlckNhc2UoKVxyXG4gICAgICAgICAgaWYgKCFbJ3F1ZXJ5JywgJ2pzb24nLCAnZm9ybScsICdmb3JtZGF0YSddLmluY2x1ZGVzKGNvbmZpZy5yZXF1ZXN0VHlwZSkpIHtcclxuICAgICAgICAgICAgICBjb25maWcucmVxdWVzdFR5cGUgPSAncXVlcnknXHJcbiAgICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgICBjb25maWcucmVxdWVzdFR5cGUgPSAncXVlcnknXHJcbiAgICAgIH1cclxuICB9XHJcblxyXG5cclxuICAvLyDlpITnkIbor7fmsYLkvZPvvIjlv4XpobvkvY3kuo7lpITnkIZ1cmzliY3vvIzmiY3og73mraPnoa7ovazmjaJkYXRh5ZKMcGFyYW1z5re355So77yJXHJcbiAgaWYgKFsnR0VUJywgJ0RFTEVURScsICdIRUFEJ10uaW5jbHVkZXMoY29uZmlnLm1ldGhvZCkpIHtcclxuICAgICAgaWYgKCFjb25maWcuaGFzT3duUHJvcGVydHkoJ3BhcmFtcycpICYmICFpc0VtcHR5KGNvbmZpZy5kYXRhKSkge1xyXG4gICAgICAgICAgY29uZmlnLnBhcmFtcyA9IGNvbmZpZy5kYXRhXHJcbiAgICAgICAgICBjb25maWcuZGF0YSA9IG51bGxcclxuICAgICAgfVxyXG4gIH1cclxuICBlbHNlIHtcclxuICAgICAgY29uZmlnLmRhdGEgPSB0cmFuc2Zvcm1SZXF1ZXN0RGF0YShjb25maWcuZGF0YSwgY29uZmlnLnJlcXVlc3RUeXBlKVxyXG4gIH1cclxuXHJcblxyXG4gIC8vIOWkhOeQhnVybFxyXG4gIGNvbmZpZy51cmwgPSB0cmFuc2Zvcm1VUkwoY29uZmlnKVxyXG4gIGNvbmZpZy5wYXJhbXMgPSBudWxsXHJcblxyXG4gIC8vIOWkhOeQhuivt+axguWktFxyXG4gIGNvbmZpZy5oZWFkZXJzID0gdHJhbnNmb3JtSGVhZGVycyhjb25maWcpXHJcbiAgXHJcblxyXG4gIC8vIOWkhOeQhuivt+axguW8leaTjlxyXG4gIGNvbmZpZy5lbmdpbmUgPSBnZXRFbmdpbmUoY29uZmlnKVxyXG5cclxuXHJcbiAgcmV0dXJuIGNvbmZpZztcclxufVxyXG5cclxuXHJcbi8vIOiOt+WPlumAgumFjeWZqO+8jOmAmui/h+WIpOaWreaYr+WQpuaciSBYTUxIdHRwUmVxdWVzdCDmnaXliKTmlq3mmK/mma7pgJp3ZWLov5jmmK/mtY/op4jlmajmj5Lku7ZNVjMs5YaN6L+b6KGMeGhy5oiWZmV0Y2jnmoTpgInmi6lcclxuY29uc3QgZ2V0RW5naW5lID0gKGNvbmZpZykgPT4ge1xyXG4gIC8vIOWIpOaWreWkhOeQhuivt+axguW8leaTjumXrumimFxyXG4gIGxldCBlbmdpbmUgPSBjb25maWcuZW5naW5lLCBlbmdpbmVUeXBlID0gZ2V0VHlwZShlbmdpbmUpO1xyXG4gIFxyXG4gIC8vIOWmguaenOayoeacieS8oOWFpeivt+axguW8leaTjuaIluivt+axguW8leaTjuS4jeaYr+aIkeS7rOWumuS5ieeahOWImeeUseaIkeS7rOiHquihjOWIpOaWreiwg+eUqOm7mOiupOW8leaTjlxyXG4gIGlmIChlbmdpbmVUeXBlID09PSAndW5kZWZpbmVkJyB8fCAoZW5naW5lVHlwZSA9PT0gJ2Z1bmN0aW9uJyAmJiBlbmdpbmUubmFtZSAmJiAhWydYTUxIdHRwUmVxdWVzdCcsICdmZXRjaCddLmluY2x1ZGVzKGVuZ2luZS5uYW1lKSkpIHtcclxuICAgIGlmICh0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgZW5naW5lID0gJ3hocidcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICBlbmdpbmUgPSAnZmV0Y2gnXHJcbiAgICB9XHJcbiAgICBlbmdpbmVUeXBlID0gJ3N0cmluZydcclxuICB9XHJcbiAgXHJcbiAgaWYgKGVuZ2luZVR5cGUgPT0gJ3N0cmluZycpIHtcclxuICAgICAgLy8g57uf5LiA6L2s5o2i5Li65bCP5YaZXHJcbiAgICAgIGVuZ2luZSA9IGVuZ2luZS50b0xvd2VyQ2FzZSgpXHJcbiAgICAgIGlmIChlbmdpbmUgPT0gJ3hocicgJiYgdHlwZW9mIFhNTEh0dHBSZXF1ZXN0ID09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICBjb25maWcuZW5naW5lID0gWE1MSHR0cFJlcXVlc3RcclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICBjb25maWcuZW5naW5lID0gdHlwZW9mIGZldGNoID09ICdmdW5jdGlvbic/IGZldGNoOiBYTUxIdHRwUmVxdWVzdFxyXG4gICAgICB9XHJcbiAgfVxyXG5cclxuICBcclxuICByZXR1cm4gY29uZmlnLmVuZ2luZVxyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGRpc3BhdGNoUmVxdWVzdCA9IChjb25maWcpID0+IHtcclxuICAvLyBpZiAoaXNFbXB0eShjb25maWcpKSB7XHJcbiAgLy8gICBsZXQgZXJyID0gVHlwZUVycm9yKCfphY3nva7lj4LmlbDplJnor6/miJblt7Looqvor7fmsYLmi6bmiKos6K+35qOA5p+l5Luj56CBJylcclxuICAvLyAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpXHJcbiAgLy8gfVxyXG4gIC8vIC8vIOWkhOeQhuS8oOWFpeeahOmFjee9rlxyXG4gIC8vIGNvbmZpZyA9IHByb2Nlc3NDb25maWcoY29uZmlnKTtcclxuXHJcbiAgLy8g5Yik5pat5bm26LCD55So6K+35rGC5byV5pOOXHJcbiAgaWYgKGdldFR5cGUoY29uZmlnLmVuZ2luZSkgPT0gJ2Z1bmN0aW9uJyAmJiBjb25maWcuZW5naW5lLm5hbWUgPT09ICdmZXRjaCcpIHtcclxuICAgIHJldHVybiBlc0ZldGNoKGNvbmZpZykgXHJcbiAgfVxyXG4gIGVsc2Uge1xyXG4gICAgcmV0dXJuIHhocihjb25maWcpXHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkaXNwYXRjaFJlcXVlc3Q7IiwiZXhwb3J0IGNsYXNzIEh0dHBSZXF1ZXN0RXJyb3IgZXh0ZW5kcyBFcnJvciB7XHJcbiAgICBpc0h0dHBSZXF1ZXN0RXJyb3I7XHJcbiAgICBjb25maWc7XHJcbiAgICBjb2RlO1xyXG4gICAgcmVxdWVzdDtcclxuICAgIHJlc3BvbnNlO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvbmZpZywgY29kZSwgcmVxdWVzdCwgcmVzcG9uc2UpIHtcclxuICAgICAgICBzdXBlcihtZXNzYWdlKTtcclxuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcclxuICAgICAgICB0aGlzLmNvZGUgPSBjb2RlO1xyXG4gICAgICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3Q7XHJcbiAgICAgICAgdGhpcy5yZXNwb25zZSA9IHJlc3BvbnNlO1xyXG4gICAgICAgIHRoaXMuaXNIdHRwUmVxdWVzdEVycm9yID0gdHJ1ZTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVycm9yKG1lc3NhZ2UsIGNvbmZpZywgY29kZSwgcmVxdWVzdCwgcmVzcG9uc2UpIHtcclxuICAgIHJldHVybiBuZXcgSHR0cFJlcXVlc3RFcnJvcihtZXNzYWdlLCBjb25maWcsIGNvZGUsIHJlcXVlc3QsIHJlc3BvbnNlKTtcclxufSIsIi8vIOa1j+iniOWZqCBmZXRjaCDor7fmsYJcclxuaW1wb3J0IHsgaXNKc29uLCBpc051bWVyaWMsIGVhY2gsIGlzRW1wdHksIGdldFR5cGUsIGJsb2JUb1RleHQsIGdldENoYXJzZXQsIGdldFRpbWVvdXQgfSBmcm9tIFwiLi4vaGVscGVycy91dGlsXCJcclxuaW1wb3J0IHsgY3JlYXRlRXJyb3IgfSBmcm9tIFwiLi4vY29yZS9lcnJvclwiO1xyXG5leHBvcnQgY29uc3QgZXNGZXRjaCA9IChjb25maWcpID0+IHtcclxuICAgIC8vIOacgOe7iOivt+axgumFjee9ruWPguaVsFxyXG4gICAgY29uc3Qgb3B0aW9ucyA9IHt9XHJcbiAgICAgICAgLCBkZWZhdWx0RmllbGQgPSB7XHJcbiAgICAgICAgICAgIG1ldGhvZDogJ21ldGhvZCcsXHJcbiAgICAgICAgICAgIGJvZHk6ICdkYXRhJyxcclxuICAgICAgICAgICAgaGVhZGVyczogJ2hlYWRlcnMnLFxyXG4gICAgICAgIH1cclxuICAgIC8vIOWkhOeQhui2heaXtlxyXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcclxuICAgIG9wdGlvbnMuc2lnbmFsID0gY29udHJvbGxlci5zaWduYWw7XHJcbiAgICBsZXQgYWJvcnRNc2cgPSAnJywgYWJvcnRUaW1lciA9IG51bGw7XHJcbiAgICBpZiAoY29uZmlnLmhhc093blByb3BlcnR5KCd0aW1lb3V0JykgJiYgaXNOdW1lcmljKGNvbmZpZy50aW1lb3V0KSAmJiBjb25maWcudGltZW91dCA+IDApIHtcclxuICAgICAgICAvLyBvcHRpb25zLnNpZ25hbCA9IEFib3J0U2lnbmFsLnRpbWVvdXQoZ2V0VGltZW91dChjb25maWcudGltZW91dCkpXHJcbiAgICAgICAgYWJvcnRUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICBhYm9ydE1zZyA9ICdzaWduYWwgdGltZWQgb3V0J1xyXG4gICAgICAgICAgICBjb250cm9sbGVyLmFib3J0KCk7XHJcbiAgICAgICAgfSwgZ2V0VGltZW91dChjb25maWcudGltZW91dCkpXHJcbiAgICB9XHJcblxyXG4gICAgLy8g6YGN5Y6G5ZCI5rOV5Y+C5pWwXHJcbiAgICBlYWNoKGRlZmF1bHRGaWVsZCwgZnVuY3Rpb24gKGtleSwgaXRlbSkge1xyXG4gICAgICAgIGlmIChjb25maWcuaGFzT3duUHJvcGVydHkoaXRlbSkpIHtcclxuICAgICAgICAgICAgb3B0aW9uc1trZXldID0gY29uZmlnW2l0ZW1dXHJcbiAgICAgICAgfVxyXG4gICAgfSlcclxuXHJcbiAgICAvLyDlpITnkIbljp/nlJ/lj4LmlbBcclxuICAgIGlmIChjb25maWcuaGFzT3duUHJvcGVydHkoJ3Jhd0ZpZWxkcycpICYmIGdldFR5cGUoY29uZmlnLnJhd0ZpZWxkcykgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgZWFjaChjb25maWcucmF3RmllbGRzLCBmdW5jdGlvbiAoa2V5LCBpdGVtKSB7XHJcbiAgICAgICAgICAgIG9wdGlvbnNba2V5XSA9IGl0ZW1cclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgLy8g5Yik5pat5piv5ZCm5pyJ5a6a5LmJ5Y+W5raI6K+35rGCXHJcbiAgICBpZiAoY29uZmlnLmNhbmNlbFRva2VuKSB7XHJcbiAgICAgICAgY29uZmlnLmNhbmNlbFRva2VuLnByb21pc2VcclxuICAgICAgICAgICAgLnRoZW4oKHJlYXNvbikgPT4ge1xyXG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGFib3J0VGltZXIpIC8vIOa4hemZpOS4reaWreWumuaXtuWZqFxyXG4gICAgICAgICAgICAgICAgYWJvcnRNc2cgPSAnVGhlIHVzZXIgYWJvcnRlZCBhIHJlcXVlc3QnXHJcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyLmFib3J0KCk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5jYXRjaCgoKSA9PiB7IH0pO1xyXG4gICAgfVxyXG4gICAgLy8g5Y+R6YCB5YmN5Zue6LCD6YCa55+lXHJcbiAgICBpZiAoZ2V0VHlwZShjb25maWcuYmVmb3JlU2VuZCkgPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIGxldCBiZWZvcmVTZW5kUmVzID0gY29uZmlnLmJlZm9yZVNlbmQoY29uZmlnKTtcclxuICAgICAgICBpZiAoYmVmb3JlU2VuZFJlcyA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCfooqtiZWZvcmVTZW5k5oum5oiqJylcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY29uZmlnLmVuZ2luZS5iaW5kKGdsb2JhbFRoaXMpKGNvbmZpZy51cmwsIG9wdGlvbnMpLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIGNsZWFyVGltZW91dChhYm9ydFRpbWVyKSAvLyDmuIXpmaTkuK3mlq3lrprml7blmahcclxuICAgICAgICBjb25zdCByZXN1bHQgPSB7XHJcbiAgICAgICAgICAgIGRhdGE6IG51bGwsIC8vIOWTjeW6lOWGheWuuVxyXG4gICAgICAgICAgICByZXNwb25zZVRleHQ6IG51bGwsIC8vIOWTjeW6lOWOn+Wni+Wtl+espuS4slxyXG4gICAgICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cywgLy8g54q25oCB56CBXHJcbiAgICAgICAgICAgIHN0YXR1c1RleHQ6IHJlc3BvbnNlLnN0YXR1c1RleHQsIC8vIOeKtuaAgeaPj+i/sFxyXG4gICAgICAgICAgICBoZWFkZXJzOiB7fSwgLy8g5ZON5bqU5aS0XHJcbiAgICAgICAgICAgIGNvbmZpZywgLy8g6K+35rGC6YWN572uXHJcbiAgICAgICAgICAgIHJlc3BvbnNlOiByZXNwb25zZS5jbG9uZSgpLFxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyDpgY3ljobor7fmsYLlpLRcclxuICAgICAgICByZXNwb25zZS5oZWFkZXJzLmZvckVhY2goKGl0ZW0sIGtleSkgPT4ge1xyXG4gICAgICAgICAgICByZXN1bHQuaGVhZGVyc1trZXldID0gaXRlbTtcclxuICAgICAgICB9KVxyXG5cclxuICAgICAgICAvLyDlk43lupTovpPlh7rlpITnkIZcclxuICAgICAgICBjb25zdCByZXNwb25zZUZpbmFsUHJvY2VzcyA9ICgpID0+IHtcclxuICAgICAgICAgICAgLy8g5aaC5p6c54q25oCB56CB5ZyoIDIwMC0zMDAg5LmL6Ze05q2j5bi4IHJlc29sdmXvvIzlkKbliJkgcmVqZWN0IOmUmeivr1xyXG4gICAgICAgICAgICBpZiAocmVzdWx0LnN0YXR1cyA+PSAyMDAgJiYgcmVzdWx0LnN0YXR1cyA8IDMwMCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChcclxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVFcnJvcihcclxuICAgICAgICAgICAgICAgICAgICAgICAgYFJlcXVlc3QgZmFpbGVkIHdpdGggc3RhdHVzIGNvZGUgJHtyZXN1bHQuc3RhdHVzfWAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0XHJcbiAgICAgICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2VUeXBlID0gY29uZmlnLnJlc3BvbnNlVHlwZSA9PSAnYmxvYlRleHQnID8gJ2Jsb2InIDogY29uZmlnLnJlc3BvbnNlVHlwZVxyXG4gICAgICAgIC8vIOacgOe7iOe7k+aenOWTjeW6lOi+k+WHulxyXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlT3V0cHV0ID0gKHRleHQpID0+IHtcclxuICAgICAgICAgICAgbGV0IGRhdGEgPSB0ZXh0XHJcbiAgICAgICAgICAgIGlmIChpc0pzb24odGV4dCkpIHtcclxuICAgICAgICAgICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKHRleHQpXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2VUeXBlID09ICdqc29uJykge1xyXG4gICAgICAgICAgICAgICAgICAgIGRhdGEgPSB7fVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlc3VsdC5kYXRhID0gZGF0YVxyXG4gICAgICAgICAgICByZXN1bHQucmVzcG9uc2VUZXh0ID0gdGV4dDtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlRmluYWxQcm9jZXNzKClcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlc3BvbnNlVHlwZSAhPSAnanNvbicgJiYgdHlwZW9mIHJlc3BvbnNlW3Jlc3BvbnNlVHlwZV0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlW3Jlc3BvbnNlVHlwZV0oKS50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5yZXNwb25zZVR5cGUgPT0gJ2Jsb2JUZXh0Jykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBibG9iVG9UZXh0KGRhdGEsIGdldENoYXJzZXQoY29uZmlnLCByZXN1bHQuaGVhZGVycykpLnRoZW4ocmVzcG9uc2VPdXRwdXQpXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQuZGF0YSA9IGRhdGFcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VGaW5hbFByb2Nlc3MoKVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnRleHQoKS50aGVuKHJlc3BvbnNlT3V0cHV0KVxyXG4gICAgICAgIH1cclxuICAgIH0pLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBlcnIgPT0gJ29iamVjdCcgJiYgIWlzRW1wdHkoZXJyLm5hbWUpKSB7XHJcbiAgICAgICAgICAgIGlmIChlcnIubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB7XHJcbiAgICAgICAgICAgICAgICAvLyDlpITnkIbmiJBhYm9ydOaKpemUmeaooeW8j1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IERPTUV4Y2VwdGlvbihhYm9ydE1zZywgZXJyLm5hbWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgIH0pXHJcbn1cclxuZXhwb3J0IGRlZmF1bHQgZXNGZXRjaCIsIi8qIHhocuivt+axguWHveaVsCAqL1xyXG5pbXBvcnQgeyBpc0pzb24sIGlzTnVtZXJpYywgZWFjaCwgaXNFbXB0eSwgZ2V0VHlwZSwgYmxvYlRvVGV4dCwgZ2V0Q2hhcnNldCwgZ2V0VGltZW91dCB9IGZyb20gXCIuLi9oZWxwZXJzL3V0aWxcIlxyXG5pbXBvcnQgeyBwYXJzZUhlYWRlcnMgfSBmcm9tIFwiLi4vaGVscGVycy9oZWFkZXJzXCJcclxuaW1wb3J0IHsgY3JlYXRlRXJyb3IgfSBmcm9tIFwiLi4vY29yZS9lcnJvclwiO1xyXG5cclxuZXhwb3J0IGNvbnN0IHhociA9IChjb25maWcpID0+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgLy8g5Y+R6YCB5YmN5Zue6LCD6YCa55+lXHJcbiAgICAgICAgaWYgKGdldFR5cGUoY29uZmlnLmJlZm9yZVNlbmQpID09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgbGV0IGJlZm9yZVNlbmRSZXMgPSBjb25maWcuYmVmb3JlU2VuZChjb25maWcpO1xyXG4gICAgICAgICAgICBpZiAoYmVmb3JlU2VuZFJlcyA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QoJ+iiq2JlZm9yZVNlbmTmi6bmiKonKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIOino+aehGNvbmZpZywgZGF0YSDlpoLmnpzkuI3kvKDpu5jorqTorqTkuLpudWxsLCBtZXRob2Qg5LiN5Lyg6buY6K6kIGdldCwgdXJs5YiZ5piv5b+F5Lyg5Y+C5pWwXHJcbiAgICAgICAgY29uc3QgeyBkYXRhID0gbnVsbCwgdXJsLCBtZXRob2QgPSAnZ2V0JywgaGVhZGVycyA9IHt9LCByZXNwb25zZVR5cGUsIGNhbmNlbFRva2VuIH0gPSBjb25maWdcclxuXHJcbiAgICAgICAgLy8gcmVzcG9uc2VUeXBlXHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2VUeXBlQXJyID0gWydhcnJheUJ1ZmZlcicsICdibG9iJywgJ2Jsb2JUZXh0JywgJ2Zvcm1EYXRhJ107XHJcblxyXG5cclxuICAgICAgICAvLyDlrp7kvovljJYgWE1MSHR0cFJlcXVlc3RcclxuICAgICAgICBjb25zdCByZXF1ZXN0ID0gbmV3IGNvbmZpZy5lbmdpbmUoKTtcclxuXHJcbiAgICAgICAgLy8g5Yid5aeL5YyW5LiA5Liq6K+35rGCXHJcbiAgICAgICAgcmVxdWVzdC5vcGVuKG1ldGhvZC50b1VwcGVyQ2FzZSgpLCB1cmwsIHRydWUpO1xyXG5cclxuICAgICAgICAvLyDmmK/lkKbmnInorr7nva7otoXml7ZcclxuICAgICAgICBpZiAoY29uZmlnLmhhc093blByb3BlcnR5KCd0aW1lb3V0JykgJiYgaXNOdW1lcmljKGNvbmZpZy50aW1lb3V0KSAmJiBjb25maWcudGltZW91dCA+IDApIHtcclxuICAgICAgICAgICAgcmVxdWVzdC50aW1lb3V0ID0gZ2V0VGltZW91dChjb25maWcudGltZW91dClcclxuICAgICAgICAgICAgcmVxdWVzdC5vbnRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZXJyID0gVHlwZUVycm9yKCd4aHIg5ZON5bqU6LaF5pe2JylcclxuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIOWIpOaWreeUqOaIt+aYr+WQpuiuvue9ruS6hui/lOWbnuaVsOaNruexu+Wei1xyXG4gICAgICAgIGlmIChyZXNwb25zZVR5cGUgJiYgcmVzcG9uc2VUeXBlQXJyLmluY2x1ZGVzKHJlc3BvbnNlVHlwZSkpIHtcclxuICAgICAgICAgICAgcmVxdWVzdC5yZXNwb25zZVR5cGUgPSAocmVzcG9uc2VUeXBlID09ICdibG9iVGV4dCcpID8gJ2Jsb2InIDogcmVzcG9uc2VUeXBlXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDnm5HlkKwgb25yZWFkeXN0YXRlY2hhbmdlIOWHveaVsO+8jOaOpeaUtuWQjuWPsOi/lOWbnuaVsOaNrlxyXG4gICAgICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAocmVxdWVzdC5yZWFkeVN0YXRlICE9PSA0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm5cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm5cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g6L+U5Zue55qEIGhlYWRlciDmmK/lrZfnrKbkuLLnsbvlnovvvIzpgJrov4cgcGFyc2VIZWFkZXJzIOino+aekOaIkOWvueixoeexu+Wei1xyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZUhlYWRlcnMgPSBwYXJzZUhlYWRlcnMocmVxdWVzdC5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlRGF0YSA9ICgodGV4dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXRhID0gdGV4dFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0pzb24odGV4dCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IEpTT04ucGFyc2UodGV4dClcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2VUeXBlID09ICdqc29uJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IHt9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcclxuICAgICAgICAgICAgfSkocmVxdWVzdC5yZXNwb25zZVRleHQpXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcclxuICAgICAgICAgICAgICAgIGRhdGE6IHJlc3BvbnNlRGF0YSxcclxuICAgICAgICAgICAgICAgIHJlc3BvbnNlVGV4dDogT2JqZWN0LmdldFByb3RvdHlwZU9mKHJlcXVlc3QpLmhhc093blByb3BlcnR5KCdyZXNwb25zZVRleHQnKSA/IHJlcXVlc3QucmVzcG9uc2VUZXh0IDogbnVsbCxcclxuICAgICAgICAgICAgICAgIHN0YXR1czogcmVxdWVzdC5zdGF0dXMsXHJcbiAgICAgICAgICAgICAgICBzdGF0dXNUZXh0OiByZXF1ZXN0LnN0YXR1c1RleHQsXHJcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiByZXNwb25zZUhlYWRlcnMsXHJcbiAgICAgICAgICAgICAgICBjb25maWcsXHJcbiAgICAgICAgICAgICAgICB4aHI6IHJlcXVlc3RcclxuICAgICAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgICAgIC8vIOWTjeW6lOi+k+WHuuWkhOeQhlxyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZUZpbmFsUHJvY2VzcyA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIOWmguaenOeKtuaAgeeggeWcqCAyMDAtMzAwIOS5i+mXtOato+W4uCByZXNvbHZl77yM5ZCm5YiZIHJlamVjdCDplJnor69cclxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID49IDIwMCAmJiByZXN1bHQuc3RhdHVzIDwgMzAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZUVycm9yKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYFJlcXVlc3QgZmFpbGVkIHdpdGggc3RhdHVzIGNvZGUgJHtyZXN1bHQuc3RhdHVzfWAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25maWcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuXHJcblxyXG4gICAgICAgICAgICAvLyDpgJrov4cgcmVzb2x2ZSDov5Tlm57mlbDmja5cclxuICAgICAgICAgICAgaWYgKHJlc3BvbnNlVHlwZSA9PSAnYmxvYlRleHQnKSB7XHJcbiAgICAgICAgICAgICAgICBibG9iVG9UZXh0KHJlc3BvbnNlRGF0YSwgZ2V0Q2hhcnNldChjb25maWcsIHJlc3BvbnNlSGVhZGVycykpLnRoZW4odGV4dCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGEgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzSnNvbih0ZXh0KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KVxyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZVR5cGUgPT0gJ2pzb24nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhID0ge31cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQuZGF0YSA9IGRhdGFcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucmVzcG9uc2VUZXh0ID0gdGV4dDtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2VGaW5hbFByb2Nlc3MoKVxyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJlc3BvbnNlRmluYWxQcm9jZXNzKClcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g55uR5ZCs6ZSZ6K+vXHJcbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gKCkgPT4ge1xyXG4gICAgICAgICAgICByZWplY3QoY3JlYXRlRXJyb3IoYE5ldHdvcmsgRXJyb3JgLCBjb25maWcsIG51bGwsIHJlcXVlc3QpKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIC8vIOebkeWQrOi2heaXtlxyXG4gICAgICAgIHJlcXVlc3Qub250aW1lb3V0ID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAvLyBFQ09OTkFCT1JURUQg6YCa5bi46KGo56S65LiA5Liq6KKr5Lit5q2i55qE6K+35rGCXHJcbiAgICAgICAgICAgIHJlamVjdChcclxuICAgICAgICAgICAgICAgIGNyZWF0ZUVycm9yKFxyXG4gICAgICAgICAgICAgICAgICAgIGBUaW1lb3V0IG9mICR7Y29uZmlnLnRpbWVvdXR9IG1zIGV4Y2VlZGVkYCxcclxuICAgICAgICAgICAgICAgICAgICBjb25maWcsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJFQ09OTkFCT1JURURcIixcclxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0XHJcbiAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8g6YGN5Y6G5omA5pyJ5aSE55CG5ZCO55qEIGhlYWRlcnNcclxuICAgICAgICBlYWNoKGhlYWRlcnMsIGZ1bmN0aW9uIChrZXksIGl0ZW0pIHtcclxuICAgICAgICAgICAgLy8g57uZ6K+35rGC6K6+572u5LiKIGhlYWRlclxyXG4gICAgICAgICAgICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoa2V5LCBpdGVtKVxyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLy8geGhy5a2X5q616K6+572uXHJcbiAgICAgICAgaWYgKGNvbmZpZy5oYXNPd25Qcm9wZXJ0eSgncmF3RmllbGRzJykgJiYgZ2V0VHlwZShjb25maWcucmF3RmllbGRzKSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgY29uc3QgYmFuS2V5cyA9IFsnb3BlbicsICdzZXRSZXF1ZXN0SGVhZGVyJywgJ3NlbmQnXVxyXG4gICAgICAgICAgICBlYWNoKGNvbmZpZy54aHJGaWVsZHMsIGZ1bmN0aW9uIChrZXksIGl0ZW0pIHtcclxuICAgICAgICAgICAgICAgIGlmICghYmFuS2V5cy5pbmNsdWRlcyhrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdFtrZXldID0gaXRlbVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyDojrflj5Z4aHLlj6Xmn4Qo6Ieq5a6a5LmJeGhy5LqL5Lu25aaC6I635Y+W5LiK5Lyg6L+b5bqmKVxyXG4gICAgICAgIGxldCBpc0NvbnRpbnVlID0gdHJ1ZTtcclxuICAgICAgICBpZiAoY29uZmlnLmhhc093blByb3BlcnR5KCd4aHInKSAmJiBnZXRUeXBlKGNvbmZpZy54aHIpID09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgaWYgKGNvbmZpZy54aHIocmVxdWVzdCwgY29uZmlnKSA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgIGlzQ29udGludWUgPSBmYWxzZVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDliKTmlq3mmK/lkKbmnInlrprkuYnlj5bmtojor7fmsYJcclxuICAgICAgICBpZiAoY2FuY2VsVG9rZW4pIHtcclxuICAgICAgICAgICAgY2FuY2VsVG9rZW4ucHJvbWlzZVxyXG4gICAgICAgICAgICAgICAgLnRoZW4oKHJlYXNvbikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuYWJvcnQoKTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QocmVhc29uKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAuY2F0Y2goKCkgPT4geyB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8g5Y+R6YCB6K+35rGCXHJcbiAgICAgICAgaXNDb250aW51ZSAmJiByZXF1ZXN0LnNlbmQoZGF0YSk7XHJcbiAgICB9KVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCB4aHJcclxuIiwiLyog6L2s5o2i5pWw5o2u55u45YWz5Ye95pWwICovXHJcbmltcG9ydCB7IGlzRW1wdHksIGdldFR5cGUsIGVhY2gsIGlzSnNvbiB9IGZyb20gXCIuL3V0aWxcIlxyXG5cclxuLypcclxuKiBuYW1lOiDovazmjaLor7fmsYLlj4LmlbBcclxuKiBkYXRhOiBhcnJheXxwbGFpbk9iamVjdHxVUkxTZWFyY2hQYXJhbXN8c3RyaW5nfGZvcm1EYXRhXHJcbiogICAgICAgYXJyYXk6IFsnYT0xJywgJ2I9MiZjPTMnLCB7ZDogNH0sIHtlOiBbNSwgNl19LCBbZiwge2YxOiA3LCBmMjogOH1dXSBcclxuKiAgICAgICAgICAgID0+IGE9MSZiPTImYz0zJmQ9NCZlW109NSZlW109NiZmW2YxXT03JmZbZjJdPThcclxuKiAgICAgICBwbGFuT2JqZWN0OiB7YTogMSwgZTogWzUsIDZdLCBmOiB7ZjE6IDcsIGYyOiA4fX1cclxuKiAgICAgICAgICAgID0+IGE9MSZlW109NSZlW109NiZmW2YxXT03JmZbZjJdPThcclxuKiAgICAgICBVUkxTZWFyY2hQYXJhbXM6IChuZXcgVVJMU2VhcmNoUGFyYW1zKCdhPTEmYj0yJykpLnRvU3RyaW5nKClcclxuKiAgICAgICAgICAgID0+IGE9MSZiPTJcclxuKiAgICAgICBzdHJpbmcg5ZKMIGZvcm1EYXRh5Lul5Y+K5pyq55+l57G75Z6L5Y6f5qC36L+U5ZueXHJcbiogdGFyZ2V0OiB7cXVlcnk6ICd1cmxlbmNvZGVkJywganNvbjogJ2pzb24nLCBmb3JtOiAnZm9ybURhdGEnfVxyXG4uKi9cclxuZXhwb3J0IGNvbnN0IHRyYW5zZm9ybVJlcXVlc3REYXRhID0gKGRhdGEsIHJlcXVlc3RUeXBlKSA9PiB7XHJcbiAgICBpZiAoaXNFbXB0eShkYXRhKSkge1xyXG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1SZXF1ZXN0RGF0YUFycmF5VG9UYXJnZXQoZGF0YSwgcmVxdWVzdFR5cGUpXHJcbiAgICB9XHJcbiAgICBsZXQgZGF0YVR5cGUgPSBnZXRUeXBlKGRhdGEpXHJcbiAgICBzd2l0Y2ggKGRhdGFUeXBlKSB7XHJcbiAgICAgICAgY2FzZSAnYXJyYXknOlxyXG4gICAgICAgICAgICBkYXRhID0gdHJhbnNmb3JtUmVxdWVzdERhdGFBcnJheShkYXRhKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAnb2JqZWN0JzpcclxuICAgICAgICAgICAgZGF0YSA9IHRyYW5zZm9ybVJlcXVlc3REYXRhT2JqZWN0KGRhdGEpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlICd1cmxzZWFyY2hwYXJhbXMnOlxyXG4gICAgICAgICAgICBkYXRhID0gdHJhbnNmb3JtUmVxdWVzdERhdGFRdWVyeShkYXRhKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcclxuICAgICAgICAgICAgLy8g5a2X56ym5Liy5Y+C5pWw5LiN5YaN6L+b6KGM6L2s5o2i5aSE55CGXHJcbiAgICAgICAgICAgIGRhdGEgPSB0cmFuc2Zvcm1SZXF1ZXN0RGF0YVN0cmluZyhkYXRhKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdHJhbnNmb3JtUmVxdWVzdERhdGFBcnJheVRvVGFyZ2V0KGRhdGEsIHJlcXVlc3RUeXBlKVxyXG59XHJcblxyXG5cclxuLy8g6L2s5o2i6K+35rGC5Y+C5pWw5pWw57uE5oiW5a+56LGh6YCa55So5aSE55CGXHJcbmV4cG9ydCBjb25zdCB0cmFuc2Zvcm1SZXF1ZXN0RGF0YUhhbmRsZUFPTyA9IChrZXksIHZhbCkgPT4ge1xyXG4gICAgbGV0IHJlc3VsdCA9IFtdO1xyXG4gICAgbGV0IHZhbFR5cGUgPSBnZXRUeXBlKHZhbCk7XHJcbiAgICBpZiAodmFsVHlwZSA9PSAnYXJyYXknKSB7XHJcbiAgICAgICAga2V5ICs9ICdbXSdcclxuICAgICAgICBlYWNoKHZhbCwgZnVuY3Rpb24gKGssIHYpIHtcclxuICAgICAgICAgICAgcmVzdWx0LnB1c2goW2tleSwgdl0pXHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHZhbFR5cGUgPT0gJ29iamVjdCcpIHtcclxuICAgICAgICBlYWNoKHZhbCwgZnVuY3Rpb24gKGssIHYpIHtcclxuICAgICAgICAgICAgcmVzdWx0LnB1c2goW2Ake2tleX1bJHtrfV1gLCB2XSlcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG4gICAgLy8gZWxzZSBpZiAodmFsVHlwZSA9PSAnZGF0ZScpIHtcclxuICAgIC8vICAgICByZXN1bHQucHVzaChba2V5LCB2YWwudmFsdWVPZigpXSk7XHJcbiAgICAvLyB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICByZXN1bHQucHVzaChba2V5LCB2YWxdKVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuLy8g6L2s5o2i6K+35rGC5Y+C5pWw5pWw57uEID0+IOebruagh+agvOW8j1xyXG5leHBvcnQgY29uc3QgdHJhbnNmb3JtUmVxdWVzdERhdGFBcnJheVRvVGFyZ2V0ID0gKGRhdGEsIHRhcmdldCA9ICdxdWVyeScpID0+IHtcclxuICAgIGxldCByZXN1bHQsIHNwZWNpYWxLZXlzO1xyXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGRhdGEpKSB7XHJcbiAgICAgICAgbGV0IGRhdGFUeXBlID0gZ2V0VHlwZShkYXRhKVxyXG4gICAgICAgIGlmIChkYXRhVHlwZSA9PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICBkYXRhID0gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlc3VsdCA9IGRhdGFcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGlmICh0YXJnZXQgPT0gJ3F1ZXJ5Jykge1xyXG4gICAgICAgICAgICBsZXQgdXNwID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xyXG4gICAgICAgICAgICBlYWNoKGRhdGEsIGZ1bmN0aW9uIChpbmRleCwgW2tleSwgaXRlbV0pIHtcclxuICAgICAgICAgICAgICAgIHVzcC5hcHBlbmQoa2V5LCBpdGVtKVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICByZXN1bHQgPSB1c3AudG9TdHJpbmcoKVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0YXJnZXQgPT0gJ2pzb24nKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHt9LCBzcGVjaWFsS2V5cyA9IHt9O1xyXG4gICAgICAgICAgICBlYWNoKGRhdGEsIGZ1bmN0aW9uIChpbmRleCwgW2tleSwgaXRlbV0pIHtcclxuICAgICAgICAgICAgICAgIGlmICgvKF4uKj8pXFxbKFteXFxbXFxdXSopXFxdLy50ZXN0KGtleSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgcGFyZW50S2V5ID0gUmVnRXhwLiQxLCBjaGlsZHJlZEtleSA9IFJlZ0V4cC4kMjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISFjaGlsZHJlZEtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNwZWNpYWxLZXlzLmhhc093blByb3BlcnR5KHBhcmVudEtleSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwZWNpYWxLZXlzW3BhcmVudEtleV0gPSB7fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwZWNpYWxLZXlzW3BhcmVudEtleV1bY2hpbGRyZWRLZXldID0gaXRlbVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzcGVjaWFsS2V5cy5oYXNPd25Qcm9wZXJ0eShwYXJlbnRLZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGVjaWFsS2V5c1twYXJlbnRLZXldID0gW11cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzcGVjaWFsS2V5c1twYXJlbnRLZXldLnB1c2goaXRlbSlcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRba2V5XSA9IGl0ZW1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLy8g6YGN5Y6G54m55q6Ka2V5XHJcbiAgICAgICAgICAgIGVhY2goc3BlY2lhbEtleXMsIGZ1bmN0aW9uIChrZXksIGl0ZW0pIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldID0gaXRlbVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICByZXN1bHQgPSBKU09OLnN0cmluZ2lmeShyZXN1bHQpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHRhcmdldCA9PSAnZm9ybScgfHwgdGFyZ2V0ID09ICdmb3JtZGF0YScpIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IEZvcm1EYXRhKClcclxuICAgICAgICAgICAgZWFjaChkYXRhLCBmdW5jdGlvbiAoaW5kZXgsIFtrZXksIGl0ZW1dKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQuYXBwZW5kKGtleSwgaXRlbSlcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IGRhdGFcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuLy8g5aSE55CG6K+35rGC5Y+C5pWw5pWw57uE5qC85byPXHJcbmV4cG9ydCBjb25zdCB0cmFuc2Zvcm1SZXF1ZXN0RGF0YUFycmF5ID0gKGRhdGEpID0+IHtcclxuICAgIGxldCBlcmdvZGljRGF0YSA9IE9iamVjdC52YWx1ZXMoZGF0YSlcclxuICAgIGxldCByZXN1bHQgPSBbXVxyXG4gICAgZm9yIChsZXQgaXRlbSBvZiBlcmdvZGljRGF0YSkge1xyXG4gICAgICAgIGxldCBpdGVtVHlwZSA9IGdldFR5cGUoaXRlbSk7XHJcbiAgICAgICAgc3dpdGNoIChpdGVtVHlwZSkge1xyXG4gICAgICAgICAgICBjYXNlICdzdHJpbmcnOiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgaXRlbVBhcmFtID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhpdGVtKVxyXG4gICAgICAgICAgICAgICAgZWFjaChpdGVtUGFyYW0sIGZ1bmN0aW9uIChrLCB2KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goW2ssIHZdKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICdhcnJheSc6IHtcclxuICAgICAgICAgICAgICAgIGxldCBpdGVtTGVuID0gaXRlbS5sZW5ndGhcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbUxlbjsgaSArPSAyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGtleSA9IGl0ZW1baSAtIDFdO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCB2YWwgPSBpdGVtW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKC4uLnRyYW5zZm9ybVJlcXVlc3REYXRhSGFuZGxlQU9PKGtleSwgdmFsKSlcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6IHtcclxuICAgICAgICAgICAgICAgIGVhY2goaXRlbSwgZnVuY3Rpb24gKGtleSwgdmFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goLi4udHJhbnNmb3JtUmVxdWVzdERhdGFIYW5kbGVBT08oa2V5LCB2YWwpKVxyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdFxyXG59XHJcblxyXG4vLyDlpITnkIbor7fmsYLlj4LmlbDlr7nosaHmoLzlvI9cclxuZXhwb3J0IGNvbnN0IHRyYW5zZm9ybVJlcXVlc3REYXRhT2JqZWN0ID0gKGRhdGEpID0+IHtcclxuICAgIGxldCByZXN1bHQgPSBbXVxyXG4gICAgZWFjaChkYXRhLCBmdW5jdGlvbiAoa2V5LCB2YWwpIHtcclxuICAgICAgICByZXN1bHQucHVzaCguLi50cmFuc2Zvcm1SZXF1ZXN0RGF0YUhhbmRsZUFPTyhrZXksIHZhbCkpXHJcbiAgICB9KVxyXG4gICAgcmV0dXJuIHJlc3VsdFxyXG59XHJcblxyXG4vLyDlpITnkIbor7fmsYLlj4LmlbBVUkxTZWFyY2hQYXJhbXPmoLzlvI9cclxuZXhwb3J0IGNvbnN0IHRyYW5zZm9ybVJlcXVlc3REYXRhUXVlcnkgPSAoZGF0YSkgPT4ge1xyXG4gICAgbGV0IHJlc3VsdCA9IFtdXHJcbiAgICBkYXRhLmZvckVhY2goKGl0ZW0sIGtleSkgPT4ge1xyXG4gICAgICAgIHJlc3VsdC5wdXNoKFtrZXksIGl0ZW1dKVxyXG4gICAgfSlcclxuICAgIHJldHVybiByZXN1bHRcclxufVxyXG5cclxuLy8g5aSE55CG6K+35rGC5Y+C5pWwIOWtl+espuS4siDmoLzlvI9cclxuZXhwb3J0IGNvbnN0IHRyYW5zZm9ybVJlcXVlc3REYXRhU3RyaW5nID0gKGRhdGEpID0+IHtcclxuICAgIGxldCByZXN1bHQgPSBbXVxyXG4gICAgaWYgKGlzSnNvbihkYXRhKSkge1xyXG4gICAgICAgIGxldCBkYXRhVGVtcCA9IEpTT04ucGFyc2UoZGF0YSlcclxuICAgICAgICBpZiAoaXNFbXB0eShkYXRhVGVtcCkpIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gZGF0YTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGVhY2goZGF0YVRlbXAsIChpdGVtLCBrZXkpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKFtrZXksIGl0ZW1dKVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIC8vIGNvbnN0IHVzcCA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoZGF0YSksIHVzcEFyciA9IFtdXHJcbiAgICAgICAgLy8gdXNwLmZvckVhY2goKGl0ZW0sIGtleSkgPT4ge1xyXG4gICAgICAgIC8vICAgICB1c3BBcnIucHVzaChba2V5LCBpdGVtXSlcclxuICAgICAgICAvLyB9KVxyXG4gICAgICAgIC8vIC8vIOWIpOaWreaYr+S4jeaYr1VSTFNlYXJjaFBhcmFtc+agvOW8j+eahOWPguaVsFxyXG4gICAgICAgIC8vIGlmICh1c3BBcnIubGVuZ3RoID4gMSB8fCAhaXNFbXB0eSh1c3BBcnJbMF1bMV0ucmVwbGFjZUFsbCgnPScsICcnKSkpIHtcclxuICAgICAgICAvLyAgIHJlc3VsdCA9IHVzcEFyclxyXG4gICAgICAgIC8vIH1cclxuICAgICAgICAvLyBlbHNlIHtcclxuICAgICAgICAvLyAgIHJlc3VsdCA9IGRhdGE7XHJcbiAgICAgICAgLy8gfVxyXG4gICAgICAgIHJlc3VsdCA9IGRhdGE7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0XHJcbn1cclxuIiwiLyog5aSE55CGaGVhZGVy55u45YWzKOivt+axguWktOWSjOWTjeW6lOWktCkgKi9cclxuaW1wb3J0IHtpc0VtcHR5LCBnZXRUeXBlLCBlYWNofSBmcm9tIFwiLi91dGlsXCJcclxuLy8g6Kej5p6Q5Y6f5aeL5ZON5bqU5aS0XHJcbmV4cG9ydCBjb25zdCBwYXJzZUhlYWRlcnMgPSAoaGVhZGVycykgPT4ge1xyXG4gICAgbGV0IHBhcnNlZCA9IHt9XHJcbiAgICBpZiAoIWhlYWRlcnMpIHtcclxuICAgICAgICByZXR1cm4gcGFyc2VkO1xyXG4gICAgfVxyXG4gICAgY29uc3QgRU9MID0gJ19fRU9MX18nXHJcbiAgICAvLyDlpITnkIbmjaLooYznrKbvvIzlhbzlrrnkuI3lkIzlubPlj7DnmoTmjaLooYxcclxuICAgIGhlYWRlcnMgPSBoZWFkZXJzLnJlcGxhY2VBbGwoJ1xcclxcbicsIEVPTCkucmVwbGFjZUFsbCgnXFxyJywgRU9MKS5yZXBsYWNlQWxsKCdcXG4nLCBFT0wpXHJcbiAgICBoZWFkZXJzLnNwbGl0KEVPTCkuZm9yRWFjaCgobGluZSkgPT4ge1xyXG4gICAgICAgIGxldCBba2V5LCAuLi52YWxzXSA9IGxpbmUuc3BsaXQoXCI6XCIpO1xyXG4gICAgICAgIGtleSA9IGtleS50cmltKCk7XHJcbiAgICAgICAgaWYgKCFrZXkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YWxzID0gdmFscy5qb2luKFwiOlwiKS50cmltKClcclxuICAgICAgICBwYXJzZWRba2V5LnRvTG93ZXJDYXNlKCldID0gdmFsc1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gcGFyc2VkO1xyXG59XHJcblxyXG4vLyDlpITnkIbor7fmsYLlpLQt5qCH5YeG5YyW6K+35rGC5aS0XHJcbmV4cG9ydCBjb25zdCBub3JtYWxpemVIZWFkZXJOYW1lID0gKGhlYWRlcnMsIG5vcm1hbGl6ZWROYW1lcykgPT4ge1xyXG4gICAgaWYgKGlzRW1wdHkoaGVhZGVycykgfHwgZ2V0VHlwZShoZWFkZXJzKSAhPSAnb2JqZWN0Jykge1xyXG4gICAgICAgIHJldHVybiB7fVxyXG4gICAgfVxyXG4gICAgbGV0IGhlYWRlcnNNYXAgPSB7fVxyXG4gICAgZWFjaChoZWFkZXJzLCBmdW5jdGlvbiAoa2V5LCBpdGVtKSB7XHJcbiAgICAgICAgaGVhZGVyc01hcFtrZXkudG9VcHBlckNhc2UoKV0gPSBrZXk7XHJcbiAgICB9KVxyXG4gICAgLy8g5aaC5p6c5piv5a2X56ym5Liy5YiZ6L2s5o2i5oiQ5pWw57uEXHJcbiAgICBpZiAoZ2V0VHlwZShub3JtYWxpemVkTmFtZXMpID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIG5vcm1hbGl6ZWROYW1lcyA9IFtub3JtYWxpemVkTmFtZXNdXHJcbiAgICB9XHJcbiAgICBlYWNoKG5vcm1hbGl6ZWROYW1lcywgZnVuY3Rpb24gKGtleSwgaXRlbSkge1xyXG4gICAgICAgIGxldCBuYW1lID0gaXRlbS50b1VwcGVyQ2FzZSgpXHJcbiAgICAgICAgLy8gbm9ybWFsaXplZE5hbWVPYmpbaXRlbV0gPSBbaXRlbVRlbXAsIGl0ZW1UZW1wLnJlcGxhY2VBbGwoJy0nLCAnJyldXHJcbiAgICAgICAgaWYgKGhlYWRlcnNNYXAuaGFzT3duUHJvcGVydHkobmFtZSkgfHwgKG5hbWUgPSBuYW1lLnJlcGxhY2VBbGwoJy0nLCAnJyksIGhlYWRlcnNNYXAuaGFzT3duUHJvcGVydHkobmFtZSkpKSB7XHJcbiAgICAgICAgICAgIG5hbWUgPSBoZWFkZXJzTWFwW25hbWVdXHJcbiAgICAgICAgICAgIGhlYWRlcnNbaXRlbV0gPSBoZWFkZXJzW25hbWVdXHJcbiAgICAgICAgICAgIGRlbGV0ZSBoZWFkZXJzW25hbWVdXHJcbiAgICAgICAgfVxyXG4gICAgfSlcclxuICAgIHJldHVybiBoZWFkZXJzO1xyXG59XHJcblxyXG4vLyDlpITnkIbor7fmsYLlpLQt6aKE5aSE55CG6K+35rGC5aS0XHJcbmV4cG9ydCBjb25zdCBwcm9jZXNzSGVhZGVycyA9IChoZWFkZXJzLCBjb250ZW50VHlwZSwgY2hhcnNldCkgPT4ge1xyXG4gICAgbm9ybWFsaXplSGVhZGVyTmFtZShoZWFkZXJzLCAnY29udGVudC10eXBlJylcclxuICAgIGNvbnN0IGZvcm1EYXRhID0gJ211bHRpcGFydC9mb3JtLWRhdGEnXHJcbiAgICAgICAgLCB1cmxlbmNvZGVkID0gJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCdcclxuICAgIGNvbnN0IGNvbnRlbnRUeXBlT2JqID0ge1xyXG4gICAgICAgIGpzb246ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICAgICBmb3JtRGF0YSxcclxuICAgICAgICBmb3JtZGF0YTogZm9ybURhdGEsXHJcbiAgICAgICAgdXJsZW5jb2RlZCxcclxuICAgICAgICBxdWVyeTogdXJsZW5jb2RlZCxcclxuICAgICAgICB4dzogdXJsZW5jb2RlZCxcclxuICAgICAgICB0ZXh0OiAndGV4dC9wbGFpbidcclxuICAgIH1cclxuICAgIGlmICghaGVhZGVyc1snY29udGVudC10eXBlJ10gJiYgZ2V0VHlwZShjb250ZW50VHlwZSkgPT0gJ3N0cmluZycpIHtcclxuICAgICAgICBsZXQgY29udGVudFR5cGVUZW1wO1xyXG4gICAgICAgIGlmIChjb250ZW50VHlwZU9iai5oYXNPd25Qcm9wZXJ0eShjb250ZW50VHlwZSkpIHtcclxuICAgICAgICAgICAgY29udGVudFR5cGVUZW1wID0gY29udGVudFR5cGVPYmpbY29udGVudFR5cGVdO1xyXG4gICAgICAgICAgICBsZXQgY2hhcnNldFR5cGUgPSBnZXRUeXBlKGNoYXJzZXQpO1xyXG4gICAgICAgICAgICBpZiAoY2hhcnNldFR5cGUgPT0gJ2Jvb2xlYW4nICYmIGNoYXJzZXQpIHtcclxuICAgICAgICAgICAgICAgIGNoYXJzZXQgPSAnVVRGLTgnXHJcbiAgICAgICAgICAgICAgICBjaGFyc2V0VHlwZSA9ICdzdHJpbmcnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghaXNFbXB0eShjaGFyc2V0KSAmJiBjaGFyc2V0VHlwZSA9PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgY29udGVudFR5cGVUZW1wID0gW2NvbnRlbnRUeXBlVGVtcCwgJzsgY2hhcnNldD0nLCBjaGFyc2V0XS5qb2luKCcnKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBjb250ZW50VHlwZVRlbXAgPSBjb250ZW50VHlwZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaGVhZGVyc1snY29udGVudC10eXBlJ10gPSBjb250ZW50VHlwZVRlbXBcclxuICAgIH1cclxuICAgIHJldHVybiBoZWFkZXJzXHJcbn1cclxuXHJcbi8vIOWkhOeQhuivt+axguWktC3ovazmjaLlpITnkIbor7fmsYLlpLRcclxuZXhwb3J0IGNvbnN0IHRyYW5zZm9ybUhlYWRlcnMgPSAoY29uZmlnKSA9PiB7XHJcbiAgICBsZXQgeyBoZWFkZXJzLCBjb250ZW50VHlwZSwgY2hhcnNldCB9ID0gY29uZmlnO1xyXG4gICAgbGV0IGhlYWRlcnNUeXBlID0gZ2V0VHlwZShoZWFkZXJzKSwgaGVhZGVyc1RlbXAgPSB7fVxyXG4gICAgaWYgKGhlYWRlcnNUeXBlID09ICdoZWFkZXJzJykge1xyXG4gICAgICAgIGhlYWRlcnMuZm9yRWFjaCgoaXRlbSwga2V5KSA9PiB7XHJcbiAgICAgICAgICAgIGhlYWRlcnNUZW1wW2tleV0gPSBpdGVtXHJcbiAgICAgICAgfSlcclxuICAgICAgICBoZWFkZXJzID0gaGVhZGVyc1RlbXA7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICBoZWFkZXJzID0gaGVhZGVyc1R5cGUgPT0gJ29iamVjdCcgPyBoZWFkZXJzIDoge31cclxuICAgIH1cclxuICAgIC8vIOWPquimgWNvbnRlbnRUeXBlIOS4jeaYryBbZmFsc2UsJycsIDBdIOWImeS4gOW+i+aMieeFp3JlcXVlc3RUeXBl5p2l5a6a5LmJY29udGVudFR5cGVcclxuICAgIGlmICghaXNFbXB0eShjb250ZW50VHlwZSkgfHwgdHlwZW9mIGNvbnRlbnRUeXBlID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnLnJlcXVlc3RUeXBlICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIGNvbnRlbnRUeXBlID0gY29uZmlnLnJlcXVlc3RUeXBlXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBjb250ZW50VHlwZSA9ICdxdWVyeSdcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBjb25maWcuaGVhZGVycyA9IHByb2Nlc3NIZWFkZXJzKGhlYWRlcnMsIGNvbnRlbnRUeXBlLCBjaGFyc2V0KVxyXG4gICAgLy8g5aaC5p6c5rKh5pyJZGF0YeWImeS4jeeUqOiuvue9ruivt+axguWktChbJ0dFVCcsICdIRUFEJywgJ09QVElPTlMnLCAnREVMRVRFJ10uaW5jbHVkZXMoY29uZmlnLm1ldGhvZCkpXHJcbiAgICBpZiAoY29uZmlnLmRhdGEgPT09IG51bGwgJiYgY29uZmlnLmhlYWRlcnMuaGFzT3duUHJvcGVydHkoJ2NvbnRlbnQtdHlwZScpKSB7XHJcbiAgICAgICAgZGVsZXRlIGNvbmZpZy5oZWFkZXJzWydjb250ZW50LXR5cGUnXVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGNvbmZpZy5oZWFkZXJzXHJcbn1cclxuIiwiLyog5aSE55CGdXJs55u45YWz5Ye95pWwICovXHJcbmltcG9ydCB7aXNFbXB0eX0gZnJvbSBcIi4vdXRpbFwiXHJcbmltcG9ydCB7dHJhbnNmb3JtUmVxdWVzdERhdGF9IGZyb20gXCIuL2RhdGFcIlxyXG5cclxuLy8g6L2s5o2i5p2l6IeqcXVlcnnnmoTlj4LmlbBcclxuZXhwb3J0IGNvbnN0IHRyYW5zZm9ybVVSTCA9IChjb25maWcpID0+IHtcclxuICAgIGxldCB7IGJhc2VVcmwsIHVybCwgcGFyYW1zIH0gPSBjb25maWc7XHJcbiAgICBpZiAoIWlzQWJzb2x1dGVVUkwodXJsKSAmJiBiYXNlVXJsKSB7XHJcbiAgICAgICAgdXJsID0gY29tYmluZVVSTHMoYmFzZVVybCwgdXJsKVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGJ1aWxkVVJMKHVybCwgcGFyYW1zKTtcclxufVxyXG5cclxuLy8g5Yik5pat5piv5ZCm57ud5a+55Zyw5Z2AXHJcbmV4cG9ydCBmdW5jdGlvbiBpc0Fic29sdXRlVVJMKHVybCkge1xyXG4gICAgLy8gQSBVUkwgaXMgY29uc2lkZXJlZCBhYnNvbHV0ZSBpZiBpdCBiZWdpbnMgd2l0aCBcIjxzY2hlbWU+Oi8vXCIgb3IgXCIvL1wiIChwcm90b2NvbC1yZWxhdGl2ZSBVUkwpLlxyXG4gICAgLy8gUkZDIDM5ODYgZGVmaW5lcyBzY2hlbWUgbmFtZSBhcyBhIHNlcXVlbmNlIG9mIGNoYXJhY3RlcnMgYmVnaW5uaW5nIHdpdGggYSBsZXR0ZXIgYW5kIGZvbGxvd2VkXHJcbiAgICAvLyBieSBhbnkgY29tYmluYXRpb24gb2YgbGV0dGVycywgZGlnaXRzLCBwbHVzLCBwZXJpb2QsIG9yIGh5cGhlbi5cclxuICAgIHJldHVybiAvXihbYS16XVthLXpcXGQrXFwtLl0qOik/XFwvXFwvL2kudGVzdCh1cmwpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgVVJMIGJ5IGNvbWJpbmluZyB0aGUgc3BlY2lmaWVkIFVSTHNcclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IGJhc2VVUkwgVGhlIGJhc2UgVVJMXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSByZWxhdGl2ZVVSTCBUaGUgcmVsYXRpdmUgVVJMXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBjb21iaW5lZCBVUkxcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjb21iaW5lVVJMcyhiYXNlVVJMLCByZWxhdGl2ZVVSTCkge1xyXG4gIHJldHVybiByZWxhdGl2ZVVSTFxyXG4gICAgPyBiYXNlVVJMLnJlcGxhY2UoL1xcLyskLywgJycpICsgJy8nICsgcmVsYXRpdmVVUkwucmVwbGFjZSgvXlxcLysvLCAnJylcclxuICAgIDogYmFzZVVSTDtcclxufVxyXG5cclxuLy8g5p6E5bu6dXJsXHJcbmV4cG9ydCBjb25zdCBidWlsZFVSTCA9ICh1cmwsIHBhcmFtcykgPT4ge1xyXG4gICAgaWYgKGlzRW1wdHkocGFyYW1zKSkge1xyXG4gICAgICAgIHJldHVybiB1cmxcclxuICAgIH1cclxuICAgIC8vIOWumuS5ieS4gOS4quWPmOmHj++8jOeUqOadpeS/neWtmOacgOe7iOaLvOaOpeWQjueahOWPguaVsFxyXG4gICAgbGV0IHNlcmlhbGl6ZWRQYXJhbXMgPSB0cmFuc2Zvcm1SZXF1ZXN0RGF0YShwYXJhbXMsICdxdWVyeScpXHJcbiAgICBpZiAoc2VyaWFsaXplZFBhcmFtcykge1xyXG4gICAgICAgIC8vIOWkhOeQhiBoYXNoIOeahOaDheWGtVxyXG4gICAgICAgIGNvbnN0IG1hcmtJbmRleCA9IHVybC5pbmRleE9mKCcjJylcclxuICAgICAgICBpZiAobWFya0luZGV4ICE9PSAtMSkge1xyXG4gICAgICAgICAgICB1cmwgPSB1cmwuc2xpY2UoMCwgbWFya0luZGV4KVxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyDlpITnkIbvvIzlpoLmnpzkvKDlhaXlt7Lnu4/luKbmnInlj4LmlbDvvIzliJnmi7zmjqXlnKjlhbblkI7pnaLvvIzlkKbliJnopoHmiYvliqjmt7vliqDkuIrkuIDkuKogP1xyXG4gICAgICAgIHVybCArPSAodXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyAnPycgOiAnJicpICsgc2VyaWFsaXplZFBhcmFtc1xyXG4gICAgfVxyXG4gICAgLy8g6L6T5Ye65a6M5pW055qEIFVSTFxyXG4gICAgcmV0dXJuIHVybFxyXG59IiwiLyog6YCa55So5bel5YW357G7ICovXHJcbi8vIOiOt+WPluWvueixoeexu+Wei1xyXG5leHBvcnQgZnVuY3Rpb24gZ2V0VHlwZSh2YWx1ZSwgdG9Mb3dlciA9IHRydWUpIHtcclxuICAgIGxldCByZXN1bHQgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLnNsaWNlKDgsIC0xKTtcclxuICAgIGlmICh0b0xvd2VyKSB7XHJcbiAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnRvTG93ZXJDYXNlKCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG4vLyDmmK/lkKbmmK/mlbDlrZdcclxuZXhwb3J0IGZ1bmN0aW9uIGlzTnVtZXJpYyhjaGVja1ZhbHVlLCBpc1N0cmljdCA9IGZhbHNlKSB7XHJcbiAgICAvLyDkv67lpI3mlbDnu4TooqvlvZPkvZzmlbDlrZfpl67pophbJzEyMyddID09IDEyM1xyXG4gICAgaWYgKCFbJ3N0cmluZycsICdudW1iZXInXS5pbmNsdWRlcyhnZXRUeXBlKGNoZWNrVmFsdWUpKSB8fCBjaGVja1ZhbHVlID09PSAnJykge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHJldHVybiBpc1N0cmljdCA/IGNoZWNrVmFsdWUgPT09IGNoZWNrVmFsdWUgLSAwIDogY2hlY2tWYWx1ZSA9PSBjaGVja1ZhbHVlIC0gMDtcclxufVxyXG5cclxuLy8g5Yik5pat5piv5ZCm5Li656m6XHJcbmV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5KGNoZWNrVmFsdWUsIGlzU3RyaWN0ID0gZmFsc2UpIHtcclxuICAgIGlmIChudWxsID09PSBjaGVja1ZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjaGVja1ZhbHVlID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIGxldCByZXN1bHQgPSB0cnVlO1xyXG4gICAgICAgIGlmICghIU9iamVjdC5nZXRQcm90b3R5cGVPZihjaGVja1ZhbHVlKSkge1xyXG4gICAgICAgICAgICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKGNoZWNrVmFsdWUpLmhhc093blByb3BlcnR5KCdlbnRyaWVzJykpIHtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IFtrZXksIGl0ZW1dIG9mIGNoZWNrVmFsdWUuZW50cmllcygpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hlY2tWYWx1ZS5jb25zdHJ1Y3Rvci5oYXNPd25Qcm9wZXJ0eSgnZW50cmllcycpKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBba2V5LCBpdGVtXSBvZiBPYmplY3QuZW50cmllcyhjaGVja1ZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKGNoZWNrVmFsdWUuaGFzT3duUHJvcGVydHkoJ2xlbmd0aCcpIHx8IE9iamVjdC5nZXRQcm90b3R5cGVPZihjaGVja1ZhbHVlKS5oYXNPd25Qcm9wZXJ0eShcImxlbmd0aFwiKSkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gY2hlY2tWYWx1ZS5sZW5ndGggPT09IDBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybih7XHJcbiAgICAgICAgICAgICAgICAgICAgbXNnOiAnaXNFbXB0eSBFeGNlcHRpb24nLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGNoZWNrVmFsdWVcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAvLyDmo4DmtYvlpLHotKXvvIzkuI3lnKjlrprkuYnojIPlm7RcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhjaGVja1ZhbHVlKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2ggKGUpIHtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH0gZWxzZSBpZiAoY2hlY2tWYWx1ZSA9PT0gMCB8fCBjaGVja1ZhbHVlID09PSAnMCcpIHtcclxuICAgICAgICByZXR1cm4gaXNTdHJpY3QgPyBjaGVja1ZhbHVlID09PSAwIDogdHJ1ZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuICFjaGVja1ZhbHVlO1xyXG4gICAgfVxyXG59XHJcblxyXG4vLyDmmK/lkKbmmK9qc29u5a2X56ym5LiyXHJcbmV4cG9ydCBmdW5jdGlvbiBpc0pzb24oY2hlY2tWYWx1ZSwgYmFja0pzb24gPSBmYWxzZSkge1xyXG4gICAgaWYgKHR5cGVvZiBjaGVja1ZhbHVlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKGNoZWNrVmFsdWUpO1xyXG4gICAgICAgICAgICByZXR1cm4gYmFja0pzb24gPyByZXN1bHQgOiB0cnVlO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG5cclxuLy8g5piv5ZCm5piv5a+56LGhXHJcbmV4cG9ydCBmdW5jdGlvbiBpc09iamVjdChjaGVja1ZhbHVlKSB7XHJcbiAgICByZXR1cm4gZ2V0VHlwZShjaGVja1ZhbHVlLCBmYWxzZSkgPT09ICdPYmplY3QnO1xyXG59XHJcblxyXG4vLyDliKTmlq3mmK/lkKbmma7pgJrlr7nosaFcclxuZXhwb3J0IGZ1bmN0aW9uIGlzUGxhaW5PYmplY3QoY2hlY2tWYWx1ZSkge1xyXG4gICAgaWYgKGdldFR5cGUoY2hlY2tWYWx1ZSwgZmFsc2UpICE9PSAnT2JqZWN0Jykge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgcHJvdG90eXBlID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKGNoZWNrVmFsdWUpO1xyXG4gICAgcmV0dXJuIHByb3RvdHlwZSA9PT0gbnVsbCB8fCBwcm90b3R5cGUgPT09IE9iamVjdC5wcm90b3R5cGU7XHJcbn1cclxuXHJcbi8vIOWvueixoemBjeWOhlxyXG5leHBvcnQgZnVuY3Rpb24gZWFjaChvYmosIGNhbGxiYWNrKSB7XHJcbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iaikuaGFzT3duUHJvcGVydHkoJ2VudHJpZXMnKSkge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBba2V5LCBpdGVtXSBvZiBvYmouZW50cmllcygpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2suY2FsbChpdGVtLCBrZXksIGl0ZW0pID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmIChvYmouY29uc3RydWN0b3IuaGFzT3duUHJvcGVydHkoJ2VudHJpZXMnKSkge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBba2V5LCBpdGVtXSBvZiBPYmplY3QuZW50cmllcyhvYmopKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2suY2FsbChpdGVtLCBrZXksIGl0ZW0pID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopLmhhc093blByb3BlcnR5KFwibGVuZ3RoXCIpKSB7XHJcbiAgICAgICAgICAgIGxldCBrZXkgPSAwO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpdGVtIG9mIG9iaikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrLmNhbGwoaXRlbSwga2V5KyssIGl0ZW0pID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWVcclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZVxyXG59XHJcblxyXG4vKipcclxuICogQWNjZXB0cyB2YXJhcmdzIGV4cGVjdGluZyBlYWNoIGFyZ3VtZW50IHRvIGJlIGFuIG9iamVjdCwgdGhlblxyXG4gKiBpbW11dGFibHkgbWVyZ2VzIHRoZSBwcm9wZXJ0aWVzIG9mIGVhY2ggb2JqZWN0IGFuZCByZXR1cm5zIHJlc3VsdC5cclxuICpcclxuICogV2hlbiBtdWx0aXBsZSBvYmplY3RzIGNvbnRhaW4gdGhlIHNhbWUga2V5IHRoZSBsYXRlciBvYmplY3QgaW5cclxuICogdGhlIGFyZ3VtZW50cyBsaXN0IHdpbGwgdGFrZSBwcmVjZWRlbmNlLlxyXG4gKlxyXG4gKiBFeGFtcGxlOlxyXG4gKlxyXG4gKiBgYGBqc1xyXG4gKiB2YXIgcmVzdWx0ID0gbWVyZ2Uoe2ZvbzogMTIzfSwge2ZvbzogNDU2fSk7XHJcbiAqIGNvbnNvbGUubG9nKHJlc3VsdC5mb28pOyAvLyBvdXRwdXRzIDQ1NlxyXG4gKiBgYGBcclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IG9iajEgT2JqZWN0IHRvIG1lcmdlXHJcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJlc3VsdCBvZiBhbGwgbWVyZ2UgcHJvcGVydGllc1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlKC4uLmFyZ3MvKiBvYmoxLCBvYmoyLCBvYmozLCAuLi4gKi8pIHtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuXHJcbiAgICBmdW5jdGlvbiBhc3NpZ25WYWx1ZShrZXksIHZhbCkge1xyXG4gICAgICAgIGlmIChpc1BsYWluT2JqZWN0KHJlc3VsdFtrZXldKSAmJiBpc1BsYWluT2JqZWN0KHZhbCkpIHtcclxuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBtZXJnZShyZXN1bHRba2V5XSwgdmFsKTtcclxuICAgICAgICB9IGVsc2UgaWYgKGlzUGxhaW5PYmplY3QodmFsKSkge1xyXG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IG1lcmdlKHt9LCB2YWwpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWwpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsLnNsaWNlKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXJncy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBlYWNoKGFyZ3NbaV0sIGFzc2lnblZhbHVlKTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcblxyXG4vLyBibG9i6L2s5a2X56ym5LiyXHJcbmV4cG9ydCBmdW5jdGlvbiBibG9iVG9UZXh0KGJsb2IsIGNoYXJzZXQgPSAnVVRGLTgnKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcclxuICAgICAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KVxyXG4gICAgICAgIH1cclxuICAgICAgICByZWFkZXIucmVhZEFzVGV4dChibG9iLCBjaGFyc2V0KVxyXG4gICAgfSlcclxufVxyXG5cclxuLy8g6I635Y+W57yW56CBXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRDaGFyc2V0KGNvbmZpZywgcmVzcG9uc2VIZWFkZXJzKSB7XHJcbiAgICBsZXQgY2hhckNvZGUgPSBjb25maWcuY2hhcnNldDtcclxuICAgIGlmIChyZXNwb25zZUhlYWRlcnMuaGFzT3duUHJvcGVydHkoJ2NvbnRlbnQtdHlwZScpICYmIC9jaGFyc2V0XFxzKj1cXHMqKFthLXpBLVpcXC1cXGRdKik7Py9pLnRlc3QocmVzcG9uc2VIZWFkZXJzWydjb250ZW50LXR5cGUnXSkpIHtcclxuICAgICAgICBjaGFyQ29kZSA9IFJlZ0V4cC4kMTtcclxuICAgIH1cclxuICAgIHJldHVybiBjaGFyQ29kZVxyXG59XHJcblxyXG4vLyDojrflj5botoXml7ZcclxuZXhwb3J0IGZ1bmN0aW9uIGdldFRpbWVvdXQodGltZW91dCkge1xyXG4gICAgdGltZW91dCA9IHRpbWVvdXQgPCAxMDAgPyB0aW1lb3V0ICogMTAwMCA6IHRpbWVvdXQ7XHJcbiAgICBpZiAodGltZW91dCA8IDEpIHtcclxuICAgICAgICB0aW1lb3V0ID0gMVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRpbWVvdXRcclxufVxyXG5cclxuLy8g57un5om/XHJcbmV4cG9ydCBmdW5jdGlvbiBleHRlbmQodG8sIGZyb20sIGN0eCkge1xyXG4gICAgLy8g57un5om/5pa55rOVXHJcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhmcm9tKS5mb3JFYWNoKChrZXkpID0+IHtcclxuICAgICAgICB0b1trZXldID0gZnJvbVtrZXldLmJpbmQoY3R4KTtcclxuICAgIH0pO1xyXG4gICAgLy8g57un5om/IGN0eCDoh6rouqvlsZ7mgKfvvIjkuI3nu6fmib/ljp/lnovpk77kuIrlsZ7mgKfvvIzlm6DmraTpnIDopoEgaGFzT3duUHJvcGVydHkg6L+b6KGM5Yik5pat77yJXHJcbiAgICBmb3IgKGxldCB2YWwgaW4gY3R4KSB7XHJcbiAgICAgICAgaWYgKGN0eC5oYXNPd25Qcm9wZXJ0eSh2YWwpKSB7XHJcbiAgICAgICAgICAgIHRvW3ZhbF0gPSBjdHhbdmFsXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG87XHJcbn0iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsIi8vIOWFpeWPo+aWh+S7tlxyXG5pbXBvcnQgSHR0cFJlcXVlc3QgZnJvbSBcIi4vY29yZS9IdHRwUmVxdWVzdFwiO1xyXG5pbXBvcnQgeyBleHRlbmQsIG1lcmdlIH0gZnJvbSBcIi4vaGVscGVycy91dGlsXCI7XHJcbmltcG9ydCBDYW5jZWxUb2tlbiBmcm9tIFwiLi9jYW5jZWwvY2FuY2VsVG9rZW5cIjtcclxuaW1wb3J0IHsgQ2FuY2VsLCBpc0NhbmNlbCB9IGZyb20gXCIuL2NhbmNlbC9jYW5jZWxcIjtcclxuXHJcblxyXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZShpbml0Q29uZmlnKSB7XHJcbiAgY29uc3QgY29udGV4dCA9IG5ldyBIdHRwUmVxdWVzdChpbml0Q29uZmlnKTtcclxuXHJcbiAgY29uc3QgaW5zdGFuY2UgPSBIdHRwUmVxdWVzdC5wcm90b3R5cGUucmVxdWVzdC5iaW5kKGNvbnRleHQpO1xyXG5cclxuICBleHRlbmQoaW5zdGFuY2UsIEh0dHBSZXF1ZXN0LnByb3RvdHlwZSwgY29udGV4dCk7XHJcblxyXG4gIHJldHVybiBpbnN0YW5jZTtcclxufVxyXG5cclxuLy8g6buY6K6k6YWN572uXHJcbmNvbnN0IGRlZmF1bHRDb25maWcgPSB7XHJcbiAgYmFzZVVybDogJycsIC8vIOagueWfn+WQjVxyXG4gIHVybDogJycsIC8vIOWunumZheivt+axguWcsOWdgO+8jOWmguaenOS4jeaYr2h0dHB8aHR0cHPnrYnlrozmlbTlvIDlpLTnmoTkvJroh6rliqjmi7zmjqXkuIpiYXNlVXJsXHJcbiAgbWV0aG9kOiBcImdldFwiLCAvLyDor7fmsYLmlrnms5VcclxuICBwYXJhbXM6IG51bGwsIC8vIHVybOWQjumdoueahGdldOWPguaVsFxyXG4gIGRhdGE6IG51bGwsIC8vIGdldOaIlnBvc3TnmoTlj4LmlbDkvJroh6rliqjlpITnkIZcclxuICByZXF1ZXN0VHlwZTogJ3F1ZXJ5JyxcclxuICByZXNwb25zZVR5cGU6IG51bGwsXHJcbiAgY2hhcnNldDogZmFsc2UsIC8vIOaYr+WQpuS4umNvbnRlbnQtdHlwZSDliqDkuIrnvJbnoIHvvIzlj6/pgInlgLx7dHJ1ZTogJ3V0Zi04JywgZmFsc2U6ICfkuI3mt7vliqAnLCAuLi7lhbbku5bku7vmhI/nvJbnoIHlrZfnrKbkuLJ9XHJcbiAgZW5naW5lOiAnYXV0bycsIC8vIOW8leaTjuWPr+mAieWAvFsneGhyJywgJ2ZldGNoJywg5Lul5Y+K6Ieq5a6a5LmJ5Ye95pWwXeS4jeespuWQiOWPr+mAieWAvOWmgmF1dG/liJnov5vlhaXoh6rliqjliKTmlq3pgInmi6lcclxuICBiZWZvcmVTZW5kOiBudWxsLCAvLyDlj5HpgIHliY3nmoTlh73mlbDlm57osIPvvIzlj6rmnInmmK/lh73mlbDmiY3kvJrosIPnlKjlhbbku5blj4LmlbDkvJrooqvlv73nlaVcclxuICAvL2NvbnRlbnRUeXBlOiB1bmRlZmluZWQsXHJcbiAgLy8geGhy5oiWZmV0Y2jnmoTljp/nlJ/lrZfmrrVcclxuICByYXdGaWVsZHM6IHtcclxuXHJcbiAgfVxyXG59O1xyXG5cclxuY29uc3QgYnhmID0gY3JlYXRlSW5zdGFuY2UoZGVmYXVsdENvbmZpZyk7XHJcblxyXG5ieGYuQ2FuY2VsVG9rZW4gPSBDYW5jZWxUb2tlbjtcclxuYnhmLkNhbmNlbCA9IENhbmNlbDtcclxuYnhmLmlzQ2FuY2VsID0gaXNDYW5jZWw7XHJcblxyXG5ieGYuY3JlYXRlID0gZnVuY3Rpb24gKGNvbmZpZykge1xyXG4gIHJldHVybiBjcmVhdGVJbnN0YW5jZShtZXJnZShkZWZhdWx0Q29uZmlnLCBjb25maWcpKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgYnhmOyJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==
