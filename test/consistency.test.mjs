/**
 * 双引擎一致性黑盒测试。
 *
 * 运行：
 *   node --experimental-default-type=module test/consistency.test.mjs
 *
 * 两个引擎都真实访问同一个本地 HTTP 服务（XHR 用最小实现包装 Node http），
 * 然后逐字段比对 BxfResponse。不依赖任何测试框架或第三方包。
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { createClient } from '../src/core/createClient.js';

/* ---------------- 最小 XHR 实现（覆盖 bxf 实际用到的全部接口） ---------------- */
class MockXHR {
    constructor() {
        this.readyState = 0;
        this.status = 0;
        this.statusText = '';
        this.response = null;
        this.responseType = '';
        // XHR 规范：responseURL 是跟随重定向后的最终地址（msw create-response.ts 直接读它）
        this.responseURL = '';
        this.withCredentials = false;
        this.upload = { onprogress: null };
        this._headers = {};
        this._rawHeaders = [];
        this._req = null;
        this.onload = null;
        this.onerror = null;
        this.onabort = null;
        this.ontimeout = null;
        this.onprogress = null;
        this.onreadystatechange = null;
    }
    open(method, url) {
        this._method = method;
        this._url = url;
        this.readyState = 1;
    }
    setRequestHeader(key, value) {
        this._headers[key] = value;
    }
    getAllResponseHeaders() {
        return this._rawHeaders.map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n';
    }
    send(body) {
        // Node http 不自动跟随重定向，这里按 msw followRedirects() 的方式手动跟随，
        // 使 responseURL 与浏览器 XHR 一致（指向最终地址）。
        const issue = (requestUrl, redirects) => {
            const target = new URL(requestUrl);
            // 真实 XHR / 浏览器会为请求体设置 Content-Length；这里补上，
            // 否则 Node http 对 DELETE/OPTIONS 等「约定无 body」方法会吞掉分块体。
            const headers = { ...this._headers };
            if (body !== null && body !== undefined && redirects === 0) {
                headers['content-length'] = String(body.byteLength ?? (body.length || 0));
            }
            const req = http.request({
                hostname: target.hostname,
                port: target.port,
                path: target.pathname + target.search,
                method: this._method,
                headers,
            }, (res) => {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    if ([301, 302, 303, 307, 308].includes(res.statusCode) &&
                        res.headers.location && redirects < 5) {
                        return issue(new URL(res.headers.location, requestUrl).href, redirects + 1);
                    }
                    this.status = res.statusCode;
                    this.statusText = res.statusMessage;
                    this.responseURL = requestUrl;
                    this._rawHeaders = [];
                    for (let i = 0; i < res.rawHeaders.length; i += 2) {
                        this._rawHeaders.push([res.rawHeaders[i], res.rawHeaders[i + 1]]);
                    }
                    const buf = Buffer.concat(chunks);
                    this.response = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                    this.readyState = 4;
                    if (this.onprogress) {
                        this.onprogress({ loaded: buf.length, total: buf.length, lengthComputable: true });
                    }
                    if (this.onreadystatechange) this.onreadystatechange();
                    if (this.onload) this.onload();
                });
            });
            req.on('error', () => { if (this.onerror) this.onerror({ target: this }); });
            this._req = req;
            if (body !== null && body !== undefined && redirects === 0) req.write(body);
            req.end();
        };
        issue(this._url, 0);
    }
    abort() {
        if (this._req) this._req.destroy();
        if (this.onabort) this.onabort({ target: this });
    }
}
globalThis.XMLHttpRequest = MockXHR;

/* ---------------- 本地测试服务 ---------------- */
const TEXT = 'hello 中文';
const JSON_BODY = JSON.stringify({ ok: true, n: 1, list: [1, 2] });
// 响应头错写 utf-8、字节实际是 GBK（1688 等页面的真实场景）
const GBK_BYTES = Buffer.from('47424bd6d0cec4b2e2cad4a3bac4e3bac3a3accac0bde7', 'hex');
const GBK_TEXT = 'GBK中文测试：你好，世界';

// 传输层头由 Node / undici 各自添加，比较时忽略
const VOLATILE_HEADERS = new Set([
    'date', 'connection', 'keep-alive', 'content-length',
    'transfer-encoding', 'host',
    // 底层客户端自动附加、与 bxf 契约无关的请求头
    'accept', 'accept-encoding', 'accept-language', 'user-agent',
    'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-dest', 'origin', 'referer',
]);

function sanitizeHeaders(headers) {
    const out = {};
    for (const [k, v] of Object.entries(headers)) {
        if (VOLATILE_HEADERS.has(k.toLowerCase())) continue;
        out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    return out;
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        const send = (status, payload, headers = {}) => {
            res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers });
            res.end(payload);
        };
        switch (url.pathname) {
            case '/json':
                return send(200, JSON_BODY, { 'content-type': 'application/json; charset=utf-8', 'x-app': 'bxf' });
            case '/text':
                return send(200, TEXT, { 'x-app': 'bxf' });
            case '/badjson':
                return send(200, 'not a json', { 'content-type': 'application/json' });
            case '/gbk-wrongct':
                return send(200, GBK_BYTES, { 'content-type': 'text/plain; charset=utf-8' });
            case '/html':
                return send(200, '<html><body><p>hi</p></body></html>', { 'content-type': 'text/html' });
            case '/multi':
                res.writeHead(200, {
                    'content-type': 'text/plain',
                    'x-multi': ['a', 'b'],
                    'x-app': 'bxf',
                });
                return res.end(TEXT);
            case '/echo':
                return send(200, JSON.stringify({
                    method: req.method,
                    body,
                    query: url.search,
                    headers: sanitizeHeaders(req.headers),
                }), { 'content-type': 'application/json; charset=utf-8' });
            case '/redirect':
                res.writeHead(302, { location: '/redirect-target' });
                return res.end();
            case '/redirect-target':
                return send(200, JSON.stringify({ landed: true }),
                    { 'content-type': 'application/json; charset=utf-8' });
            case '/204':
                res.writeHead(204);
                return res.end();
            case '/502':
                res.writeHead(502, { 'content-type': 'application/json' });
                return res.end('{"error":"bad gateway"}');
            case '/status429':
                res.writeHead(429, 'Too Many Requests', { 'content-type': 'application/json' });
                return res.end('{"error":"rate limit"}');
            case '/delay':
                return setTimeout(() => send(200, 'late'), Number(url.searchParams.get('ms') || 300));
            case '/stream':
                res.writeHead(200, { 'content-type': 'text/event-stream' });
                res.write('data: {"n":1}\n\n');
                res.write('data: {"n":2}\n\n');
                return res.end('data: [DONE]\n\n');
            case '/stream-frames': {
                res.writeHead(200, { 'content-type': 'text/event-stream' });
                // BOM + CRLF；把帧尾的 \r\n 拆成两次 write，验证跨块 CRLF 不误分帧
                res.write('\uFEFFid: 1\r\nevent: tick\r\ndata: {"n":1}\r\n\r');
                res.write('\n');
                res.write('data: line-A\ndata: line-B\n\n');
                res.write(': ping\n\n');
                // 故意不以空行结束 -> 尾帧残留，必须交给调用方
                return res.end('data: tail-without-blank-line');
            }
            default:
                return send(404, 'not found');
        }
    });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;
const api = createClient({ baseURL });

let passed = 0;
const failures = [];
async function check(name, fn) {
    if (process.env.BXF_VERBOSE) console.error('  →', name);
    try {
        await fn();
        passed++;
    } catch (error) {
        failures.push(`${name}: ${error.message}`);
    }
}

/* ---------------- 比对工具 ---------------- */
const CONFIG_IGNORE = new Set([
    'engine', 'signal', 'cleanup', 'abort', 'response',
]);

// 两个引擎现在都产出 WHATWG Response，实际生效引擎由 bxf 挂在不可枚举字段上
// （config.engine 是用户传入的原始值，axios 同理）
const effectiveEngine = (r) => r.engine;

async function comparable(value) {
    if (value instanceof ArrayBuffer) return `ab:${Buffer.from(new Uint8Array(value)).toString('base64')}`;
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return `blob:${Buffer.from(new Uint8Array(await value.arrayBuffer())).toString('base64')}`;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const out = {};
        for (const key of Object.keys(value).sort()) out[key] = await comparable(value[key]);
        return out;
    }
    if (Array.isArray(value)) return Promise.all(value.map(comparable));
    return value;
}

function assertSameShape(fetchRes, xhrRes, label) {
    assert.deepEqual(
        Object.keys(fetchRes), Object.keys(xhrRes),
        `${label}: 响应字段顺序/集合不一致`,
    );
    assert.deepEqual(
        Object.keys(fetchRes.config).sort(), Object.keys(xhrRes.config).sort(),
        `${label}: config 字段集合不一致`,
    );
    assert.equal(fetchRes.status, xhrRes.status, `${label}: status 不一致`);
    assert.equal(fetchRes.statusText, xhrRes.statusText, `${label}: statusText 不一致`);
    // 对外契约固定 5 字段；原生句柄只在 responseType:'raw' 的 data 上提供
    const RESPONSE_FIELDS = ['data', 'status', 'statusText', 'headers', 'config'];
    assert.deepEqual(Object.keys(fetchRes), RESPONSE_FIELDS, `${label}: fetch 响应字段集合不符`);
    assert.deepEqual(Object.keys(xhrRes), RESPONSE_FIELDS, `${label}: xhr 响应字段集合不符`);
    for (const legacy of ['raw', 'original', 'request', 'rawResponse', 'retry', 'retryCount']) {
        assert.ok(!(legacy in fetchRes) && !(legacy in xhrRes), `${label}: 冗余字段 ${legacy} 未清除`);
    }
    for (const key of Object.keys(fetchRes.config)) {
        if (CONFIG_IGNORE.has(key)) continue;
        const a = fetchRes.config[key], b = xhrRes.config[key];
        if (typeof a === 'function' || typeof b === 'function') continue;
        assert.deepEqual(a, b, `${label}: config.${key} 不一致`);
    }
}

async function both(config, label) {
    const f = await api({ ...config, engine: 'fetch' });
    const x = await api({ ...config, engine: 'xhr' });
    assertSameShape(f, x, label);
    const fh = sanitizeHeaders(f.headers), xh = sanitizeHeaders(x.headers);
    assert.deepEqual(fh, xh, `${label}: headers 不一致`);
    assert.deepEqual(await comparable(f.data), await comparable(x.data), `${label}: data 不一致`);
    assert.ok(!('raw' in f) && !('raw' in x), `${label}: raw 字段应已移除`);
    assert.equal(f.engine, 'fetch', `${label}: fetch 元数据 engine 不符`);
    assert.equal(x.engine, 'xhr', `${label}: xhr 元数据 engine 不符`);
    return { f, x };
}

/* ---------------- 响应类型矩阵 ---------------- */
const matrix = [
    ['默认 auto + JSON', { url: '/json' }],
    ['text', { url: '/text', responseType: 'text' }],
    ['json 但响应非法', { url: '/badjson', responseType: 'json' }],
    ['blob', { url: '/text', responseType: 'blob' }],
    ['arraybuffer', { url: '/text', responseType: 'arraybuffer' }],
    ['text + 显式 charset', { url: '/text', responseType: 'text', charset: 'utf-8' }],
    ['document（无 DOMParser 时降级）', { url: '/html', responseType: 'document' }],
    ['重复响应头', { url: '/multi' }],
    ['404 状态', { url: '/missing' }],
    ['POST JSON', { url: '/echo', method: 'post', data: { a: 1, b: '中文' } }],
    ['POST query 编码', { url: '/echo', method: 'post', data: { a: 1, b: '中文' }, requestType: 'query' }],
    ['PUT JSON', { url: '/echo', method: 'put', data: { id: 2 } }],
    ['GET params', { url: '/echo', params: { q: '测试', n: 2 } }],
    ['自定义 headers', { url: '/echo', headers: { 'X-Token': 'abc' } }],
    ['用户指定 content-type 不被覆盖', { url: '/echo', method: 'post', data: { a: 1 }, headers: { 'content-type': 'application/vnd.api+json' } }],
    ['rawFields 不覆盖核心字段', { url: '/echo', method: 'post', data: { a: 1 }, rawFields: { withCredentials: true, method: 'DELETE' } }],
    ['204 无响应体', { url: '/204' }],
    ['204 + raw', { url: '/204', responseType: 'raw' }],
    ['nativeEngine 走 (url, init)', { url: '/json', nativeEngine: true }],
];

for (const [name, config] of matrix) {
    await check(name, () => both(config, name));
}

/* ---------------- 语义细节 ---------------- */
await check('auto 自动解析 JSON，不再输出 raw 中间产物', async () => {
    const { f, x } = await both({ url: '/json' }, 'auto');
    for (const r of [f, x]) {
        assert.deepEqual(r.data, { ok: true, n: 1, list: [1, 2] });
        assert.ok(!('raw' in r), 'raw 字段应已移除');
        assert.equal(r.headers['x-app'], 'bxf');
    }
});

await check('blobtext 已移除：未知 responseType 回落 auto', async () => {
    const { f, x } = await both({ url: '/text', responseType: 'blobtext' }, 'blobtext 回落');
    for (const r of [f, x]) {
        assert.equal(r.data, TEXT, '未知类型应回落 auto（纯文本原样返回）');
        assert.ok(!('raw' in r), 'raw 字段应已移除');
    }
});

await check('charset 显式指定优先于响应头（GBK 页面乱码修复）', async () => {
    const wrong = await api({ url: '/gbk-wrongct', responseType: 'text' });
    const fixedText = await api({ url: '/gbk-wrongct', responseType: 'text', charset: 'gbk' });
    assert.ok(wrong.data.includes('\uFFFD'), '按响应头 utf-8 解 GBK 字节应出现替换字符');
    assert.equal(fixedText.data, GBK_TEXT, 'text + charset:gbk 应正确解码');
    assert.ok(!('raw' in fixedText), '不应再输出 raw');
});

await check('重复响应头合并规则一致', async () => {
    const { f, x } = await both({ url: '/multi' }, 'multi');
    assert.equal(f.headers['x-multi'], 'a, b');
    assert.equal(x.headers['x-multi'], 'a, b');
});

await check('POST 请求体编码一致', async () => {
    const { f, x } = await both({ url: '/echo', method: 'post', data: { a: 1, b: '中文' } }, 'post');
    assert.deepEqual(f.data.body, x.data.body);
    assert.equal(f.data.body, '{"a":1,"b":"中文"}');
    assert.equal(f.data.headers['content-type'], 'application/json');
});

await check('query 编码一致', async () => {
    const { f, x } = await both({ url: '/echo', method: 'post', data: { a: 1, b: '中文' }, requestType: 'query' }, 'query');
    assert.equal(f.data.body, x.data.body);
    assert.equal(f.data.headers['content-type'], 'application/x-www-form-urlencoded');
});

await check('用户 content-type 不被内置值覆盖', async () => {
    const { f, x } = await both({
        url: '/echo', method: 'post', data: { a: 1 },
        headers: { 'content-type': 'application/vnd.api+json' },
    }, 'ct');
    assert.equal(f.config.headers['content-type'], 'application/vnd.api+json');
    assert.equal(f.data.headers['content-type'], 'application/vnd.api+json');
    assert.equal(x.data.headers['content-type'], 'application/vnd.api+json');
});

await check('res.config 是干净的可回喂配置，不含内部运行态', async () => {
    const f = await api({ url: '/json', engine: 'fetch' });
    assert.equal(f.config.body, undefined, 'config 不应出现 body');
    assert.equal(f.config.signal, undefined);
    assert.equal(f.config.cleanup, undefined);
    assert.equal(f.config.url, '/json');
    assert.ok(JSON.stringify(f.config), 'config 应可序列化');
});

await check('单次请求传 baseURL 生效（旧版失效）', async () => {
    const r = await createClient()({ url: '/json', baseURL, engine: 'fetch' });
    assert.equal(r.status, 200);
    assert.equal(r.config.baseURL, baseURL);
});

/* ---------------- 能力自动选引擎 ---------------- */
await check('未指定引擎 + stream -> 自动 fetch，data 为完整帧原文', async () => {
    const r = await api({ url: '/stream', responseType: 'stream' });
    assert.equal(effectiveEngine(r), 'fetch');
    assert.deepEqual(r.data, [
        'data: {"n":1}',
        'data: {"n":2}',
        'data: [DONE]',
    ]);
});

await check('帧级：CRLF / BOM / 多行 data / 注释帧 / 尾帧全部保留', async () => {
    const r = await api({ url: '/stream-frames', responseType: 'stream' });
    assert.deepEqual(r.data, [
        'id: 1\nevent: tick\ndata: {"n":1}',
        'data: line-A\ndata: line-B',
        ': ping',
        'data: tail-without-blank-line',
    ]);
});

await check('帧级：有 onStream 只回调不累积，res.data 恒为 []', async () => {
    const seen = [];
    const r = await api({
        url: '/stream', responseType: 'stream',
        onStream: (frame) => seen.push(frame),
    });
    assert.deepEqual(r.data, []);
    assert.deepEqual(seen, ['data: {"n":1}', 'data: {"n":2}', 'data: [DONE]']);
});

await check('帧级：onStream 非函数按未定义处理，回落到累积', async () => {
    const r = await api({ url: '/stream', responseType: 'stream', onStream: 'nope' });
    assert.equal(r.data.length, 3);
    assert.equal(r.data[0], 'data: {"n":1}');
});

await check('显式 engine="xhr" + stream -> 抛 ERR_UNSUPPORTED，不偷偷换引擎', async () => {
    const err = await api({ url: '/stream', engine: 'xhr', responseType: 'stream' }).catch(e => e);
    assert.equal(err.code, 'ERR_UNSUPPORTED');
    assert.ok(err.config && err.config.url === '/stream', '错误也应带可回喂配置');
});

await check('raw 两引擎都支持，未指定时 fetch 优先', async () => {
    const f = await api({ url: '/json', responseType: 'raw' });
    assert.equal(effectiveEngine(f), 'fetch');
    assert.ok(f.data instanceof Response);
    // 显式 XHR 也能给出标准 Response（差异已压进适配器）
    const x = await api({ url: '/json', engine: 'xhr', responseType: 'raw' });
    assert.equal(effectiveEngine(x), 'xhr');
    assert.ok(x.data instanceof Response);
    assert.equal(x.data.status, 200);
});

await check('重定向：raw 模式双引擎 data.url / data.redirected 对齐（msw 方案）', async () => {
    const cfg = { url: '/redirect', responseType: 'raw' };
    const f = await api({ ...cfg, engine: 'fetch' });
    const x = await api({ ...cfg, engine: 'xhr' });
    assert.ok(f.data instanceof Response, 'fetch raw 应给出原生 Response');
    assert.ok(x.data instanceof Response, 'xhr raw 应给出原生 Response');
    assert.ok(f.data.url.endsWith('/redirect-target'), `fetch 最终 URL 错误: ${f.data.url}`);
    assert.equal(x.data.url, f.data.url, '两引擎最终 URL 应一致');
    assert.equal(f.data.redirected, true, 'fetch 应识别为已重定向');
    assert.equal(x.data.redirected, true, 'XHR 也应识别为已重定向');
    assert.equal(f.data.bodyUsed, false);
    assert.equal(x.data.bodyUsed, false);
    // clone 保留 url（对齐 msw FetchResponse.clone 的 kUrl 转发）
    const fc = f.data.clone(), xc = x.data.clone();
    assert.equal(fc.url, f.data.url);
    assert.equal(xc.url, x.data.url);
    // clone() 会 tee 流，4 个分支都要释放，否则 cancel() 会一直等另一侧
    await Promise.all([
        f.data.body.cancel(), x.data.body.cancel(), fc.body.cancel(), xc.body.cancel(),
    ]);
});

await check('无重定向请求不会被误判为 redirected', async () => {
    for (const engine of ['fetch', 'xhr']) {
        const r = await api({ url: '/json', engine, responseType: 'raw' });
        assert.equal(r.data.redirected, false, `${engine}: 同址不应算重定向`);
        assert.ok(r.data.url.endsWith('/json'), `${engine}: url 应为请求地址`);
        await r.data.body.cancel();
    }
});

await check('ERR_HTTP_STATUS 的 err.response 是 5 字段 BxfResponse，不含原生句柄', async () => {
    for (const engine of ['fetch', 'xhr']) {
        const e = await api({ url: '/status429', engine, resolveStatus: 200 }).catch(err => err);
        assert.equal(e.code, 'ERR_HTTP_STATUS');
        assert.deepEqual(Object.keys(e.response),
            ['data', 'status', 'statusText', 'headers', 'config']);
        assert.ok(!('Response' in e.response));
        assert.ok(!('raw' in e.response));
        assert.ok(!('retry' in e) && !('retryCount' in e));
        assert.equal(e.engine, engine);
    }
});

await check('未指定引擎 + 进度回调 -> 自动 xhr', async () => {
    let called = false;
    const r = await api({ url: '/text', onDownloadProgress: () => { called = true; } });
    assert.equal(effectiveEngine(r), 'xhr');
    assert.equal(called, true);
});

await check('显式 engine="fetch" + 进度回调 -> 抛 ERR_UNSUPPORTED', async () => {
    const err = await api({ url: '/text', engine: 'fetch', onDownloadProgress: () => {} }).catch(e => e);
    assert.equal(err.code, 'ERR_UNSUPPORTED');
});

await check('未指定引擎 + stream 与进度互斥 -> 抛 ERR_UNSUPPORTED', async () => {
    const err = await api({
        url: '/stream', responseType: 'stream', onDownloadProgress: () => {},
    }).catch(e => e);
    assert.equal(err.code, 'ERR_UNSUPPORTED');
});

await check('自定义引擎返回 WHATWG Response 也走统一解析', async () => {
    const customEngine = async (spec, request) => {
        assert.ok(request instanceof Request, '自定义引擎应收到 WHATWG Request');
        return new Response(JSON.stringify({ custom: true, method: request.method }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };
    const r = await api({ url: '/json', engine: customEngine });
    assert.deepEqual(r.data, { custom: true, method: 'GET' });
    assert.ok(!('Response' in r), '统一解析层不应把原生句柄透出给调用方');
    assert.equal(r.engine, 'custom');
});

/* ---------------- 错误统一 ---------------- */
async function bothErrors(config, label) {
    const grab = async (engine) => {
        try {
            await api({ ...config, engine });
            return null;
        } catch (e) { return e; }
    };
    const f = await grab('fetch');
    const x = await grab('xhr');
    assert.ok(f && x, `${label}: 有一个引擎没有抛错`);
    for (const e of [f, x]) {
        assert.equal(e.isBxfError, true, `${label}: 不是 BxfError`);
        assert.equal(e.name, 'BxfError', `${label}: name 不一致`);
        assert.ok(e.config, `${label}: 缺少 config`);
    }
    assert.equal(f.code, x.code, `${label}: 错误码不一致 (${f.code} vs ${x.code})`);
    return { f, x };
}

await check('超时错误码一致（实例级 timeout 生效）', async () => {
    const slow = createClient({ baseURL, timeout: 80 });
    const grab = async (engine) => {
        try { await slow({ url: '/delay?ms=400', engine }); return null; }
        catch (e) { return e; }
    };
    const f = await grab('fetch'), x = await grab('xhr');
    assert.ok(f && x, 'timeout 未触发');
    assert.equal(f.code, 'ETIMEDOUT');
    assert.equal(x.code, 'ETIMEDOUT');
});

await check('主动取消错误码一致', async () => {
    const result = [];
    for (const engine of ['fetch', 'xhr']) {
        const ac = new AbortController();
        const p = api({ url: '/delay?ms=300', engine, signal: ac.signal }).catch(e => e);
        ac.abort();
        result.push(await p);
    }
    assert.equal(result[0].code, result[1].code);
    assert.equal(result[0].code, 'ERR_CANCELED');
});

await check('网络错误错误码一致', async () => {
    const dead = 'http://127.0.0.1:1';
    const { f, x } = await bothErrors({ url: `${dead}/json` }, 'network');
    assert.equal(f.code, x.code);
    assert.ok(['ERR_NETWORK', 'ERR_UNKNOWN'].includes(f.code));
});

await check('默认：只要拿到 HTTP 响应就 resolve（429 / 502 都通过）', async () => {
    for (const engine of ['fetch', 'xhr']) {
        for (const path of ['/status429', '/502']) {
            const r = await api({ url: path, engine });
            assert.ok(r.status === 429 || r.status === 502, `${engine} ${path}: 应拿到响应`);
            // onlyData 只控制返回值，不参与状态判定
            const d = await api({ url: path, engine, onlyData: true });
            assert.deepEqual(d, r.data, `${engine} ${path}: onlyData 应只取 data`);
        }
    }
});

await check('resolveStatus 单一码未命中 -> reject ERR_HTTP_STATUS', async () => {
    for (const engine of ['fetch', 'xhr']) {
        const err = await api({ url: '/status429', engine, resolveStatus: 200 }).catch(e => e);
        assert.equal(err.code, 'ERR_HTTP_STATUS', `${engine}: 429 应被拒绝`);
        assert.equal(err.status, 429);
        assert.equal(err.response.status, 429, `${engine}: 错误应带完整响应`);
        assert.equal(err.config.resolveStatus, 200, `${engine}: 错误应带可回喂配置`);
    }
});

await check('resolveStatus 命中时返回完整响应（onlyData 未开）', async () => {
    for (const engine of ['fetch', 'xhr']) {
        const r = await api({ url: '/json', engine, resolveStatus: 200 });
        assert.equal(r.status, 200);
        assert.deepEqual(r.data, { ok: true, n: 1, list: [1, 2] });
        assert.equal(r.config.url, '/json');
    }
});

await check('数组 / 混合区间 / 左闭右开边界', async () => {
    const grab = async (cfg) => {
        const e = await api({ url: '/status429', ...cfg }).catch(x => x);
        return e.code;
    };
    assert.equal(await grab({ resolveStatus: [200, 429] }), undefined, '命中数组中的单一码');
    assert.equal(await grab({ resolveStatus: [[200, 300], 429] }), undefined, '混合区间 + 单一码');
    assert.equal(await grab({ resolveStatus: [[200, 300]] }), 'ERR_HTTP_STATUS', '429 不在 [200,300)');
    assert.equal(await grab({ resolveStatus: [[400, 430]] }), undefined, '429 在 [400,430)');
    assert.equal(await grab({ resolveStatus: [[429, 430]] }), undefined, '左边界 429 含');
    assert.equal(await grab({ resolveStatus: [[200, 429]] }), 'ERR_HTTP_STATUS', '右边界 429 不含');
    assert.equal(await grab({ resolveStatus: [200, 300] }), 'ERR_HTTP_STATUS', '[200,300] 是两个单一码');
});

await check('函数形式 resolveStatus(status, response)', async () => {
    let seen = null;
    const r = await api({
        url: '/status429',
        resolveStatus: (status, response) => {
            seen = { status, hasResponse: !!response };
            return status < 500;
        },
    });
    assert.deepEqual(seen, { status: 429, hasResponse: true });
    assert.equal(r.status, 429);
    const err = await api({ url: '/status429', resolveStatus: s => s < 400 }).catch(e => e);
    assert.equal(err.code, 'ERR_HTTP_STATUS');
});

await check('非法类型明确报 ERR_BAD_OPTION_VALUE', async () => {
    const err = await api({ url: '/json', resolveStatus: '200' }).catch(e => e);
    assert.equal(err.code, 'ERR_BAD_OPTION_VALUE');
});

await check('resolveStatus 与 onlyData 正交：先判状态再取 data', async () => {
    const data = await api({ url: '/json', resolveStatus: 200, onlyData: true });
    assert.deepEqual(data, { ok: true, n: 1, list: [1, 2] });
    const err = await api({ url: '/status429', resolveStatus: 200, onlyData: true }).catch(e => e);
    assert.equal(err.code, 'ERR_HTTP_STATUS');
});

await check('beforeInterceptors 终止码一致', async () => {
    const { f, x } = await bothErrors({
        url: '/json', beforeInterceptors: () => false,
    }, 'before');
    assert.equal(f.code, 'BEFORE_TERMINATE');
});

/* ---------------- 本轮 bug 修复回归 ---------------- */

// Bug B：请求拦截器返回「新对象」时，signal / cleanup / abort 必须回贴，
// 否则 abort / timeout 对本次请求静默失效（之前会因缺少 signal 而永远不超时）。
await check('请求拦截器返回新对象后 timeout 仍生效（signal 已回贴）', async () => {
    // 用实例级拦截器返回新对象，最贴近真实用法
    for (const engine of ['fetch', 'xhr']) {
        const inst = createClient({ baseURL, timeout: 80 });
        inst.interceptors.request.use((cfg) => ({ ...cfg }));
        const e = await inst({ url: '/delay?ms=400', engine }).catch(err => err);
        assert.ok(e, `${engine}: 拦截器返回新对象后请求应能被中断`);
        assert.equal(e.code, 'ETIMEDOUT', `${engine}: 应触发超时而非静默放行`);
    }
});

// Bug D：自定义函数引擎即使命名成 fetch / xhr，也必须按自定义处理，
// 不能误判为内建引擎而把用户函数丢掉。
await check('自定义函数引擎命名为 fetch/xhr 仍按 custom 处理', async () => {
    const asFetch = async function fetch(spec, request) {
        return new Response(JSON.stringify({ custom: 'fetch-named' }), {
            status: 200, headers: { 'content-type': 'application/json' },
        });
    };
    const asXhr = async function xhr(spec, request) {
        return new Response(JSON.stringify({ custom: 'xhr-named' }), {
            status: 200, headers: { 'content-type': 'application/json' },
        });
    };
    const r1 = await api({ url: '/json', engine: asFetch });
    const r2 = await api({ url: '/json', engine: asXhr });
    assert.equal(r1.engine, 'custom', 'asFetch 应被当作自定义引擎');
    assert.equal(r2.engine, 'custom', 'asXhr 应被当作自定义引擎');
    assert.deepEqual(r1.data, { custom: 'fetch-named' });
    assert.deepEqual(r2.data, { custom: 'xhr-named' });
});

// Bug E：DELETE / OPTIONS 带 data 应作为请求体发送，而非降级成 query 参数。
await check('DELETE 带 data 作为请求体发送（不再降级为 params）', async () => {
    for (const engine of ['fetch', 'xhr']) {
        const r = await api({
            url: '/echo', method: 'delete', data: { id: 7, op: 'soft' }, engine,
        });
        assert.equal(r.data.method, 'DELETE', `${engine}: method 应为 DELETE`);
        assert.equal(r.data.body, '{"id":7,"op":"soft"}', `${engine}: body 应被发送`);
        assert.equal(r.data.query, '', `${engine}: 不应出现在 query 上`);
    }
});

/* ---------------- 拦截器与入口形态 ---------------- */
await check('请求拦截器拿到的 config 形状一致', async () => {
    const seen = {};
    for (const engine of ['fetch', 'xhr']) {
        const inst = createClient({ baseURL });
        inst.interceptors.request.use(cfg => {
            seen[engine] = Object.keys(cfg).sort();
            cfg.headers['x-intercepted'] = '1';
            return cfg;
        });
        await inst({ url: '/echo', engine });
    }
    assert.deepEqual(seen.fetch, seen.xhr);
});

await check('响应拦截器替换对象后 onlyData 仍生效', async () => {
    const inst = createClient({ baseURL });
    inst.interceptors.response.use(res => ({ ...res }));
    const data = await inst({ url: '/json', onlyData: true, engine: 'fetch' });
    assert.deepEqual(data, { ok: true, n: 1, list: [1, 2] });
});

await check('4 种入口形态在两引擎下结果一致', async () => {
    for (const engine of ['fetch', 'xhr']) {
        const a = await api({ url: '/json', engine });
        const b = await api('/json', { engine });
        const c = await api.get('/json', { engine });
        const d = await api.request({ url: '/json', engine });
        for (const r of [b, c, d]) {
            assert.deepEqual(r.data, a.data);
            assert.deepEqual(Object.keys(r), Object.keys(a));
        }
    }
});

/* ---------------- 汇总 ---------------- */
server.close();
if (failures.length) {
    console.error(`\n失败 ${failures.length} 项 / 共 ${passed + failures.length} 项：`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
}
console.log(`\n双引擎一致性测试全部通过：${passed} 项`);
