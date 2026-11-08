import { isFunction, matchesHttpStatus } from '../utils/index.js';
import { normalizeRequest, INTERNAL_CONFIG_KEYS } from './normalizeRequest.js';
import { isBxfResponse, normalizeResponse } from './normalizeResponse.js';
import { createRequest } from './httpMessage.js';
import { abortController } from './abortController.js';
import { dispatchWithInterceptors } from '../interceptors/dispatchWithInterceptors.js';
import fetchEngine from '../engines/fetchEngine.js';
import xhrEngine from '../engines/xhrEngine.js';
import BxfError from './BxfError.js';

/**
 * 核心请求函数。
 *
 * 编排顺序（对齐 @mswjs/interceptors）：
 *   4 种入口 -> normalizeRequest 产出唯一 RequestSpec（对外 config）
 *   -> WHATWG Request（引擎边界中间表示）-> 请求前钩子 -> 拦截器链
 *   -> 引擎适配器产出 WHATWG Response -> 统一解析层 -> BxfResponse
 *   -> onlyData
 */
export function bxf(urlOrConfig, config, _method, data, _undefined) {
    const ctx = {
        defaults: (this && this.defaults) || {},
        baseURL: (this && this.baseURL) || '',
        interceptors: (this && this.interceptors) || {
            request: { handlers: [] },
            response: { handlers: [] },
        },
    };
    const interceptors = ctx.interceptors;

    // 1) 唯一入参契约；能力冲突 / 非法配置在这里同步抛出，统一转成 rejected Promise
    let spec;
    try {
        spec = normalizeRequest(urlOrConfig, config, _method, data, ctx);
    } catch (error) {
        return Promise.reject(error && error.isBxfError
            ? error
            : BxfError.from(error, BxfError.resolveCode(error), undefined));
    }

    // 2) 中断/超时基于「合并后」的 spec
    const controller = abortController(spec);
    Object.assign(spec, {
        signal: controller.signal,
        cleanup: controller.cleanup,
        abort: controller.abort,
    });

    // 3) 引擎：resolveEngineName 已完成能力自动选择 / 显式能力校验
    const engine = spec.engine;
    const requestFn = typeof engine === 'function'
        ? engine
        : (engine === 'xhr' ? xhrEngine : fetchEngine);
    spec.engine = typeof engine === 'function' ? 'custom' : engine;

    // 4) 重放完全由调用方发起：成功拿 res.config、失败拿 err.config，
    //    自己再调一次 bxf(config)（刷新 token 后重试等）。库不做自动重放，
    //    也不再提供 retry() 糖与 retryCount 计数器。
    //    唯一对外元数据是实际生效引擎：config.engine 是用户传入的原值，
    //    可能被能力规则覆盖，这个值只能由库给出。
    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const defineIfAbsent = (target, key, value) => {
        if (hasOwn(target, key)) return;
        try {
            Object.defineProperty(target, key, {
                value, configurable: true, writable: true, enumerable: false,
            });
        } catch (e) { /* 冻结对象，忽略 */ }
    };
    // 不可枚举：不污染 Object.keys(res) 与 JSON 序列化。
    // 「仅在缺失时定义」保证响应拦截器返回的自定义对象保留自己的元数据。
    const attachEngine = (target) => {
        if (!target || (typeof target !== 'object' && typeof target !== 'function')) return target;
        defineIfAbsent(target, 'engine', spec.engine);
        return target;
    };

    // 5) 唯一错误出口 + 引擎边界的 WHATWG Request
    const wrappedEngine = async (finalSpec) => {
        // 请求拦截器忘了 return config 是常见误用。不在这里拦住的话，
        // createRequest(undefined) 会抛出误导性的 ERR_INVALID_URL / ERR_NETWORK。
        if (!finalSpec || (typeof finalSpec !== 'object' && typeof finalSpec !== 'function')) {
            throw new BxfError(
                '请求拦截器必须返回配置对象（记得 return config）',
                BxfError.ERR_BAD_OPTION_VALUE,
                spec.source || spec,
            );
        }
        // 请求拦截器可能返回新的 config 对象（axios 风格常见做法）。
        // signal/cleanup/abort 是库在 normalizeRequest 之后才注入的控制字段，
        // 若新对象不含它们，abort / timeout 会对本次请求静默失效。
        //
        // 但这三个字段只属于「本次请求」：直接写回用户提供的对象，会让多个
        // 并发请求共用同一个配置对象时互相覆盖（后发请求的 signal 盖掉先发
        // 请求，超时 / 取消从而串到别的请求）。因此建一份独立副本再注入。
        let engineSpec = spec;
        if (finalSpec !== spec) {
            engineSpec = Object.assign({}, finalSpec, {
                signal: controller.signal,
                cleanup: controller.cleanup,
                abort: controller.abort,
            });
            // 浅拷贝不会带过来不可枚举字段（如 source），补挂一遍；
            // 否则错误对象的 config 会退化成含运行时字段的 spec。
            for (const key of Object.getOwnPropertyNames(finalSpec)) {
                const desc = Object.getOwnPropertyDescriptor(finalSpec, key);
                if (desc && !desc.enumerable &&
                    !Object.prototype.hasOwnProperty.call(engineSpec, key)) {
                    Object.defineProperty(engineSpec, key, desc);
                }
            }
            // 新对象没有 source：补一份纯数据快照。否则 normalizeResponse 的
            // `config: spec.source || spec` 会把带 signal / cleanup / abort 的运行时
            // spec 当成 res.config / err.config 交出去，既不可回喂也不可序列化。
            if (!Object.prototype.hasOwnProperty.call(engineSpec, 'source')) {
                const snapshot = {};
                for (const [key, value] of Object.entries(finalSpec)) {
                    if (INTERNAL_CONFIG_KEYS.includes(key)) continue;
                    snapshot[key] = value;
                }
                // 与 normalizeRequest 的 source 保持一致：url 用原始入参地址
                snapshot.url = spec.initUrl || snapshot.url;
                Object.defineProperty(engineSpec, 'source', {
                    value: snapshot, enumerable: false, writable: true, configurable: true,
                });
            }
        }
        try {
            const request = createRequest(engineSpec);
            const result = await requestFn(engineSpec, request);

            // 自定义引擎只要返回标准 Response，就走同一套解析
            if (result && !isBxfResponse(result) &&
                typeof Response !== 'undefined' && result instanceof Response) {
                return attachEngine(await normalizeResponse(result, engineSpec));
            }
            return attachEngine(result);
        } catch (error) {
            if (error && error.isBxfError) throw attachEngine(error);
            const code = BxfError.resolveCode(error, engineSpec.signal);
            throw attachEngine(BxfError.from(error, code, engineSpec.source || engineSpec));
        }
    };

    // 6) 请求前钩子。
    // 两个契约：① 钩子同步抛错也必须返回 rejected Promise，不能让 bxf() 同步抛；
    // ② 任何「没走到引擎 finally」的失败路径都要清掉 timeout 定时器，
    //    否则一个 rejected 钩子就能让页面/进程多挂一整个 timeout 周期（实测 3s）。
    let handle;
    try {
        const result = isFunction(spec.beforeInterceptors)
            ? spec.beforeInterceptors(spec)
            : true;
        // Promise.resolve 同时覆盖普通值 / Promise / thenable
        handle = Promise.resolve(result);
    } catch (error) {
        controller.cleanup();
        return Promise.reject(attachEngine(
            error && error.isBxfError
                ? error
                : BxfError.from(error, BxfError.resolveCode(error), spec.source || spec),
        ));
    }

    return handle
        .then((value) => {
            if (value === false) {
                controller.cleanup();
                throw new BxfError(
                    'BeforeInterceptors terminate',
                    BxfError.BEFORE_TERMINATE,
                    spec.source || spec,
                );
            }
            return dispatchWithInterceptors(spec, wrappedEngine, interceptors);
        })
        .then((result) => {
            // 响应拦截器可能替换对象，这里补挂一次
            attachEngine(result);
            if (!isBxfResponse(result)) return result;

            // resolveStatus 与 onlyData 完全正交：
            //   - 不传 resolveStatus：只要拿到 HTTP 响应就 resolve（含 429 / 502）
            //   - 传了：命中规则才 resolve，否则 reject ERR_HTTP_STATUS
            //   - onlyData 只决定「返回 data 还是完整响应对象」
            const rule = spec.resolveStatus;
            if (rule !== undefined && rule !== null &&
                !matchesHttpStatus(rule, result.status, result)) {
                throw new BxfError(
                    `HTTP status ${result.status} not accepted`,
                    BxfError.ERR_HTTP_STATUS,
                    spec.source || spec,
                    result,
                );
            }
            return spec.onlyData ? result.data : result;
        })
        .catch((error) => {
            // 引擎成功时已在自身 finally 里 cleanup；这里兜住钩子失败、拦截器失败、
            // 自定义引擎失败等没走到引擎 finally 的路径。cleanup 幂等，可重复调用。
            controller.cleanup();
            const wrapped = (error && error.isBxfError)
                ? error
                : BxfError.from(error, BxfError.resolveCode(error, spec.signal), spec.source || spec);
            throw attachEngine(wrapped);
        })
        .finally(() => {
            // 统一收口：成功路径也要清。timeout 定时器与 signal 监听器此前只在
            // 库自带引擎的 finally / finish 里清，自定义函数引擎（engine: fn）
            // 没人兜底，带 timeout 的请求会一直挂到超时到期才释放。
            // cleanup 幂等，引擎内部已清过的重复调用无副作用。
            controller.cleanup();
        });
}

export default bxf;
