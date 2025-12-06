import {getType, isInt} from '../utils/index'

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
