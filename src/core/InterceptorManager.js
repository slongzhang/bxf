// 拦截器相关
class InterceptorManager {
    // 定义一个数组，用来存储拦截器
    interceptors = [];

    use(resolved, rejected) {
        // 向数组推入拦截器对象
        this.interceptors.push({
            resolved,
            rejected,
        })
        // 返回拦截器在数组中索引
        return this.interceptors.length - 1
    }

    // 遍历数组
    forEach(fn) {
        this.interceptors.forEach(interceptor => {
            if (interceptor !== null) {
                fn(interceptor)
            }
        })
    }
    
    // 根据索引删除拦截器
    eject(id) {
        if (this.interceptors[id]) {
            this.interceptors[id] = null
        }
    }
}

export default InterceptorManager