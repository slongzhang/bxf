import Cancel from "./cancel";
export default class CancelToken {
    promise;// 定义 promise 变量，用来存储状态
    reason; // 定义错误原因变量

    constructor(executor) {
        // 定义一个空变量，用它来存储一个 promise 实例的 resolve 方法
        let resolvePromise;
        this.promise = new Promise(resolve => {
            resolvePromise = resolve
        })

        const paramFn = message => {
            if (this.reason) {
                return
            }
            this.reason = new Cancel(message)
            resolvePromise(this.reason)
        };
        // 执行实例化时传入的方法，并使用 paramFn 作为参数传入
        executor(paramFn)
    }

    throwIfRequested() {
        if (this.reason) {
            throw this.reason
        }
    }
    // 定义 source 静态方法，导出 CancelToken 实例以及取消方法 cancel
    static source() {
        let cancel;
        const token = new CancelToken(c => {
            cancel = c
        })
        return {
            cancel,
            token
        }
    }
}
