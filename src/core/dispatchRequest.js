import { isFunction } from '../utils/index.js';
import BxfError from './BxfError.js';

// 支持响应类型（两个引擎共用同一张白名单）
export const RESPONSE_TYPES = [
    'auto', 'text', 'json', 'blob', 'arraybuffer',
    'document', 'raw', 'stream',
];

// normalizeRequest 会先 lowercase，这里只处理空值
export const RESPONSE_TYPE_ALIASES = {
    '': 'auto',
};

/* ------------------------------------------------------------------ *
 * 能力矩阵
 * 无法对等的能力不做模拟：fetch 没有上传进度，XHR 没有真流式响应体。
 * 显式指定了引擎却要求它不支持的能力 -> 直接抛 ERR_UNSUPPORTED，
 * 不会偷偷换引擎；只有「未指定引擎」时才自动挑选。
 * ------------------------------------------------------------------ */
export const CAPABILITY_STREAM = 'responseType="stream"';
export const CAPABILITY_PROGRESS = '上传/下载进度回调';

export function requiredCapabilities(spec) {
    const caps = [];
    if (spec.responseType === 'stream') caps.push(CAPABILITY_STREAM);
    if (isFunction(spec.onUploadProgress) || isFunction(spec.onDownloadProgress)) {
        caps.push(CAPABILITY_PROGRESS);
    }
    return caps;
}

function unsupportedFor(engine, caps) {
    const list = [];
    if (engine === 'xhr' && caps.includes(CAPABILITY_STREAM)) list.push(CAPABILITY_STREAM);
    if (engine === 'fetch' && caps.includes(CAPABILITY_PROGRESS)) list.push(CAPABILITY_PROGRESS);
    return list;
}

/**
 * 决定最终引擎。
 *  1. 自定义函数引擎：原样返回，不做能力自动选（需自行遵守 Request/Response 契约）
 *  2. 显式指定 'fetch'/'xhr'：不自动切换；不支持所需能力 -> 抛 ERR_UNSUPPORTED
 *  3. 未指定：按所需能力挑唯一支持的引擎；都支持 -> fetch 优先
 *  4. 能力互斥（stream + 进度）且未指定：抛 ERR_UNSUPPORTED
 */
export function resolveEngineName(spec) {
    const hasFetch = typeof globalThis.fetch === 'function';
    const hasXHR = typeof XMLHttpRequest !== 'undefined';
    const caps = requiredCapabilities(spec);
    const needsStream = caps.includes(CAPABILITY_STREAM);
    const needsProgress = caps.includes(CAPABILITY_PROGRESS);
    const config = spec.source || spec;
    const unavailable = (engine) => new BxfError(
        `engine="${engine}" 在当前环境不可用`,
        BxfError.ERR_UNSUPPORTED,
        config,
    );

    let requested = spec.engine;
    let explicit = null;

    if (typeof requested === 'function') {
        // 只把「全局原生的 fetch / XMLHttpRequest 引用」当作内建引擎；
        // 按函数名匹配（'fetch'/'xhr'）会把恰好同名的自定义函数误判为内建引擎，
        // 导致用户传入的自定义引擎被直接丢弃、实际跑了内建引擎。
        if (requested === globalThis.fetch) {
            explicit = 'fetch';
        } else if (requested === globalThis.XMLHttpRequest) {
            explicit = 'xhr';
        } else {
            return requested; // 自定义引擎
        }
    } else if (typeof requested === 'string' && ['xhr', 'fetch'].includes(requested.toLowerCase())) {
        explicit = requested.toLowerCase();
    }

    if (explicit) {
        const unsupported = unsupportedFor(explicit, caps);
        if (unsupported.length) {
            throw new BxfError(
                `engine="${explicit}" 不支持 ${unsupported.join('、')}；请更换引擎或去掉该能力`,
                BxfError.ERR_UNSUPPORTED,
                config,
            );
        }
        if (explicit === 'fetch' && !hasFetch) throw unavailable('fetch');
        if (explicit === 'xhr' && !hasXHR) throw unavailable('xhr');
        return explicit;
    }

    // 未指定引擎：能力互斥时无法选出任何引擎
    if (needsStream && needsProgress) {
        throw new BxfError(
            '能力冲突：responseType="stream" 只有 fetch 支持，进度回调只有 XHR 支持，请显式指定其中一种引擎',
            BxfError.ERR_UNSUPPORTED,
            config,
        );
    }
    if (needsStream) {
        if (!hasFetch) throw unavailable('fetch');
        return 'fetch';
    }
    if (needsProgress) {
        if (!hasXHR) throw unavailable('xhr');
        return 'xhr';
    }
    // 两者都支持的场景一律 fetch 优先
    if (hasFetch) return 'fetch';
    if (hasXHR) return 'xhr';
    throw unavailable('fetch');
}

/* ------------------------------------------------------------------ *
 * 原生 API 获取（MV3 核心能力，保持原有实现）
 * 通过 about:blank iframe 取一份未被网页 hook 的 fetch / XMLHttpRequest。
 * Service Worker 里没有 document，直接使用全局引用。
 * ------------------------------------------------------------------ */
let nativeEngine = null;
let nativeEnginePending = null;

export const getRequestEngine = async (apiName, isNative = false) => {
    const defEngine = {
        xhr: globalThis?.XMLHttpRequest,
        fetch: globalThis?.fetch,
    };
    if (!isNative) {
        return apiName.toLowerCase() === 'xhr' ? defEngine.xhr : defEngine.fetch;
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
                    nativeEngine = result;
                }).catch(() => {
                    nativeEngine = defEngine;
                });
            }
            await nativeEnginePending;
        } else {
            nativeEngine = defEngine;
        }
    }
    return apiName.toLowerCase() === 'xhr' ? nativeEngine.xhr : nativeEngine.fetch;
};
