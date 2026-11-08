/**
 * 并发压力与边界暴力测试（归档前最后一轮）。
 *
 * 运行：
 *   node --experimental-default-type=module test/stress.test.mjs
 *
 * 零第三方依赖、自包含：真实 HTTP 场景用 node:http 起在随机端口，跑完即关。
 * 覆盖三条线：
 *   A. 资源泄漏（timeout 定时器 / abort 监听器）—— 用 getActiveResourcesInfo 硬指标
 *   B. 并发状态隔离（共享配置对象、拦截器、defaults、SSE 多流、replay）
 *   C. 畸形配置 fuzz（恒返回 Promise、不崩进程、错误码可判定）
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { getEventListeners } from 'node:events';
import { createClient } from '../src/core/createClient.js';

const ABS = 'http://127.0.0.1:9/x';
const jsonRes = (status = 200, body = '{"ok":1}') => new Response(body, {
    status, headers: { 'content-type': 'application/json' },
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const countTimers = () => process.getActiveResourcesInfo().filter(t => t === 'Timeout').length;

let passed = 0;
const failures = [];
async function check(name, fn) {
    if (process.env.BXF_VERBOSE) console.error('  →', name);
    try { await fn(); passed++; }
    catch (e) { failures.push(`${name}: ${e.message}`); }
}

const unhandled = [];
process.on('unhandledRejection', (e) => unhandled.push(String((e && e.message) || e)));

/* ==================== A. 资源泄漏 ==================== */

await check('自定义引擎成功 30 次带 timeout：无定时器残留', async () => {
    const api = createClient();
    const before = countTimers();
    await Promise.all(Array.from({ length: 30 }, () => api({
        url: ABS, timeout: 1000, engine: async () => jsonRes(),
    })));
    assert.equal(countTimers(), before, '自定义函数引擎成功路径泄漏 timeout 定时器');
});

await check('自定义引擎 500 并发带 timeout：无定时器残留', async () => {
    const api = createClient();
    const before = countTimers();
    await Promise.all(Array.from({ length: 500 }, () => api({
        url: ABS, timeout: 1000, engine: async () => jsonRes(),
    })));
    assert.equal(countTimers(), before);
});

await check('库自带 fetch 引擎带 timeout：无定时器残留（对照组）', async () => {
    const api = createClient();
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => jsonRes();
    const before = countTimers();
    try {
        await Promise.all(Array.from({ length: 30 }, () => api({ url: ABS, timeout: 1000 })));
        assert.equal(countTimers(), before);
    } finally {
        globalThis.fetch = realFetch;
    }
});

await check('自定义引擎抛错 / 响应拦截器抛错并发：无定时器残留', async () => {
    const api = createClient();
    const before = countTimers();
    const bad = async () => { throw Object.assign(new Error('net down'), { code: 'ERR_NETWORK' }); };
    const inst = createClient();
    inst.interceptors.response.use(() => { throw new Error('resp boom'); });
    await Promise.all([
        ...Array.from({ length: 40 }, () => api({ url: ABS, timeout: 1000, engine: bad }).catch(() => {})),
        ...Array.from({ length: 40 }, () => inst({ url: ABS, timeout: 1000, engine: async () => jsonRes() }).catch(() => {})),
    ]);
    assert.equal(countTimers(), before);
});

await check('beforeInterceptors 各终止分支并发：无定时器残留', async () => {
    const api = createClient();
    const before = countTimers();
    await Promise.all([
        ...Array.from({ length: 20 }, () => api({
            url: ABS, timeout: 1000, beforeInterceptors: () => false,
            engine: async () => jsonRes(),
        }).catch(() => {})),
        ...Array.from({ length: 20 }, () => api({
            url: ABS, timeout: 1000, beforeInterceptors: () => Promise.reject(new Error('x')),
            engine: async () => jsonRes(),
        }).catch(() => {})),
        ...Array.from({ length: 20 }, () => api({
            url: ABS, timeout: 1000, beforeInterceptors: () => { throw new Error('sync'); },
            engine: async () => jsonRes(),
        }).catch(() => {})),
    ]);
    assert.equal(countTimers(), before);
});

await check('AbortSignal.any 可用时共享 signal 不累积监听器', async () => {
    const api = createClient();
    const ctrl = new AbortController();
    const sig = ctrl.signal;
    const l0 = getEventListeners(sig, 'abort').length;
    await Promise.all(Array.from({ length: 50 }, () => api({
        url: ABS, signal: sig, engine: async () => jsonRes(),
    })));
    assert.equal(getEventListeners(sig, 'abort').length, l0);
});

await check('老环境 fallback（无 AbortSignal.any）共享 signal 不累积监听器', async () => {
    const orig = AbortSignal.any;
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true, writable: true });
    try {
        const api = createClient();
        const ctrl = new AbortController();
        const sig = ctrl.signal;
        const l0 = getEventListeners(sig, 'abort').length;
        await Promise.all(Array.from({ length: 50 }, () => api({
            url: ABS, signal: sig, timeout: 1000, engine: async () => jsonRes(),
        })));
        assert.equal(getEventListeners(sig, 'abort').length, l0,
            'fallback 路径泄漏了 abort 监听器（高频请求会累积到 MaxListenersExceededWarning）');
    } finally {
        Object.defineProperty(AbortSignal, 'any', { value: orig, configurable: true, writable: true });
    }
});

/* ==================== B. 并发状态隔离 ==================== */

await check('拦截器返回同一共享对象：并发请求的 signal 彼此独立', async () => {
    const captured = [];
    const engine = async (s) => {
        await Promise.resolve(); // 让第二个请求有机会覆盖共享对象
        captured.push(s.signal);
        return jsonRes();
    };
    const shared = { url: ABS, engine };
    const inst = createClient();
    inst.interceptors.request.use(() => shared);
    const out = await Promise.all([
        inst({ url: ABS, engine, timeout: 1000 }),
        inst({ url: ABS, engine, timeout: 1000 }),
    ]);
    assert.equal(captured.length, 2);
    assert.notEqual(captured[0], captured[1], '两个请求共用了一个 signal，取消/超时会串到别的请求');
    assert.equal(out[0].status, 200);
    assert.equal(out[1].status, 200);
});

await check('拦截器返回新对象时 res.config 仍是纯数据（不含内部控制字段）', async () => {
    const inst = createClient();
    inst.interceptors.request.use(cfg => ({ ...cfg, headers: { ...cfg.headers, 'x-token': 'T' } }));
    const r = await inst({ url: ABS, timeout: 1000, engine: async () => jsonRes() });
    assert.doesNotThrow(() => JSON.stringify(r.config));
    assert.equal(r.config.signal, undefined, 'res.config 不应带本次请求的 signal');
    assert.equal(r.config.cleanup, undefined);
    assert.equal(r.config.abort, undefined);
    assert.equal(r.config.headers['x-token'], 'T', '拦截器新增的请求头应保留在 config 里');
});

await check('真实 HTTP 200 并发：URL / body / headers / config 零串扰', async () => {
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
            const u = new URL(req.url, 'http://x');
            res.writeHead(Number(u.searchParams.get('code') || 200), {
                'content-type': 'application/json',
            });
            res.end(JSON.stringify({ method: req.method, url: req.url, idx: req.headers['x-index'], body }));
        });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
        const base = `http://127.0.0.1:${server.address().port}/echo`;
        const api = createClient();
        const N = 200;
        const out = await Promise.all(Array.from({ length: N }, (_, i) => api({
            url: base, method: i % 3 === 0 ? 'POST' : 'GET',
            data: i % 3 === 0 ? { i } : undefined,
            params: { i },
            headers: { 'x-index': String(i) },
            timeout: 3000,
        }).then(r => ({ i, status: r.status, d: r.data }))));
        assert.equal(out.length, N);
        const bad = out.filter(o => String(o.d.idx) !== String(o.i) || !o.d.url.includes(`i=${o.i}`));
        assert.equal(bad.length, 0, `串扰 ${bad.length} 条，样例 ${JSON.stringify(bad[0])}`);
        for (const o of out) {
            if (o.i % 3 === 0) assert.equal(o.d.body, JSON.stringify({ i: o.i }));
        }
    } finally {
        server.closeAllConnections?.();
        await new Promise(r => server.close(r));
    }
});

await check('并发过程中 eject 拦截器：不崩溃、剩余拦截器仍生效', async () => {
    const api = createClient();
    const id = api.interceptors.request.use(c => ({ ...c, tag: 'first' }));
    api.interceptors.request.use(c => ({ ...c, tag2: 'second' }));
    const tasks = Array.from({ length: 60 }, (_, i) => api({
        url: ABS,
        engine: async (s) => new Response(JSON.stringify({ tag: s.tag, tag2: s.tag2, i }), {
            headers: { 'content-type': 'application/json' },
        }),
    }).then(r => r.data, e => ({ err: e.code })));
    api.interceptors.request.eject(id);
    const out = await Promise.all(tasks);
    assert.equal(out.length, 60);
    assert.equal(out.filter(o => o && o.err).length, 0);
    assert.equal(out[0].tag2, 'second');
});

await check('defaults 在并发请求发起后被修改：不污染任何请求', async () => {
    const api = createClient({ headers: { 'x-base': 'v1' } });
    const p = Array.from({ length: 100 }, (_, i) => api({
        url: ABS, headers: { 'x-index': String(i) },
        engine: async (s) => new Response(JSON.stringify({
            base: s.headers['x-base'], idx: s.headers['x-index'],
        }), { headers: { 'content-type': 'application/json' } }),
    }).then(r => r.data));
    api.defaults.headers['x-base'] = 'MUTATED';
    const out = await Promise.all(p);
    assert.equal(out.filter(o => o.base !== 'v1' || o.idx === undefined).length, 0);
});

await check('并发 30 路 SSE 流：帧内容与帧数彼此隔离', async () => {
    const api = createClient();
    const makeStream = (tag, frames) => {
        const enc = new TextEncoder();
        return new Response(new ReadableStream({
            start(c) {
                for (let i = 0; i < frames; i++) c.enqueue(enc.encode(`data: ${tag}-${i}\n\n`));
                c.close();
            },
        }), { headers: { 'content-type': 'text/event-stream' } });
    };
    const N = 30;
    const out = await Promise.all(Array.from({ length: N }, (_, tag) => {
        const got = [];
        return api({
            url: ABS, responseType: 'stream', onStream: (f) => got.push(f),
            engine: async () => makeStream(tag, 5),
        }).then(() => got, e => ({ err: e.code }));
    }));
    for (let tag = 0; tag < N; tag++) {
        assert.ok(Array.isArray(out[tag]), `第 ${tag} 路失败：${JSON.stringify(out[tag])}`);
        assert.deepEqual(out[tag], Array.from({ length: 5 }, (_, i) => `data: ${tag}-${i}`));
    }
});

await check('300 并发混合成功 / 网络错 / HTTP 500 / 主动取消：config 隔离且错误码正确', async () => {
    const api = createClient();
    const N = 300;
    const ctrl = new AbortController();
    const tasks = Array.from({ length: N }, (_, i) => {
        const kind = i % 4;
        const cfg = {
            url: `${ABS}?i=${i}`,
            headers: { 'x-index': String(i) },
            engine: async (s) => {
                if (kind === 1) throw Object.assign(new Error('net'), { code: 'ERR_NETWORK' });
                if (kind === 2) return jsonRes(500, '{"e":1}');
                if (kind === 3) {
                    await sleep(15);
                    if (s.signal.aborted) throw s.signal.reason;
                }
                return jsonRes(200, `{"i":${i}}`);
            },
        };
        if (kind === 3) cfg.signal = ctrl.signal;
        return api(cfg).then(
            r => ({ i, ok: true, idx: r.config.headers['x-index'], data: r.data }),
            e => ({ i, ok: false, code: e.code, idx: e.config && e.config.headers && e.config.headers['x-index'] }),
        );
    });
    setTimeout(() => ctrl.abort(), 2);
    const out = await Promise.all(tasks);
    assert.equal(out.length, N);
    assert.equal(out.filter(o => String(o.idx) !== String(o.i)).length, 0, 'config 发生串扰');
    const canceled = out.filter(o => o.i % 4 === 3);
    assert.ok(canceled.every(o => !o.ok && o.code === 'ERR_CANCELED'),
        `取消分支错误码异常：${JSON.stringify(canceled.slice(0, 2))}`);
    assert.ok(out.filter(o => o.i % 4 === 0).every(o => o.ok && o.data.i === o.i));
});

await check('每请求独立 resolveStatus：并发下规则不串', async () => {
    const api = createClient();
    const out = await Promise.all(Array.from({ length: 100 }, (_, i) => api({
        url: ABS, resolveStatus: i % 2 ? [200, 300] : 500,
        engine: async () => jsonRes(200),
    }).then(() => 'resolve', e => e.code === 'ERR_HTTP_STATUS' ? 'reject' : e.code)));
    assert.equal(out.filter((v, i) => v !== (i % 2 ? 'resolve' : 'reject')).length, 0);
});

await check('并发 replay：err.config 重新发起后配置仍隔离', async () => {
    const api = createClient();
    const failing = async () => { throw Object.assign(new Error('net'), { code: 'ERR_NETWORK' }); };
    const errs = await Promise.all(Array.from({ length: 60 }, (_, i) => api({
        url: ABS, headers: { 'x-index': String(i) }, engine: failing,
    }).catch(e => e)));
    assert.ok(errs.every(e => e.isBxfError && e.code === 'ERR_NETWORK'));
    const replayed = await Promise.all(errs.map(e => api({
        ...e.config, engine: async () => jsonRes(),
    })));
    assert.equal(replayed.filter((r, i) => r.config.headers['x-index'] !== String(i)).length, 0);
});

/* ==================== C. 畸形配置 fuzz ==================== */

await check('畸形配置矩阵：恒返回 Promise、不崩进程、全部能 settle', async () => {
    const api = createClient();
    const cyc = {}; cyc.self = cyc;
    const matrix = [
        ['headers = Symbol', { headers: Symbol('x') }],
        ['headers = null', { headers: null }],
        ['headers = Map', { headers: new Map([['x-a', '1']]) }],
        ['headers = 数字', { headers: 123 }],
        ['url = 对象', { url: { a: 1 } }],
        ['url = 空串', { url: '' }],
        ['params = null', { params: null }],
        ['params = 超长字符串', { params: 'a=' + 'x'.repeat(5000) }],
        ['params = 数字', { params: 42 }],
        ['data = undefined', { data: undefined }],
        ['data = BigInt', { method: 'POST', data: 10n }],
        ['data = 循环引用', { method: 'POST', data: cyc }],
        ['timeout = -1', { timeout: -1 }],
        ['timeout = Infinity', { timeout: Infinity }],
        ['timeout = 非数字字符串', { timeout: 'abc' }],
        ['resolveStatus = 字符串', { resolveStatus: '200' }],
        ['resolveStatus = 空数组', { resolveStatus: [] }],
        ['responseType = 未知值', { responseType: 'NOPE' }],
        ['responseType = 大写 JSON', { responseType: 'JSON' }],
        ['engine = 未知字符串', { engine: 'bogus' }],
        ['charset = 未知编码', { charset: 'not-a-charset' }],
        ['signal 已 aborted', { signal: AbortSignal.abort(new Error('pre')) }],
        ['onlyData = 字符串', { onlyData: 'yes' }],
        ['beforeInterceptors = null', { beforeInterceptors: null }],
    ];
    for (const [label, extra] of matrix) {
        let p;
        assert.doesNotThrow(() => {
            p = api({ url: ABS, engine: async () => jsonRes(), ...extra });
        }, `${label}: bxf() 不应同步抛错`);
        assert.ok(p && typeof p.then === 'function', `${label}: 必须返回 Promise`);
        await p.then(() => {}, () => {}); // 成功失败都算正常 settle
    }
});

await check('循环引用配置：返回 rejected Promise（已知边界，不崩进程）', async () => {
    const api = createClient();
    const cyc = {}; cyc.self = cyc;
    const e = await api({ url: ABS, method: 'POST', data: cyc, engine: async () => jsonRes() }).catch(x => x);
    assert.ok(e, '应当 reject');
    assert.equal(e.isBxfError, true, '应统一包装成 BxfError');
    // 当前错误码为 ERR_UNKNOWN / 栈溢出信息；不崩进程、契约不破即可
});

await check('超长中文 / 特殊字符 params 并发：编码正确不丢参', async () => {
    const api = createClient();
    const seen = [];
    await Promise.all(Array.from({ length: 50 }, (_, i) => api({
        url: ABS,
        params: { q: `中文-${i}-&?=#`, n: { deep: [1, 2, `值${i}`] } },
        engine: async (s) => { seen.push(s.url); return jsonRes(); },
    })));
    assert.equal(seen.length, 50);
    assert.equal(new Set(seen).size, 50, '并发 params 出现串扰');
    for (const url of seen) assert.ok(/%E4%B8%AD%E6%96%87/.test(url), `中文未编码：${url}`);
});

await check('responseType 大小写别名与非法值降级', async () => {
    const api = createClient();
    for (const t of ['JSON', 'Json', 'TEXT', '', undefined]) {
        const r = await api({ url: ABS, responseType: t, engine: async () => jsonRes(200, '"hi"') });
        assert.equal(r.status, 200);
    }
    const r = await api({ url: ABS, responseType: 'NOPE', engine: async () => jsonRes(200, '{"a":1}') });
    assert.deepEqual(r.data, { a: 1 }, '非法 responseType 应降级为 auto');
});

/* ==================== 汇总 ==================== */

await sleep(20); // 让尾部微任务 / 连接回收完成，避免误判残留
await check('全程无 unhandledRejection', () => {
    assert.equal(unhandled.length, 0, `出现 ${unhandled.length} 条：${unhandled.slice(0, 3)}`);
});
await check('全程无残留 timeout 定时器', () => {
    const left = countTimers();
    assert.equal(left, 0, `残留 ${left} 个 Timeout（进程会多挂到超时到期）`);
});

if (failures.length) {
    console.error(`\n并发与边界暴力测试失败 ${failures.length} 项 / 共 ${passed + failures.length} 项：`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
}
console.log(`\n并发与边界暴力测试全部通过：${passed} 项`);
