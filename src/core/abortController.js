import {getType, isInt} from '../utils/index'

// 手动 polyfill AbortSignal.any()（如果环境不存在）
if (!AbortSignal.any) {
  AbortSignal.any = function (signals) {
    // 1. 参数校验：必须是数组，且数组项都是 AbortSignal 实例
    if (!Array.isArray(signals)) {
      throw new TypeError('Argument must be an array of AbortSignal instances');
    }
    for (const signal of signals) {
      if (!(signal instanceof AbortSignal)) {
        throw new TypeError('Each item in the array must be an AbortSignal');
      }
    }

    // 2. 创建一个新的 AbortController，用于返回合并后的 signal
    const combinedController = new AbortController();
    const { signal: combinedSignal } = combinedController;

    // 3. 定义回调函数：任意一个 signal 中止，就中止合并后的 signal
    const onAbort = () => {
      // 先移除所有 signal 的监听（避免内存泄漏）
      signals.forEach(s => s.removeEventListener('abort', onAbort));
      // 中止合并后的 signal（如果还未中止）
      if (!combinedSignal.aborted) {
        combinedController.abort();
      }
    };

    // 4. 为每个传入的 signal 添加 abort 监听
    for (const signal of signals) {
      // 如果某个 signal 已经中止，直接触发 onAbort
      if (signal.aborted) {
        onAbort();
        break;
      }
      signal.addEventListener('abort', onAbort);
    }

    // 5. 返回合并后的 signal
    return combinedSignal;
  };
}

// 中断与超时控制器
export function abortController({
    signal: userSignal,          // new AbortController
    timeout,         // number(ms)
} = {}) {
    const internalController = new AbortController();
    const signalArr = [internalController.signal];
    if (userSignal && userSignal instanceof AbortSignal) {
        signalArr.push(userSignal);
    }
    

    let timer = null;
    if (isInt(timeout) && timeout > 0) {
        if (typeof AbortSignal.timeout === 'function') {
            signalArr.push(AbortSignal.timeout(timeout))
        }
        else {
            timer = setTimeout(() => {
                if (!signal.aborted) {
                    internalController.abort('TimeoutError: signal timed out');
                }
            }, timeout)
        }
    }
    const signal = AbortSignal.any(signalArr);

    const cleanup = () => {
        if (timer) clearTimeout(timer);
    }

    return {
        signal,
        cleanup,
        abort: () => internalController.abort()
    };
}
