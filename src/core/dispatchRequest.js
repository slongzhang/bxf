// 触发请求
import { isEmpty, getType } from "../helpers/util"
import { transformRequestData } from "../helpers/data"
import { transformURL } from "../helpers/url"
import {transformHeaders} from "../helpers/headers"
import { esFetch } from "../engine/fetch"
import { xhr } from "../engine/xhr"




// 预处理配置
export const processConfig = (config) => {
  // 处理请求方法
  const methods = ['get', 'post', 'put', 'delete', 'options', 'head', 'patch', 'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'];
  if (isEmpty(config.method) || !methods.includes(config.method)) {
      config.method = 'GET'
  }
  // 统一处理为大写
  config.method = config.method.toUpperCase();


  // 处理请求体格式
  let dataType = getType(config.data)
  if (dataType == 'formdata') {
      config.requestType = 'formdata'
  }
  else {
      if (dataType === 'undefined') {
          config.data = null
      }
      if (!isEmpty(config.requestType)) {
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
      if (!config.hasOwnProperty('params') && !isEmpty(config.data)) {
          config.params = config.data
          config.data = null
      }
  }
  else {
      config.data = transformRequestData(config.data, config.requestType)
  }


  // 处理url
  config.url = transformURL(config)
  config.params = null

  // 处理请求头
  config.headers = transformHeaders(config)
  

  // 处理请求引擎
  config.engine = getEngine(config)


  return config;
}


// 获取适配器，通过判断是否有 XMLHttpRequest 来判断是普通web还是浏览器插件MV3,再进行xhr或fetch的选择
const getEngine = (config) => {
  // 判断处理请求引擎问题
  let engine = config.engine, engineType = getType(engine);
  
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

export const dispatchRequest = (config) => {
  // if (isEmpty(config)) {
  //   let err = TypeError('配置参数错误或已被请求拦截,请检查代码')
  //   return Promise.reject(err)
  // }
  // // 处理传入的配置
  // config = processConfig(config);

  // 判断并调用请求引擎
  if (getType(config.engine) == 'function' && config.engine.name === 'fetch') {
    return esFetch(config) 
  }
  else {
    return xhr(config)
  }
}

export default dispatchRequest;