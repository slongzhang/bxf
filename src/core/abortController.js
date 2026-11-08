import { isInt } from '../utils/index.js'

/**
 * 合并多个 AbortSignal（等价于 AbortSignal.any）。
 * 不改写全局对象，避免在 MV3 Service Worker 里污染宿主环境。
 */
function anySignal(signals) {
    if (typeof AbortSignal.any === 'function') {
        // 原生实现内部自行管理依赖，无需手动解绑
        return { signal: AbortSignal.any(signals), dispose: () => {} };
    }
    const controller = new AbortController();
    const combined = controller.signal;
    let done = false;
    const detach = () => {
        signals.forEach(s => s.removeEventListener('abort', onAbort));
    };
    const onAbort = (event) => {
        if (done) return;
        done = true;
        detach();
        // 透传触发源的 reason，让上层能区分超时 / 主动取消
        try {
            controller.abort(event && event.target ? event.target.reason : undefined);
        } catch (e) {
            controller.abort();
        }
    };
    for (const signal of signals) {
        if (signal.aborted) { onAbort({ target: signal }); break; }
        signal.addEventListener('abort', onAbort, { once: true });
    }
    // 请求正常结束时必须解绑：外部 signal 往往是长寿对象（页面卸载信号 /
    // 全局刷新 token 的 signal），不解绑会让每个请求都留下一个 abort 监听器，
    // 高频调用下累积到 MaxListenersExceededWarning 并泄漏闭包。
    const dispose = () => {
        if (done) return;
        done = true;
        detach();
    };
    return { signal: combined, dispose };
}

/**
 * 中断与超时控制器。
 * 注意：入参必须是「合并 defaults 之后」的最终 spec，
 * 旧版传入的是原始 config，导致 create({timeout}) / create({signal}) 完全失效。
 */
export function abortController({
    signal: userSignal,
    timeout,
} = {}) {
    const internalController = new AbortController();
    const signalArr = [internalController.signal];

    let timer = null;
    if (isInt(timeout) && timeout > 0) {
        // 刻意不用 AbortSignal.timeout()：它是不可取消的，会在响应头到达后
        // 继续计时并掐断仍在中转的响应体流（代理下载「边下边传」场景）。
        // 改用可清除的 setTimeout，cleanup() 后超时即失效。
        // 语义：timeout 覆盖到「引擎交出响应」为止。
        //   - raw 模式引擎拿到响应头就交出 -> 超时只作用于等待响应头
        //   - stream / 普通模式要读完响应体 -> 超时覆盖整个请求
        timer = setTimeout(() => {
            const reason = new Error(`TimeoutError: signal timed out after ${timeout}ms`);
            reason.name = 'TimeoutError';
            reason.code = 'ETIMEDOUT';
            internalController.abort(reason);
        }, timeout);
    }

    if (userSignal && typeof userSignal.addEventListener === 'function') {
        signalArr.push(userSignal);
    }

    const { signal, dispose } = anySignal(signalArr);

    const cleanup = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        dispose();
    };

    const abort = (reason) => {
        const cancelReason = reason !== undefined
            ? reason
            : Object.assign(new Error('Request canceled'), { name: 'AbortError', code: 'ERR_CANCELED' });
        internalController.abort(cancelReason);
    };

    return { signal, cleanup, abort };
}
