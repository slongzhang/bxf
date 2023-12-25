/* 转换数据相关函数 */
import { isEmpty, getType, each, isJson } from "./util"

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
export const transformRequestData = (data, requestType) => {
    if (isEmpty(data)) {
        return transformRequestDataArrayToTarget(data, requestType)
    }
    let dataType = getType(data)
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
export const transformRequestDataHandleAOO = (key, val) => {
    let result = [];
    let valType = getType(val);
    if (valType == 'array') {
        key += '[]'
        each(val, function (k, v) {
            result.push([key, v])
        })
    }
    else if (valType == 'object') {
        each(val, function (k, v) {
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
export const transformRequestDataArrayToTarget = (data, target = 'query') => {
    let result, specialKeys;
    if (!Array.isArray(data)) {
        let dataType = getType(data)
        if (dataType == 'object') {
            data = JSON.stringify(data);
        }
        result = data
    }
    else {
        if (target == 'query') {
            let usp = new URLSearchParams();
            each(data, function (index, [key, item]) {
                usp.append(key, item)
            })
            result = usp.toString()
        }
        else if (target == 'json') {
            result = {}, specialKeys = {};
            each(data, function (index, [key, item]) {
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
            each(specialKeys, function (key, item) {
                result[key] = item
            })
            result = JSON.stringify(result)
        }
        else if (target == 'form' || target == 'formdata') {
            result = new FormData()
            each(data, function (index, [key, item]) {
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
export const transformRequestDataArray = (data) => {
    let ergodicData = Object.values(data)
    let result = []
    for (let item of ergodicData) {
        let itemType = getType(item);
        switch (itemType) {
            case 'string': {
                let itemParam = new URLSearchParams(item)
                each(itemParam, function (k, v) {
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
                each(item, function (key, val) {
                    result.push(...transformRequestDataHandleAOO(key, val))
                })
            }
                break;
        }
    }
    return result
}

// 处理请求参数对象格式
export const transformRequestDataObject = (data) => {
    let result = []
    each(data, function (key, val) {
        result.push(...transformRequestDataHandleAOO(key, val))
    })
    return result
}

// 处理请求参数URLSearchParams格式
export const transformRequestDataQuery = (data) => {
    let result = []
    data.forEach((item, key) => {
        result.push([key, item])
    })
    return result
}

// 处理请求参数 字符串 格式
export const transformRequestDataString = (data) => {
    let result = []
    if (isJson(data)) {
        let dataTemp = JSON.parse(data)
        if (isEmpty(dataTemp)) {
            result = data;
        }
        else {
            each(dataTemp, (key, item) => {
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
