/* 处理url相关函数 */
import {isEmpty} from "./util"
import {transformRequestData} from "./data"

// 转换来自query的参数
export const transformURL = (config) => {
    let { baseUrl, url, params } = config;
    if (!isAbsoluteURL(url) && baseUrl) {
        url = combineURLs(baseUrl, url)
    }
    return buildURL(url, params);
}

// 判断是否绝对地址
export function isAbsoluteURL(url) {
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
export function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
}

// 构建url
export const buildURL = (url, params) => {
    if (isEmpty(params)) {
        return url
    }
    // 定义一个变量，用来保存最终拼接后的参数
    let serializedParams = transformRequestData(params, 'query')
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