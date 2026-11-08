/**
 * 场景回归：
 *  1) responseType:'raw' 能否拿到未消费的原生 Response，做「边下载边上传」的流中转
 *  2) 请求结束后能否按原配置重放（token 过期 -> 刷新 -> 重试）
 *
 * 运行：node --experimental-default-type=module test/retry-stream.test.mjs
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { createClient } from '../src/core/createClient.js';

/* ---------------- 最小 XHR 实现 ---------------- */
class MockXHR {
    constructor() {
        this.readyState = 0; this.status = 0; this.statusText = '';
        this.response = null; this.responseType = ''; this.withCredentials = false;
        this.responseURL = '';
        this.upload = { onprogress: null };
        this._headers = {}; this._rawHeaders = []; this._req = null;
        this.onload = this.onerror = this.onabort = this.ontimeout = null;
        this.onprogress = this.onreadystatechange = null;
    }
    open(method, url) { this._method = method; this._url = url; this.readyState = 1; }
    setRequestHeader(k, v) { this._headers[k] = v; }
    getAllResponseHeaders() {
        return this._rawHeaders.map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n';
    }
    send(body) {
        const u = new URL(this._url);
        // 真实 XHR / 浏览器会为请求体设置 Content-Length；这里补上，
        // 否则 Node http 对 DELETE/OPTIONS 等「约定无 body」方法会吞掉分块体。
        const headers = { ...this._headers };
        if (body !== null && body !== undefined) {
            headers['content-length'] = String(body.byteLength ?? (body.length || 0));
        }
        const req = http.request({
            hostname: u.hostname, port: u.port,
            path: u.pathname + u.search, method: this._method, headers,
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                this.status = res.statusCode; this.statusText = res.statusMessage;
                this._rawHeaders = [];
                for (let i = 0; i < res.rawHeaders.length; i += 2) {
                    this._rawHeaders.push([res.rawHeaders[i], res.rawHeaders[i + 1]]);
                }
                const buf = Buffer.concat(chunks);
                this.response = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                this.readyState = 4;
                if (this.onprogress) this.onprogress({ loaded: buf.length, total: buf.length, lengthComputable: true });
                if (this.onreadystatechange) this.onreadystatechange();
                if (this.onload) this.onload();
            });
        });
        req.on('error', () => { if (this.onerror) this.onerror({ target: this }); });
        this._req = req;
        if (body !== null && body !== undefined) req.write(body);
        req.end();
    }
    abort() { if (this._req) this._req.destroy(); if (this.onabort) this.onabort({ target: this }); }
}
globalThis.XMLHttpRequest = MockXHR;

/* ---------------- 测试服务 ---------------- */
const BIG_CHUNK = Buffer.alloc(8192, 0x61);
const SLOW_CHUNK = Buffer.alloc(1024, 0x62);

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let body = [];
    req.on('data', c => body.push(c));
    req.on('end', () => {
        switch (url.pathname) {
            case '/big': {
                res.writeHead(200, { 'content-type': 'application/octet-stream' });
                let i = 0;
                const tick = () => {
                    if (i++ >= 16) return res.end();
                    res.write(BIG_CHUNK);
                    setTimeout(tick, 10);
                };
                return tick();
            }
            case '/slowstream': {
                res.writeHead(200, { 'content-type': 'application/octet-stream' });
                let i = 0;
                const tick = () => {
                    if (i++ >= 10) return res.end();
                    res.write(SLOW_CHUNK);
                    setTimeout(tick, 60);
                };
                return tick();
            }
            case '/upload': {
                const received = Buffer.concat(body).length;
                res.writeHead(200, { 'content-type': 'application/json' });
                return res.end(JSON.stringify({ received }));
            }
            case '/protected': {
                const ok = req.headers['x-token'] === 'new';
                res.writeHead(200, { 'content-type': 'application/json' });
                return res.end(JSON.stringify(
                    ok ? { code: 0, data: 'secret' } : { code: 401, msg: 'token expired' },
                ));
            }
            case '/echo-data': {
                res.writeHead(200, { 'content-type': 'application/json' });
                return res.end(JSON.stringify({
                    body: Buffer.concat(body).toString(),
                    token: req.headers['x-token'] || '',
                    query: url.search,
                }));
            }
            default:
                res.writeHead(404); return res.end('not found');
        }
    });
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const baseURL = `http://127.0.0.1:${server.address().port}`;
const api = createClient({ baseURL });

let passed = 0;
const failures = [];
async function check(name, fn) {
    try { await fn(); passed++; }
    catch (e) { failures.push(`${name}: ${e.message}`); }
}

/* ---------------- 1. 原生 Response 与流中转 ---------------- */
await check('raw 模式拿到未消费的原生 Response', async () => {
    const res = await api({ url: '/big', responseType: 'raw' });
    assert.ok(res.data instanceof Response, 'data 应是唯一的原生 Response 入口');
    assert.equal(res.data.body.locked, false, 'body 不应已被消费/锁定');
    assert.equal(res.data.bodyUsed, false, 'body 不应已被读取');
    assert.ok(!('Response' in res), '对外不应再暴露 Response 字段');
    assert.ok(!('raw' in res), '响应字段 raw 应已移除');
    assert.deepEqual(Object.keys(res), [
        'data', 'status', 'statusText', 'headers', 'config', 'responseURL', 'redirected',
    ]);
});

await check('raw 模式的 data.body 暴露可读流', async () => {
    const res = await api({ url: '/big', responseType: 'raw' });
    assert.ok(res.data.body && typeof res.data.body.getReader === 'function', 'data.body 应是 ReadableStream');
});

await check('代理下载：响应流直接作为上传请求体，字节完整', async () => {
    const res = await api({ url: '/big', responseType: 'raw' });
    const upload = await fetch(`${baseURL}/upload`, {
        method: 'POST',
        body: res.data.body,
        duplex: 'half',
    });
    const result = await upload.json();
    assert.equal(result.received, 16 * BIG_CHUNK.length);
});

await check('长流 + timeout：response.body 不应被中断', async () => {
    const res = await api({ url: '/slowstream', responseType: 'raw', timeout: 200 });
    const reader = res.data.body.getReader();
    let received = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
    }
    assert.equal(received, 10 * SLOW_CHUNK.length);
});

await check('长流不被 timeout 中途掐断（timeout 只覆盖到响应头）', async () => {
    const res = await api({ url: '/slowstream', responseType: 'raw', timeout: 200 });
    const reader = res.data.body.getReader();
    let received = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
    }
    assert.equal(received, 10 * SLOW_CHUNK.length);
});

await check('失败请求（已取消）的 err.config 重放不会被旧 signal 卡住', async () => {
    const ac = new AbortController();
    const first = api({ url: '/slowstream', signal: ac.signal, responseType: 'raw' });
    ac.abort();
    const err = await first.catch(e => e);
    assert.ok(err.isBxfError, '第一次应失败');
    const retried = await api(err.config);
    assert.equal(retried.status, 200, '重放应成功，而不是被已中止的 signal 立即拒绝');
});

/* ---------------- 2. 原配置重放 / token 刷新重试 ---------------- */
for (const engine of ['fetch', 'xhr']) {
    await check(`[${engine}] res.config 是可回喂配置且冗余字段已清除`, async () => {
        const res = await api({ url: '/echo-data', params: { a: 1 }, headers: { 'x-token': 'old' }, engine });
        assert.ok(res.config, '缺少 config');
        for (const legacy of ['original', 'request', 'rawResponse']) {
            assert.ok(!(legacy in res), `冗余字段 ${legacy} 未清除`);
        }
        const json = JSON.stringify(res.config);
        assert.ok(json && !json.includes('"cleanup"') && !json.includes('"abort"'));
        assert.equal(res.config.url, '/echo-data');
        assert.deepEqual(res.config.params, { a: 1 });
        // 扁平配置可直接回喂
        const again = await api(res.config);
        assert.equal(again.status, 200);
        assert.equal(again.data.query, '?a=1');
    });

    await check(`[${engine}] 响应只保留 engine 元数据，raw / retry 系列已移除`, async () => {
        const res = await api({ url: '/echo-data', engine });
        assert.equal(res.engine, engine, 'engine 应指出实际生效引擎');
        assert.ok(!Object.keys(res).includes('engine'), 'engine 应不可枚举');
        assert.ok(!('raw' in res), 'raw 字段应已移除');
        assert.ok(!('retry' in res) && !('retryCount' in res), 'retry 系列应已移除');
        const err = await api({ url: 'http://127.0.0.1:1/nope', engine }).catch(e => e);
        assert.equal(err.engine, engine, '错误对象也应带 engine');
        assert.ok(!('retry' in err) && !('retryCount' in err));
    });

    await check(`[${engine}] bxf(res.config) 直接重放也能成功`, async () => {
        const inst = createClient({ baseURL });
        let n = 0;
        inst.interceptors.response.use((res) => {
            if (res.data && res.data.code === 401 && n++ === 0) {
                const cfg = { ...res.config, headers: { ...res.config.headers, 'x-token': 'new' } };
                return inst(cfg);
            }
            return res;
        });
        const res = await inst({ url: '/protected', params: { q: 1 }, engine });
        assert.equal(n, 1);
        assert.deepEqual(res.data, { code: 0, data: 'secret' });
        // config 保留原始相对地址，baseURL / params 都未被拼接进去
        assert.equal(res.config.url, '/protected');
        assert.deepEqual(res.config.params, { q: 1 });
        assert.equal(res.config.baseURL, baseURL);
        // 用回显接口确认重放不会重复拼接
        const echo = await inst({ url: '/echo-data', params: { q: 1 }, engine });
        const again = await inst(echo.config);
        assert.equal(again.data.query, '?q=1');
        assert.equal(again.data.body, '');
    });

    await check(`[${engine}] 手动重放保留原请求体、params 与自定义头`, async () => {
        const inst = createClient({ baseURL });
        let n = 0;
        inst.interceptors.response.use((res) => {
            if (n++ === 0) return inst({
                ...res.config,
                headers: { ...res.config.headers, 'x-token': 'new' },
            });
            return res;
        });
        const res = await inst({
            url: '/echo-data', method: 'post', data: { a: 1, b: '中文' },
            params: { q: 2 }, headers: { 'x-custom': 'keep' }, engine,
        });
        assert.equal(res.data.body, '{"a":1,"b":"中文"}', '请求体不应被二次编码');
        assert.equal(res.data.token, 'new');
        assert.equal(res.data.query, '?q=2');
    });

    await check(`[${engine}] err.config 从失败中手动重放`, async () => {
        const inst = createClient({ baseURL });
        let n = 0;
        const promise = inst({ url: '/protected', onlyData: true, resolveStatus: 500, engine })
            .catch(async (err) => {
                // 完全由调用方用 err.config 发起，重放时显式去掉状态规则
                if (n++ === 0) return inst({
                    ...err.config,
                    onlyData: false,
                    resolveStatus: undefined,
                    headers: { ...err.config.headers, 'x-token': 'new' },
                });
                throw err;
            });
        const res = await promise;
        assert.equal(n, 1);
        assert.deepEqual(res.data, { code: 0, data: 'secret' });
        assert.ok(res.status === 200);
    });
}

/* ---------------- 3. 外部手动重放：拿原始配置自己再调 bxf() ---------------- */
for (const engine of ['fetch', 'xhr']) {
    await check(`[${engine}] 收到失败后 err.config 是纯数据原始配置`, async () => {
        const ac = new AbortController();
        const first = api({
            url: '/echo-data', method: 'post', data: { a: 1, b: '中文' },
            params: { q: 1 }, headers: { 'x-token': 'old' },
            signal: ac.signal, engine,
        });
        ac.abort();
        const err = await first.catch(e => e);
        assert.ok(err.isBxfError, '第一次应失败');

        const cfg = err.config;
        assert.ok(cfg, '缺少 err.config');
        const json = JSON.stringify(cfg);
        assert.ok(json, 'config 应可序列化');
        assert.doesNotMatch(json, /"(signal|cleanup|abort|source|__bxfSpec|retryCount|response)":/);

        // 必须是「原始」值，而不是已编码 / 已拼接 / 已小写化的派生值
        assert.equal(cfg.url, '/echo-data');
        assert.deepEqual(cfg.data, { a: 1, b: '中文' });
        assert.deepEqual(cfg.params, { q: 1 });
        assert.deepEqual(cfg.headers, { 'x-token': 'old' });
    });

    await check(`[${engine}] err.config 手动改 token 后再调 bxf() 得到期望响应`, async () => {
        const ac = new AbortController();
        const first = api({
            url: '/echo-data', method: 'post', data: { a: 1 },
            params: { q: 1 }, headers: { 'x-token': 'old' },
            signal: ac.signal, engine,
        });
        ac.abort();
        const err = await first.catch(e => e);

        // 完全由调用方发起第二次请求，不经过任何库内重放入口
        const cfg = { ...err.config, headers: { ...err.config.headers, 'x-token': 'new' } };
        const res = await api(cfg);
        assert.equal(res.data.body, '{"a":1}', '请求体不应二次编码');
        assert.equal(res.data.token, 'new');
        assert.equal(res.data.query, '?q=1');
        assert.equal(res.status, 200);
    });

    await check(`[${engine}] 业务失败(401)后 res.config 手动重放成功`, async () => {
        const first = await api({ url: '/protected', engine });
        assert.equal(first.data.code, 401);
        const cfg = first.config;
        assert.ok(cfg, '成功响应也应能拿到请求配置');
        const res = await api({
            ...cfg,
            headers: { ...cfg.headers, 'x-token': 'new' },
        });
        assert.deepEqual(res.data, { code: 0, data: 'secret' });
    });

    await check(`[${engine}] config 自包含 baseURL，换实例也能重放`, async () => {
        const first = await api({ url: '/protected', engine });
        const cfg = { ...first.config, headers: { ...first.config.headers, 'x-token': 'new' } };
        // 用全新默认实例，不依赖原实例的 defaults
        const res = await createClient()(cfg);
        assert.deepEqual(res.data, { code: 0, data: 'secret' });
    });

    await check(`[${engine}] 超时失败后 err.config 可手动重放`, async () => {
        const slow = createClient({ baseURL, timeout: 60 });
        const err = await slow({ url: '/slowstream', engine }).catch(e => e);
        assert.ok(err.isBxfError);
        assert.equal(err.code, 'ETIMEDOUT');
        const res = await api({ ...err.config, timeout: 0 });
        assert.equal(res.status, 200);
    });
}

/* ---------------- 4. axios 对齐：成功/失败 config 同源 ---------------- */
for (const engine of ['fetch', 'xhr']) {
    await check(`[${engine}] 成功 res.config 与失败 err.config 键集合一致`, async () => {
        const common = {
            url: '/echo-data', method: 'post', data: { a: 1 },
            params: { q: 1 }, headers: { 'x-token': 'old' }, engine,
        };
        const ok = await api(common);

        const ac = new AbortController();
        const pending = api({ ...common, signal: ac.signal });
        ac.abort();
        const bad = await pending.catch(e => e);
        assert.ok(bad.isBxfError, '第二次应失败');

        assert.deepEqual(
            Object.keys(ok.config).sort(),
            Object.keys(bad.config).sort(),
            '成功与失败拿到的 config 形状必须一致',
        );
        for (const cfg of [ok.config, bad.config]) {
            assert.equal(cfg.url, '/echo-data');
            assert.deepEqual(cfg.data, { a: 1 });
            assert.deepEqual(cfg.params, { q: 1 });
            assert.deepEqual(cfg.headers, { 'x-token': 'old' });
            assert.doesNotMatch(
                JSON.stringify(cfg),
                /"(signal|cleanup|abort|response|source|retryCount)":/,
            );
        }
        assert.ok(ok.config && bad.config);
        assert.ok(!('original' in ok) && !('original' in bad), 'original 应已移除');
    });

    await check(`[${engine}] bxf(res.config) 与 bxf(err.config) 都能直接重放`, async () => {
        const ok = await api({
            url: '/echo-data', params: { q: 1 },
            headers: { 'x-token': 'old' }, engine,
        });
        const againOk = await api({
            ...ok.config,
            headers: { ...ok.config.headers, 'x-token': 'new' },
        });
        assert.equal(againOk.status, 200);
        assert.equal(againOk.data.query, '?q=1');
        assert.equal(againOk.data.token, 'new');

        const bad = await api({
            url: '/protected', onlyData: true, resolveStatus: 500, engine,
        }).catch(e => e);
        assert.ok(bad.isBxfError);
        const againBad = await api({
            ...bad.config, onlyData: false, resolveStatus: undefined,
            headers: { ...bad.config.headers, 'x-token': 'new' },
        });
        assert.deepEqual(againBad.data, { code: 0, data: 'secret' });
    });
}

/* ---------------- 汇总 ---------------- */
server.close();
if (failures.length) {
    console.error(`\n失败 ${failures.length} 项 / 共 ${passed + failures.length} 项：`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
}
console.log(`\n流中转与重放测试全部通过：${passed} 项`);
