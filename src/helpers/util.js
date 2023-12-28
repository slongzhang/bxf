/* 通用工具类 */
// 获取对象类型
export function getType(value, toLower = true) {
    let result = Object.prototype.toString.call(value).slice(8, -1);
    if (toLower) {
        result = result.toLowerCase();
    }
    return result;
}

// 是否是数字
export function isNumeric(checkValue, isStrict = false) {
    // 修复数组被当作数字问题['123'] == 123
    if (!['string', 'number'].includes(getType(checkValue)) || checkValue === '') {
        return false;
    }
    return isStrict ? checkValue === checkValue - 0 : checkValue == checkValue - 0;
}

// 判断是否为空
export function isEmpty(checkValue, isStrict = false) {
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
export function isJson(checkValue, backJson = false) {
    if (typeof checkValue === 'string') {
        try {
            let result = JSON.parse(checkValue);
            return backJson ? result : true;
        } catch (e) { }
    }
    return false;
}


// 是否是对象
export function isObject(checkValue) {
    return getType(checkValue, false) === 'Object';
}

// 判断是否普通对象
export function isPlainObject(checkValue) {
    if (getType(checkValue, false) !== 'Object') {
        return false;
    }

    let prototype = Object.getPrototypeOf(checkValue);
    return prototype === null || prototype === Object.prototype;
}

// 对象遍历
export function each(obj, callback) {
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
export function merge(...args/* obj1, obj2, obj3, ... */) {
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
export function blobToText(blob, charset = 'UTF-8') {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = function (e) {
            resolve(reader.result)
        }
        reader.readAsText(blob, charset)
    })
}

// 获取编码
export function getCharset(config, responseHeaders) {
    let charCode = config.charset;
    if (responseHeaders.hasOwnProperty('content-type') && /charset\s*=\s*([a-zA-Z\-\d]*);?/i.test(responseHeaders['content-type'])) {
        charCode = RegExp.$1;
    }
    return charCode
}

// 获取超时
export function getTimeout(timeout) {
    timeout = timeout < 301 ? timeout * 1000 : timeout;
    if (timeout < 1) {
        timeout = 1
    }
    return timeout
}

// 继承
export function extend(to, from, ctx) {
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