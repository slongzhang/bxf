/**
 * bxf 控制台实验室 · 工具库（浏览器 IIFE，非模块）
 * ------------------------------------------------------------------
 * 页面上先加载 dist/bxf.umd.js，再加载本文件。挂到 window 的全局：
 *
 *   api            已配好的 bxf 实例（无 defaults，方便逐条对照）
 *   apiUrl(n, x)   拼出同源端点地址，x 可为 'code=429' 或 {code:429}
 *   crossUrl(n, x) 拼出「跨源站」地址（PORT+1，带 CORS 头）
 *   instance(cfg)  bxf.create(cfg) 的便捷封装
 *   show(x, label) 万能打印器：自动识别 BxfResponse / BxfError / 普通值
 *   grab(p, label) 成功/失败都打印（await grab(...) 可保证页内运行等到输出）
 *   dump / inspect 连不可枚举属性一起列出
 *   meta(x)        只看不可枚举元数据 engine
 *   cmp(cfg)       同一份配置分别跑 fetch / xhr，打印差异
 *   probeAll()     批量探测代表性端点，输出对照表
 *   sleep(ms)
 *
 * 约定：案例全部写成「一行表达式」，无顶层 const/let，可在 DevTools
 * 控制台反复粘贴执行；改 options 里的参数即可对比结果。
 */
(function (global) {
    'use strict';

    var LAB = global.__LAB__ || {};
    var hasBxf = global.bxf && typeof global.bxf.create === 'function';

    if (!hasBxf) {
        global.apiUrl = function () { return ''; };
        global.show = function (x) { console.error('[lab] bxf 未加载，请先执行 pnpm run build'); return x; };
        global.grab = function (p) { return Promise.resolve(p).catch(global.show); };
        console.error('[lab] dist/bxf.umd.js 未加载。请在仓库根目录执行 pnpm run build 后刷新。');
        return;
    }

    /* ---------------- 实例与地址 ---------------- */
    // 不带 defaults：每条案例的参数都显式可见，改起来最直观
    global.api = global.bxf.create({});
    global.instance = function (defaults) { return global.bxf.create(defaults); };

    function buildQuery(extra) {
        if (!extra) return '';
        if (typeof extra === 'string') return extra;
        if (typeof extra === 'object') {
            return Object.keys(extra).map(function (k) {
                return encodeURIComponent(k) + '=' + encodeURIComponent(extra[k]);
            }).join('&');
        }
        return String(extra);
    }

    global.apiUrl = function (name, extra) {
        var q = buildQuery(extra);
        return global.location.origin + global.location.pathname +
            '?api=' + encodeURIComponent(name) + (q ? '&' + q : '');
    };

    global.crossUrl = function (name, extra) {
        var q = buildQuery(extra);
        return 'http://127.0.0.1:' + (LAB.crossPort || 7789) + '/?api=' +
            encodeURIComponent(name) + (q ? '&' + q : '');
    };

    global.sleep = function (ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    };

    /* ---------------- 对象识别 ---------------- */
    function isBxfResponse(x) {
        return !!(x && typeof x === 'object' &&
            Object.prototype.hasOwnProperty.call(x, 'data') &&
            Object.prototype.hasOwnProperty.call(x, 'status') &&
            Object.prototype.hasOwnProperty.call(x, 'config'));
    }
    function typeOf(v) {
        if (v === null) return 'null';
        if (v === undefined) return 'undefined';
        if (v instanceof ArrayBuffer) return 'ArrayBuffer';
        if (typeof Blob !== 'undefined' && v instanceof Blob) return 'Blob';
        if (typeof Document !== 'undefined' && v instanceof Document) return 'Document';
        if (typeof Response !== 'undefined' && v instanceof Response) return 'Response';
        if (v instanceof Error) return v.name;
        if (Array.isArray(v)) return 'Array(' + v.length + ')';
        return typeof v;
    }
    global.typeOf = typeOf;

    /** 只看不可枚举的元数据（engine 不会出现在 Object.keys 里） */
    global.meta = function (x, label) {
        if (!x || typeof x !== 'object') { console.log('meta: 非对象', x); return x; }
        console.log((label ? '【' + label + '】' : '') + 'meta →', {
            engine: x.engine,
            enumerableKeys: Object.keys(x),
        });
        return x;
    };

    /** 连不可枚举属性一起列出（engine 就藏在这里） */
    global.inspect = function (obj, label) {
        if (label) console.log('──── ' + label + ' ────');
        if (obj === null || typeof obj !== 'object') {
            console.log('非对象：', obj); return obj;
        }
        var names = Object.getOwnPropertyNames(obj);
        console.log('类型：', Object.prototype.toString.call(obj),
            '| 构造器：', obj.constructor && obj.constructor.name);
        console.log('全部自有属性：', names.map(function (k) {
            var d = Object.getOwnPropertyDescriptor(obj, k);
            return k + (d && d.enumerable ? '' : '(不可枚举)');
        }));
        names.forEach(function (k) {
            var d = Object.getOwnPropertyDescriptor(obj, k);
            if (d && 'value' in d) console.log('  .' + k + ' =', d.value);
        });
        console.log('完整对象（可展开）：', obj);
        return obj;
    };

    /** 万能打印器：一条案例的输出就能看清全部属性 */
    global.show = function (x, label) {
        var tag = label ? '【' + label + '】' : '';
        if (x && x.isBxfError) {
            console.log('──── ' + tag + 'BxfError / ' + x.code + ' ────');
            console.log('message      =', x.message);
            console.log('code         =', x.code);
            console.log('status       =', x.status);
            console.log('engine       =', x.engine, '| causeName =', x.causeName);
            console.log('config(可回喂)=', x.config);
            console.log('err.response (小写=整包 BxfResponse) =', x.response);
            if (x.response) {
                console.log('  .data      =', x.response.data);
                console.log('  .status    =', x.response.status);
                console.log('  字段       =', Object.keys(x.response).join(', '));
                console.log('  原生句柄   = 不对外暴露；需要时用 responseType: "raw"');
            } else {
                console.log('  ↑ undefined：网络层/超时/取消失败，根本没拿到 HTTP 响应');
            }
            console.log('完整错误对象（可展开）：', x);
        } else if (isBxfResponse(x)) {
            console.log('──── ' + tag + 'BxfResponse / status ' + x.status + ' ────');
            console.log('data         =', x.data, '| 类型:', typeOf(x.data));
            console.log('statusText   =', x.statusText);
            console.log('headers      =', x.headers);
            console.log('config(可回喂)=', x.config);
            console.log('原生句柄     =', (typeof Response !== 'undefined' && x.data instanceof Response)
                ? '已在 res.data（raw 模式）' : '不暴露；需要时指定 responseType: "raw"');
            console.log('字段         =', Object.keys(x).join(', '), '（固定 5 字段）');
            console.log('meta         = { engine:', x.engine, '}（不可枚举）');
            console.log('完整响应对象（可展开）：', x);
        } else {
            console.log('──── ' + tag + '返回值 ────', x, '| 类型:', typeOf(x));
        }
        return x;
    };

    /** 成功失败都打印；配合 await 可让页内「运行」按钮等到全部输出 */
    global.grab = async function (promise, label) {
        try { return global.show(await promise, label); }
        catch (e) { return global.show(e, label); }
    };

    /** 详细展开（先看 show，再看 dump） */
    global.dump = function (x, label) { return global.inspect(x, label); };

    /** 同一份配置跑双引擎，打印差异 */
    global.cmp = async function (config, label) {
        var out = [];
        for (var engine of ['fetch', 'xhr']) {
            try {
                var r = await global.api(Object.assign({}, config, { engine: engine }));
                out.push({
                    engine: engine, result: 'resolve', status: r.status,
                    data: typeOf(r.data),
                    native: (typeof Response !== 'undefined' && r.data instanceof Response)
                        ? 'res.data (raw)' : '不暴露',
                    fields: Object.keys(r).join(','), effective: r.engine,
                });
            } catch (e) {
                out.push({ engine: engine, result: 'reject', code: e.code, status: e.status, effective: e.engine });
            }
        }
        console.log('──── 双引擎对照 ' + (label || '') + ' ────');
        if (console.table) console.table(out); else console.log(out);
        return out;
    };

    /** 批量探测：一次性把代表性端点/能力跑一遍 */
    global.probeAll = async function () {
        var rows = [];
        var probes = [
            ['json 默认 auto', { url: global.apiUrl('json') }],
            ['text', { url: global.apiUrl('json'), responseType: 'text' }],
            ['429 默认 resolve', { url: global.apiUrl('status', 'code=429') }],
            ['429 被 resolveStatus 拒绝', { url: global.apiUrl('status', 'code=429'), resolveStatus: [[200, 300]] }],
            ['204 无响应体', { url: global.apiUrl('204') }],
            ['非法 JSON', { url: global.apiUrl('badjson'), responseType: 'json' }],
            ['binary -> arraybuffer', { url: global.apiUrl('binary'), responseType: 'arraybuffer' }],
            ['html -> document', { url: global.apiUrl('html'), responseType: 'document' }],
            ['重复头合并', { url: global.apiUrl('multiheader') }],
            ['onlyData', { url: global.apiUrl('json'), onlyData: true }],
            ['xhr 引擎', { url: global.apiUrl('json'), engine: 'xhr' }],
            ['stream 能力(自动 fetch)', { url: global.apiUrl('sse', 'n=2&ms=60'), responseType: 'stream' }],
            ['进度能力(自动 xhr)', { url: global.apiUrl('large', 'kb=32&chunks=4&ms=20'), onDownloadProgress: function () {} }],
            ['能力冲突(未指定引擎)', { url: global.apiUrl('sse', 'n=2&ms=20'), responseType: 'stream', onDownloadProgress: function () {} }],
            ['超时', { url: global.apiUrl('delay', 'ms=600'), timeout: 120 }],
            ['网络层失败', { url: 'http://127.0.0.1:1/nope' }],
        ];
        for (var p of probes) {
            try {
                var r = await global.api(p[1]);
                rows.push({
                    case: p[0], result: 'resolve', code: '-', status: r.status,
                    data: typeOf(r.data), engine: r.engine,
                });
            } catch (e) {
                rows.push({
                    case: p[0], result: 'reject', code: e.code, status: e.status || '-',
                    data: typeOf(e.response && e.response.data), engine: e.engine,
                });
            }
        }
        console.log('──── probeAll() 全库行为速览 ────');
        if (console.table) console.table(rows); else console.log(rows);
        return rows;
    };

    /** 错误码速查 */
    global.BXF_CODES = [
        'ETIMEDOUT', 'ERR_CANCELED', 'ERR_NETWORK', 'ERR_BAD_RESPONSE', 'ERR_BAD_REQUEST',
        'ERR_INVALID_URL', 'ERR_UNSUPPORTED', 'ERR_BAD_OPTION_VALUE', 'ERR_HTTP_STATUS',
        'BEFORE_TERMINATE', 'ERR_ABORT_SIGNAL',
    ];

    console.log('%c[bxf lab] 工具已就绪', 'color:#1d5fd0;font-weight:bold',
        '→ api / apiUrl() / crossUrl() / show() / grab() / dump() / inspect() / meta() / cmp() / probeAll()');
    console.log('[bxf lab] 试试：show(await api.get(apiUrl("json")))  或  probeAll()');
})(window);
