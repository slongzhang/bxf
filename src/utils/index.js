export const HAS_DATA_METHODS = ['post', 'put', 'patch'];
export const NO_DATA_METHODS = ["get", "delete", "head", "options"];

// 获取变量类型
export function getType(checkValue, toLow = true) {
  const typeName = Object.prototype.toString.call(checkValue).slice(8, -1);
  return toLow ? typeName.toLowerCase() : typeName;
}

// 是否字符串
export function isString(checkValue) {
  return getType(checkValue, false) === 'String';
}

// 是否是函数
export function isFunction(checkValue) {
  return getType(checkValue, false) === 'Function';
}

// 是否是对象
export function isObject(checkValue) {
  return getType(checkValue, false) === 'Object';
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

// 是否是数字
export function isNumeric(checkValue, isStrict = false) {
  // 修复数组被当作数字问题['123'] == 123
  if (!['string', 'number'].includes(getType(checkValue)) || checkValue === '') {
    return false;
  }
  return isStrict ? checkValue === checkValue - 0 : checkValue == checkValue - 0;
}

// 是否整形
export function isInt(checkValue, isStrict = false) {
  return isNumeric(checkValue, isStrict) && checkValue % 1 === 0;
}

// 判断是否合法url 
export function isUrl(str) {
  let v = new RegExp('^(?!mailto:)(?:(?:http|https|ftp)://|//)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$', 'i');
  return v.test(str)
}

// 判断是否绝对地址
export function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/**
 * 深度合并多个对象。数组为浅拷贝。
 * 最后一个参数可选传入 `true` 以启用 key 小写转换。
 * @param  {...any} sources
 * @returns {Object}
 */
export function deepMerge(...sources) {
    const result = {};
    const last = sources[sources.length - 1];
    const lowerCase = typeof last === 'boolean' ? sources.pop() : false;
    
    for (const source of sources) {
        if (!isObject(source)) continue;

        for (let key in source) {
            if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

            const rawKey = key;
            key = lowerCase ? key.toString().toLowerCase() : key;

            const val = source[rawKey];
            const existing = result[key];

            if (isObject(val) && isObject(existing)) {
                result[key] = deepMerge(existing, val, lowerCase);
            } else if (Array.isArray(val)) {
                result[key] = val.slice(); // shallow copy array
            } else if (isObject(val)) {
                result[key] = deepMerge({}, val, lowerCase);
            } else {
                result[key] = val;
            }
        }
    }

    return result;
}

// 匹配仅数据的状态码
export function onlyDataHttpStatus(range, status) {
  if (isInt(range) && range == status) {
      return true;
  }
  else if (typeof range === 'string') {
      range = range.split(',').map(s => s.trim());
      const rangeType = [
        isInt(range[0]),
        isInt(range[1]),
      ];
      if (rangeType[0] && rangeType[1]) {
          if (range[0] <= status && status < range[1]) {
              return true;
          }
      }
      else if (rangeType[0]) {
          if (range[0] <= status) {
              return true;
          }
      }
      else if (rangeType[1]) {
          if (status < range[1]) {
              return true;
          }
      }
  }
  return false;
}

/**
 * 解析XHR原始响应头(即字符串类型的响应头)
 * @param {*} headers 
 * @returns 
 */
export const parseRawHeaders = (headers) => {
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

/**
 * blob转字符串
 * @param {*} blob 
 * @param {*} charset 
 * @returns 
 */
export function blobToText(blob, charset = 'UTF-8') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result);
            // 清理引用
            reader.onload = null;
            reader.onerror = null;
        };

        reader.onerror = (e) => {
            reject(new Error(`Blob conversion to text failed: ${e.message}`));
            // 清理引用
            reader.onload = null;
            reader.onerror = null;
        };

        try {
            reader.readAsText(blob, charset);
        } catch (err) {
            reject(new Error(`Failed to read Blob: ${err.message}`));
        }
    });
}