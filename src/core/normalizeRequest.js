import {
    deepMerge,
    isFunction,
    isObject,
    getType,
    isAbsoluteURL,
    isJson,
} from '../utils/index.js';
import queryEncode from '../utils/queryEncode.js';
import {
    RESPONSE_TYPES,
    RESPONSE_TYPE_ALIASES,
    resolveEngineName,
} from './dispatchRequest.js';
import BxfError from './BxfError.js';

const CT = 'content-type';
const CT_JSON = 'application/json';
const CT_QUERY = 'application/x-www-form-urlencoded';

// 提升为一等公民的请求能力：两个引擎拿到的是同一套字段，映射差异由引擎内部消化
const CAPABILITY_KEYS = [
    'credentials', 'mode', 'cache', 'redirect',
    'referrer', 'referrerPolicy', 'integrity', 'keepalive',
];

/**
 * 构造对外 config 快照时必须剔除的内部字段。
 * 尤其 signal：它是本次请求的 AbortSignal，可能已经 aborted，
 * 带进 config 会让「拿 config 再发一次请求」立刻失败。
 */
export const INTERNAL_CONFIG_KEYS = [
    'url', 'initUrl', 'signal', 'cleanup', 'abort',
    'request', 'source', 'config', 'response',
];

// RequestSpec 的固定形状。所有字段都显式声明，保证两个引擎拿到的对象结构完全一致。
function createSpec() {
    return {
        // 地址与方法
        initUrl: '',
        url: '',
        method: 'GET',
        baseURL: '',
        // 请求内容
        headers: {},
        data: undefined,
        params: undefined,
        paramsSerializer: undefined,
        requestType: undefined,
        // 响应
        responseType: 'auto',
        charset: undefined,
        onStream: undefined,
        // 一等公民能力
        credentials: 'same-origin',
        mode: undefined,
        cache: undefined,
        redirect: 'follow',
        referrer: undefined,
        referrerPolicy: undefined,
        integrity: undefined,
        keepalive: undefined,
        // 引擎
        engine: undefined,
        nativeEngine: false,
        fetchOptions: {},
        xhrOptions: {},
        rawFields: undefined,
        // 中断与超时（bxf.js 会用 abortController 覆盖 signal/cleanup/abort）
        signal: undefined,
        timeout: 0,
        cleanup: undefined,
        abort: undefined,
        // 进度
        onUploadProgress: undefined,
        onDownloadProgress: undefined,
        // 上层行为
        onlyData: false,
        // 不传 = 只要拿到 HTTP 响应就 resolve
        resolveStatus: undefined,
        beforeInterceptors: undefined,
        auth: undefined,
        xsrfHeaderName: undefined,
        xsrfCookieName: undefined,
        // source 以不可枚举方式挂在 RequestSpec 上，对外只暴露它本身
        // （res.config / err.config），内部运行态不混入可回喂配置。
        // 重放由调用方自己 bxf(config) 发起，库不维护重试计数。
    };
}

/** 判断是否是「需要 JSON 编码」的纯数据（对象字面量 / 数组） */
function isPlainData(data) {
    return ['object', 'array'].includes(getType(data));
}

/**
 * 把 4 种调用形态 + 实例 defaults 规范化为唯一的 RequestSpec。
 *
 * @param {string|object} urlOrConfig bxf() 的第一个参数
 * @param {object} config             bxf() 的第二个参数
 * @param {string} _method           快捷方法注入的 method
 * @param {*} _data                  快捷方法注入的 data
 * @param {{defaults: object, baseURL: string}} ctx createClient 绑定的上下文
 * @returns {object} RequestSpec
 */
export function normalizeRequest(urlOrConfig, config, _method, _data, ctx = {}) {
    // 1) 解析入口形态
    let url;
    let cfg;
    if (typeof urlOrConfig !== 'string') {
        cfg = urlOrConfig || {};
        url = Object.hasOwn(cfg, 'initUrl') ? cfg.initUrl : cfg.url;
    } else {
        url = urlOrConfig;
        cfg = config || {};
    }
    if (!isObject(cfg)) cfg = {};

    // res.config / err.config 本身已是扁平可回喂配置，直接当入参即可，
    // 不需要任何「识别上一次 spec」的特殊分支。
    const initUrl = url || '';
    const defaults = ctx.defaults || {};
    // deepMerge 会递归深拷贝整棵对象树。data / params 可能是 MB 级请求体／参数表，
    // 而 merged 只是内部临时对象（不会出现在 res.config 里），这次拷贝纯属浪费。
    // 必须在 deepMerge 之前把这两个键摘掉，否则「合并后再换成引用」等于白拷一遍。
    // 两侧都是纯对象时仍保留原有的递归合并语义，其余情况直接复用引用。
    // 注意：下方 source 仍保留深拷贝快照（res.config 不能持有外部可变引用）。
    const mergeDefaults = { ...defaults };
    const mergeCfg = { ...cfg };
    delete mergeDefaults.data; delete mergeDefaults.params;
    delete mergeCfg.data; delete mergeCfg.params;
    const merged = deepMerge(mergeDefaults, mergeCfg);
    for (const key of ['data', 'params']) {
        const fromDefaults = defaults[key];
        const fromCfg = cfg[key];
        if (isObject(fromDefaults) && isObject(fromCfg)) {
            merged[key] = deepMerge(fromDefaults, fromCfg);
        } else {
            merged[key] = fromCfg !== undefined ? fromCfg : fromDefaults;
        }
    }

    const spec = createSpec();
    spec.initUrl = initUrl;

    // 2) baseURL：create({baseURL}) 与单次 config.baseURL 都生效（旧版只认 create）
    const mergedBaseURL = typeof merged.baseURL === 'string'
        ? merged.baseURL.replace(/\/+$/g, '') + '/'
        : '';
    spec.baseURL = ctx.baseURL || mergedBaseURL;

    // 3) method / data
    const method = String(_method || merged.method || 'get').toLowerCase();
    spec.method = method.toUpperCase();
    spec.requestType = merged.requestType;
    let data = _data !== undefined ? _data : merged.data;

    // 4) 请求体编码
    // 只有 GET / HEAD 不允许有请求体；其余方法（含 DELETE / OPTIONS）都允许带 body，
    // 旧版用 HAS_DATA_METHODS 白名单会把 DELETE 的 data 误降级成 query 参数。
    const plainData = isPlainData(data);
    // 必须用已大写的 spec.method：method 变量此时仍是小写，拿它去比
    // ['GET','HEAD'] 会恒为 true，导致 GET/HEAD 的 data 被当成 body 序列化、
    // 既没降级成 params，还错误附带 content-type: application/json。
    const hasBody = !['GET', 'HEAD'].includes(spec.method);
    const customHeaders = {};

    if (hasBody) {
        if (merged.requestType === 'query') {
            data = queryEncode(data);
            customHeaders[CT] = CT_QUERY;
        } else if (plainData) {
            data = JSON.stringify(data);
            customHeaders[CT] = CT_JSON;
        } else if (
            merged.requestType === 'json' &&
            typeof data === 'string' && isJson(data)
        ) {
            customHeaders[CT] = CT_JSON;
        }
    } else {
        // GET/HEAD 等：data 自动降级为 params（仅纯对象）
        if (!merged.params && plainData) merged.params = data;
        data = undefined;
    }
    spec.data = data;
    spec.params = merged.params;

    // 5) headers：用户值优先，内置值只补缺（旧版 customHeaders 会反向覆盖用户设置）。
    // 接受普通对象 / WHATWG Headers / [key,value][] 三种形态。
    // 旧版只认普通对象，传 new Headers() 会被 isObject 判成 false 而静默丢弃全部请求头。
    const headers = {};
    const collectHeader = (key, value) => {
        if (value === undefined || value === null) return;
        headers[String(key).toLowerCase()] = value;
    };
    if (typeof Headers !== 'undefined' && merged.headers instanceof Headers) {
        merged.headers.forEach((value, key) => collectHeader(key, value));
    } else if (Array.isArray(merged.headers)) {
        for (const entry of merged.headers) {
            if (Array.isArray(entry)) collectHeader(entry[0], entry[1]);
        }
    } else if (isObject(merged.headers)) {
        for (const [key, value] of Object.entries(merged.headers)) collectHeader(key, value);
    }
    const setDefault = (key, value) => {
        if (!Object.prototype.hasOwnProperty.call(headers, key)) headers[key] = value;
    };
    for (const [key, value] of Object.entries(customHeaders)) setDefault(key, value);
    if (merged.auth) setDefault('authorization', merged.auth);

    // xsrf：MV3 Service Worker 没有 document，try/catch 直接跳过
    if (merged.xsrfHeaderName && merged.xsrfCookieName) {
        try {
            // cookie 名常含 . / [ ] 等正则元字符：不转义会匹配到别的 cookie，
            // 甚至构造出非法正则被 catch 吞掉，导致 xsrf 头静默失效。
            const escaped = String(merged.xsrfCookieName)
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const matched = document.cookie.match(
                RegExp('(^|; )' + escaped + '=([^;]*)'),
            );
            if (matched) {
                setDefault(String(merged.xsrfHeaderName).toLowerCase(), decodeURIComponent(matched[2]));
            }
        } catch (e) { /* no document */ }
    }
    spec.headers = headers;

    // 6) URL 解析与 params 拼接
    let finalUrl = String(url === undefined || url === null ? '' : url);
    const isAbsolute = isAbsoluteURL(finalUrl) || /^[a-z][a-z\d+\-.]*:/i.test(finalUrl);
    if (!isAbsolute) {
        if (spec.baseURL) {
            finalUrl = spec.baseURL + finalUrl.replace(/^\//, '');
        } else if (typeof URL === 'function' && typeof location === 'object') {
            try { finalUrl = new URL(finalUrl, location.href).href; } catch (e) { /* keep */ }
        }
    }
    if (merged.params) {
        let serialized;
        if (isFunction(merged.paramsSerializer)) {
            serialized = merged.paramsSerializer(merged.params);
        } else if (typeof URLSearchParams !== 'undefined' && merged.params instanceof URLSearchParams) {
            // URLSearchParams 走标准 toString()；交给 queryEncode 的 for...in 会
            // 遍历到原型方法并在调用时丢失 this，抛 ERR_INVALID_THIS。
            serialized = merged.params.toString();
        } else {
            serialized = queryEncode(merged.params);
        }
        if (serialized) {
            // String() 防止自定义 serializer 返回数字时被当成数值相加
            finalUrl += (~finalUrl.indexOf('?') ? '&' : '?') + String(serialized);
        }
    }
    spec.url = finalUrl;
    spec.paramsSerializer = merged.paramsSerializer;

    // 7) responseType 规范化（两引擎共用同一张白名单）
    const rawType = String(merged.responseType || '').toLowerCase();
    const normalizedType = RESPONSE_TYPE_ALIASES[rawType] || rawType;
    spec.responseType = RESPONSE_TYPES.includes(normalizedType) ? normalizedType : 'auto';
    spec.charset = merged.charset;
    spec.onStream = isFunction(merged.onStream) ? merged.onStream : undefined;

    // 8) 一等公民能力 + 引擎专属逃生舱
    for (const key of CAPABILITY_KEYS) {
        if (merged[key] !== undefined) spec[key] = merged[key];
    }
    spec.nativeEngine = Boolean(merged.nativeEngine);
    spec.fetchOptions = isObject(merged.fetchOptions) ? { ...merged.fetchOptions } : {};
    spec.xhrOptions = isObject(merged.xhrOptions) ? { ...merged.xhrOptions } : {};
    spec.onUploadProgress = isFunction(merged.onUploadProgress) ? merged.onUploadProgress : undefined;
    spec.onDownloadProgress = isFunction(merged.onDownloadProgress) ? merged.onDownloadProgress : undefined;

    // 9) source = 扁平、纯数据、可直接 bxf(source) 的「原始请求配置」，
    // 对外即 res.config / err.config。必须在引擎决策之前构造，
    // 这样能力冲突抛出的 BxfError 也能带上同一份可回喂配置。
    const sourceConfig = { ...cfg };
    // source 必须是纯数据、可 JSON 序列化的快照：Headers 实例 / 数组也要转成普通对象，
    // 否则 res.config.headers 会是 {} 或持有外部可变引用，重放时丢请求头。
    if (isObject(sourceConfig.headers)) {
        sourceConfig.headers = { ...sourceConfig.headers };
    } else if (typeof Headers !== 'undefined' && sourceConfig.headers instanceof Headers) {
        sourceConfig.headers = Object.fromEntries(sourceConfig.headers.entries());
    } else if (Array.isArray(sourceConfig.headers)) {
        sourceConfig.headers = Object.fromEntries(
            sourceConfig.headers.filter(e => Array.isArray(e) && e[0] != null),
        );
    }
    const source = deepMerge(ctx.defaults, sourceConfig);
    for (const key of INTERNAL_CONFIG_KEYS) delete source[key];
    source.url = initUrl;
    if (_data !== undefined) source.data = _data;
    Object.defineProperty(spec, 'source', {
        value: source,
        enumerable: false, writable: true, configurable: true,
    });

    // 10) 引擎决策必须在 rawFields 分流之前完成。
    // 先把用户显式指定的引擎写进 spec，否则 resolveEngineName 永远读到
    // createSpec 的 undefined，导致 engine:"xhr" 被静默忽略（历史 bug）。
    spec.engine = merged.engine;
    spec.engine = resolveEngineName(spec);

    // rawFields 兼容别名：按最终引擎分流，不再让同一个字段在两个引擎里含义不同
    if (isObject(merged.rawFields)) {
        const target = spec.engine === 'xhr' ? 'xhrOptions' : 'fetchOptions';
        spec[target] = Object.assign({}, spec[target], merged.rawFields);
        spec.rawFields = merged.rawFields;
    }

    // 10) 上层行为
    spec.signal = merged.signal;
    spec.timeout = merged.timeout || 0;
    spec.onlyData = Boolean(merged.onlyData);
    spec.resolveStatus = merged.resolveStatus;
    // 配置校验放在规范化层，非法类型直接报错而不是静默放行
    const statusRule = spec.resolveStatus;
    if (statusRule !== undefined && statusRule !== null) {
        const type = typeof statusRule;
        if (type !== 'number' && type !== 'function' && !Array.isArray(statusRule)) {
            throw new BxfError(
                'resolveStatus 只支持 number、array（可含 [min,max] 区间）或 function',
                BxfError.ERR_BAD_OPTION_VALUE,
                spec.source,
            );
        }
        // NaN / Infinity 类型是 number，会静默拒绝所有响应，明确报错更好排查
        if (type === 'number' && !Number.isFinite(statusRule)) {
            throw new BxfError(
                'resolveStatus 的数值必须是有限数字（NaN / Infinity 会拒绝所有响应）',
                BxfError.ERR_BAD_OPTION_VALUE,
                spec.source,
            );
        }
    }
    spec.beforeInterceptors = isFunction(merged.beforeInterceptors) ? merged.beforeInterceptors : undefined;
    spec.auth = merged.auth;
    spec.xsrfHeaderName = merged.xsrfHeaderName;
    spec.xsrfCookieName = merged.xsrfCookieName;

    return spec;
}

export default normalizeRequest;
