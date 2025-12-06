export class InterceptorManager {
    constructor() {
        this.handlers = [];
    }

    use(fulfilled, rejected) {
        // 过滤无用use
        if (typeof fulfilled !== 'function' && typeof rejected !== 'function') {
            return null;
        }
        this.handlers.push({ fulfilled, rejected });
        return this.handlers.length - 1;
    }

    eject(id) {
        if (this.handlers[id]) {
            this.handlers[id] = null;
        }
    }

    clear() {
        if (this.handlers.length > 0) {
            this.handlers.length = 0;
        }
    }
}