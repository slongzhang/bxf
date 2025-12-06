import fetchEngine from '../engines/fetchEngine'
import xhrEngine from '../engines/xhrEngine'

// 支持响应类型
export const responseTypes = {'arraybuffer': 'arrayBuffer', 'blob': 'blob', 'blobtext': 'blob', 'text': 'text', 'document': 'document', 'json': 'json'};
// 支持的请求引擎方法
const supportEngineName = ['XMLHttpRequest', 'bound XMLHttpRequest', 'fetch', 'bound fetch'];

// 获取适配器，通过判断是否有 XMLHttpRequest 来判断是普通web还是浏览器插件MV3,再进行xhr或fetch的选择
export const dispatchRequest = (engine) => {
  // 判断处理请求引擎问题
  let engineType = typeof engine;
  if (engineType == 'function') {
    if (engine.name && supportEngineName.includes(engine.name)) {
      return engine.name.includes('fetch') ? fetchEngine: xhrEngine;
    }
    else {
      return engine;
    }
  }
  else if (engineType == 'string' && ['xhr', 'fetch'].includes(engine.toLowerCase()) ){
    return (engine.toLowerCase() == 'xhr' && typeof XMLHttpRequest != 'undefined')? xhrEngine: fetchEngine;
  }
  else {
    // 默认优先使用fetch
    return typeof globalThis.fetch === "function"? fetchEngine: xhrEngine; 
  }
};


/**
 * 获取原生API
 * @param {string} apiName 
 * @returns 
 */
let nativeEngine = null, nativeEnginePending;
export const getRequestEngine = async (apiName, isNative = false) => {
  const defEngine = {
      xhr: globalThis?.XMLHttpRequest,
      fetch: globalThis?.fetch
  }
  if (!isNative) {
      return apiName.toLowerCase() === 'xhr'? defEngine.xhr: defEngine.fetch;
  }
  if (!nativeEngine) {
    if (typeof document !== 'undefined') {
      if (!nativeEnginePending) {
        nativeEnginePending = new Promise((resolve, reject) => {
          try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = 'about:blank';

            iframe.onload = () => {
              try {
                const nativeFetch = iframe.contentWindow.fetch;
                const nativeXHR = iframe.contentWindow.XMLHttpRequest;
                iframe.remove();
                resolve({ fetch: nativeFetch, xhr: nativeXHR });
              } catch (err) {
                iframe.remove();
                reject(err);
              }
            };

            document.documentElement.appendChild(iframe);
          } catch (e) {
            reject(e);
          }
        }).then(result => {
          nativeEngine = result
        }).catch(() => {
          nativeEngine = defEngine
        });
      }
      await nativeEnginePending;
    }
    else {
      nativeEngine = defEngine
    }
  }

  return apiName.toLowerCase() === 'xhr'? nativeEngine.xhr: nativeEngine.fetch;
}