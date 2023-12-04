/* 处理header相关(请求头和响应头) */
import {isEmpty, getType, each} from "./util"
// 解析原始响应头
export const parseHeaders = (headers) => {
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
export const normalizeHeaderName = (headers, normalizedNames) => {
    if (isEmpty(headers) || getType(headers) != 'object') {
        return {}
    }
    let headersMap = {}
    each(headers, function (key, item) {
        headersMap[key.toUpperCase()] = key;
    })
    // 如果是字符串则转换成数组
    if (getType(normalizedNames) === 'string') {
        normalizedNames = [normalizedNames]
    }
    each(normalizedNames, function (key, item) {
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
export const processHeaders = (headers, contentType, charset) => {
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
    if (!headers['content-type'] && getType(contentType) == 'string') {
        let contentTypeTemp;
        if (contentTypeObj.hasOwnProperty(contentType)) {
            contentTypeTemp = contentTypeObj[contentType];
            let charsetType = getType(charset);
            if (charsetType == 'boolean' && charset) {
                charset = 'UTF-8'
                charsetType = 'string';
            }
            if (!isEmpty(charset) && charsetType == 'string') {
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
export const transformHeaders = (config) => {
    let { headers, contentType, charset } = config;
    let headersType = getType(headers), headersTemp = {}
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
    if (!isEmpty(contentType) || typeof contentType === 'undefined') {
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
