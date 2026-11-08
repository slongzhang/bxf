/**
 * 大请求体 / 大文件上传 / 大文件下载 —— 容量、完整性与内存性能回归。
 *
 * 运行：
 *   node --expose-gc --experimental-default-type=module test/large-body.test.mjs
 * （--expose-gc 只用于打印更稳定的堆指标；不传也能跑，断言不依赖 GC）
 *
 * 覆盖：
 *   2MB JSON 请求体、单文件 10MB 上传、3×10MB 多文件上传、20MB 下载
 *   （text / json / auto / arraybuffer / blob / raw / stream）、20MB 单帧 SSE、
 *   分帧算法边界、XHR 引擎大上传。
 * 白盒计数器用于锁住「二进制响应不得整包解码」「JSON 只解析一次」「流式分帧必须 O(n)」。
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { createClient } from '../src/core/createClient.js';

const MB = 1024 * 1024;
const byteAt = (i) => (i * 31 + 7) & 0xff;
const makeBytes = (n) => { const b = Buffer.allocUnsafe(n); for (let i = 0; i < n; i++) b[i] = byteAt(i); return b; };
const sumOf = (buf) => { let s = 0; for (let i = 0; i < buf.length; i++) s = (s + buf[i]) >>> 0; return s >>> 0; };
const fmt = (n) => (n / MB).toFixed(2) + 'MB';
const gc = () => { if (global.gc) { global.gc(); global.gc(); } };

let passed = 0;
let failed = 0;
const unhandled = [];
process.on('unhandledRejection', (e) => unhandled.push(e));

async function check(name, fn) {
    try { await fn(); passed++; }
    catch (e) { failed++; console.error(`  ✗ ${name}\n${e.stack || e}`); }
}

/* ---------------- 本地 HTTP 服务（零第三方依赖） ---------------- */
function parseFiles(buf, contentType) {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
    if (!m) return [];
    const boundary = Buffer.from('--' + (m[1] || m[2]).trim());
    const files = [];
    let pos = 0;
    while (true) {
        const idx = buf.indexOf(boundary, pos);
        if (idx < 0) break;
        const next = buf.indexOf(boundary, idx + boundary.length);
        if (next < 0) break;
        let seg = buf.subarray(idx + boundary.length, next);
        if (seg[0] === 13 && seg[1] === 10) seg = seg.subarray(2);
        if (seg[seg.length - 2] === 13 && seg[seg.length - 1] === 10) seg = seg.subarray(0, seg.length - 2);
        const he = seg.indexOf('\r\n\r\n');
        if (he >= 0) {
            const head = seg.subarray(0, he).toString('utf8');
            const fn = /filename="([^"]*)"/i.exec(head)?.[1];
            if (fn) {
                const body = seg.subarray(he + 4);
                files.push({ name: fn, size: body.length, sum: sumOf(body) });
            }
        }
        pos = next;
    }
    return files;
}

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const q = u.searchParams;

    if (u.pathname === '/download' || u.pathname === '/sse') {
        const size = Math.max(0, Number(q.get('size')) || 0);
        const kind = q.get('kind') || 'binary';
        let payload;
        if (u.pathname === '/sse') {
            payload = Buffer.from('data: ' + 'x'.repeat(Math.max(0, size - 8)) + '\n\n', 'utf8');
        } else if (kind === 'json' || kind === 'ascii') {
            const pre = kind === 'json' ? '{"blob":"' : '';
            const suf = kind === 'json' ? '"}' : '';
            payload = Buffer.from(pre + 'a'.repeat(Math.max(0, size - pre.length - suf.length)) + suf, 'utf8');
        } else {
            payload = makeBytes(size);
        }
        res.writeHead(200, {
            'content-type': u.pathname === '/sse' ? 'text/event-stream'
                : kind === 'json' ? 'application/json'
                    : kind === 'ascii' ? 'text/plain; charset=utf-8' : 'application/octet-stream',
            'content-length': String(payload.length),
            'x-bxf-sum': String(sumOf(payload)),
        });
        const CH = 64 * 1024;
        for (let off = 0; off < payload.length; off += CH) {
            res.write(payload.subarray(off, Math.min(off + CH, payload.length)));
        }
        return res.end();
    }

    const chunks = [];
    let len = 0;
    req.on('data', (c) => { chunks.push(c); len += c.length; });
    req.on('end', () => {
        const buf = Buffer.concat(chunks, len);
        const files = u.pathname === '/upload' ? parseFiles(buf, req.headers['content-type']) : [];
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ bytes: len, sum: sumOf(buf), files }));
    });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const api = createClient();

/* ---------------- 白盒计数器 ---------------- */
const origDecode = TextDecoder.prototype.decode;
const origParse = JSON.parse;
const origSlice = ArrayBuffer.prototype.slice;
const origReplace = String.prototype.replace;
let c = { decode: 0, decodeBytes: 0, parse: 0, slice: 0, replaceBytes: 0 };
TextDecoder.prototype.decode = function (input, opts) {
    c.decode++;
    c.decodeBytes += (input && (input.byteLength ?? input.length)) || 0;
    return origDecode.call(this, input, opts);
};
JSON.parse = function (text, ...rest) {
    if (typeof text === 'string' && text.length > 100000) c.parse++;
    return origParse.call(this, text, ...rest);
};
ArrayBuffer.prototype.slice = function (...a) {
    if (this.byteLength > 100000) c.slice++;
    return origSlice.apply(this, a);
};
String.prototype.replace = function (...a) {
    if (this.length > 100000) c.replaceBytes += this.length;
    return origReplace.apply(this, a);
};

async function measured(fn) {
    gc();
    await new Promise((r) => setImmediate(r));
    c = { decode: 0, decodeBytes: 0, parse: 0, slice: 0, replaceBytes: 0 };
    const before = process.memoryUsage().rss;
    let peakRss = before;
    const sampler = setInterval(() => {
        const r = process.memoryUsage().rss;
        if (r > peakRss) peakRss = r;
    }, 2);
    const t0 = performance.now();
    let value;
    try { value = await fn(); } finally { clearInterval(sampler); }
    return {
        value,
        ms: performance.now() - t0,
        rssDelta: peakRss - before,
        heapDelta: process.memoryUsage().heapUsed,
        c: { ...c },
    };
}

/* ---------------- 1. 大请求体 ---------------- */
const bigJson = { blob: 'z'.repeat(2 * MB - 120), n: 42 };
await check('POST 2MB JSON 请求体：字节数与校验和完整', async () => {
    const m = await measured(() => api({ url: BASE + '/echo', method: 'POST', data: bigJson, responseType: 'json' }));
    const expected = Buffer.from(JSON.stringify(bigJson));
    assert.equal(m.value.data.bytes, expected.length);
    assert.equal(m.value.data.sum, sumOf(expected));
    assert.equal(m.value.config.data.n, 42);
    console.log(`    2MB JSON：${m.ms.toFixed(0)}ms / 峰值RSS Δ${fmt(m.rssDelta)}`);
});

const mapData = {};
for (let i = 0; i < 4000; i++) mapData[`k${i}`] = { id: i, name: 'x'.repeat(200) };
await check('POST ~0.9MB 多键嵌套对象：deepMerge 不丢字段', async () => {
    const r = await api({ url: BASE + '/echo', method: 'POST', data: mapData, responseType: 'json' });
    const expected = Buffer.from(JSON.stringify(mapData));
    assert.equal(r.data.bytes, expected.length);
    assert.equal(r.data.sum, sumOf(expected));
    assert.equal(Object.keys(r.config.data).length, 4000);
});

/* ---------------- 2. 大文件上传 ---------------- */
const f10 = makeBytes(10 * MB);
await check('POST 单文件 10MB：multipart 字节与校验和完整', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([f10]), 'big.bin');
    const m = await measured(() => api({ url: BASE + '/upload', method: 'POST', data: fd, responseType: 'json' }));
    assert.equal(m.value.data.files.length, 1);
    assert.equal(m.value.data.files[0].size, 10 * MB);
    assert.equal(m.value.data.files[0].sum, sumOf(f10));
    console.log(`    单文件 10MB：${m.ms.toFixed(0)}ms / 峰值RSS Δ${fmt(m.rssDelta)}`);
});

const f30 = [makeBytes(10 * MB), makeBytes(10 * MB), makeBytes(10 * MB)];
await check('POST 3×10MB 多文件：逐文件字节与校验和完整', async () => {
    const fd = new FormData();
    f30.forEach((b, i) => fd.append('files', new Blob([b]), `big${i}.bin`));
    const m = await measured(() => api({ url: BASE + '/upload', method: 'POST', data: fd, responseType: 'json' }));
    assert.equal(m.value.data.files.length, 3);
    m.value.data.files.forEach((f, i) => {
        assert.equal(f.size, 10 * MB);
        assert.equal(f.sum, sumOf(f30[i]));
    });
    assert.ok(m.value.data.bytes >= 30 * MB);
    console.log(`    3×10MB：${m.ms.toFixed(0)}ms / multipart ${fmt(m.value.data.bytes)} / 峰值RSS Δ${fmt(m.rssDelta)}`);
});

/* ---------------- 3. 20MB 下载，各响应类型 ---------------- */
const SIZE = 20 * MB;
await check('GET 20MB text：完整解码一次', async () => {
    const m = await measured(() => api({ url: `${BASE}/download?size=${SIZE}&kind=ascii`, responseType: 'text' }));
    assert.equal(Buffer.byteLength(m.value.data), SIZE);
    assert.equal(m.c.decode, 1);
    assert.equal(m.c.decodeBytes, SIZE);
    assert.equal(m.c.parse, 0);
});

await check('GET 20MB json：JSON 只解析一次（不再 isJson + JSON.parse 双解析）', async () => {
    const m = await measured(() => api({ url: `${BASE}/download?size=${SIZE}&kind=json`, responseType: 'json' }));
    assert.equal(typeof m.value.data, 'object');
    assert.equal(Buffer.byteLength(m.value.data.blob), SIZE - '{"blob":"'.length - '"}'.length);
    assert.equal(m.c.parse, 1);
    assert.equal(m.c.decode, 1);
});

await check('GET 20MB auto：同样只解析一次', async () => {
    const m = await measured(() => api({ url: `${BASE}/download?size=${SIZE}&kind=json`, responseType: 'auto' }));
    assert.equal(typeof m.value.data, 'object');
    assert.equal(m.c.parse, 1);
});

await check('GET 20MB arraybuffer：零文本解码、零二次拷贝、校验和一致', async () => {
    const m = await measured(() => api({ url: `${BASE}/download?size=${SIZE}&kind=binary`, responseType: 'arraybuffer' }));
    assert.ok(m.value.data instanceof ArrayBuffer);
    assert.equal(m.value.data.byteLength, SIZE);
    assert.equal(m.c.decode, 0, '二进制响应不应生成整包 UTF-16 字符串');
    assert.equal(m.c.slice, 0, 'arrayBuffer() 已是独占缓冲区，不应再 slice() 复制');
    const view = new Uint8Array(m.value.data);
    assert.equal(sumOf(Buffer.from(view.buffer, view.byteOffset, view.byteLength)), Number(m.value.headers['x-bxf-sum']));
    console.log(`    20MB arraybuffer：${m.ms.toFixed(0)}ms / 峰值RSS Δ${fmt(m.rssDelta)} / decode=${m.c.decode} slice=${m.c.slice}`);
});

await check('GET 20MB blob：零文本解码、大小与校验和一致', async () => {
    const m = await measured(() => api({ url: `${BASE}/download?size=${SIZE}&kind=binary`, responseType: 'blob' }));
    assert.equal(m.value.data.size, SIZE);
    assert.equal(m.c.decode, 0, '二进制响应不应生成整包 UTF-16 字符串');
    const buf = Buffer.from(await m.value.data.arrayBuffer());
    assert.equal(sumOf(buf), Number(m.value.headers['x-bxf-sum']));
    console.log(`    20MB blob：${m.ms.toFixed(0)}ms / 峰值RSS Δ${fmt(m.rssDelta)} / decode=${m.c.decode}`);
});

await check('GET 20MB raw：不消费响应体、零解码零解析', async () => {
    const m = await measured(() => api({ url: `${BASE}/download?size=${SIZE}&kind=binary`, responseType: 'raw' }));
    assert.equal(typeof m.value.data.body.getReader, 'function');
    assert.equal(m.c.decode, 0);
    assert.equal(m.c.parse, 0);
    assert.equal(m.c.slice, 0);
});

/* ---------------- 4. 20MB 单帧 SSE（增量分帧 O(n) 回归） ---------------- */
await check('GET 20MB 单帧 SSE：分帧线性、帧完整、res.data 为空数组', async () => {
    let frames = 0;
    let chars = 0;
    const m = await measured(() => api({
        url: `${BASE}/sse?size=${SIZE}`,
        responseType: 'stream',
        onStream: (f) => { frames++; chars += f.length; },
    }));
    assert.equal(frames, 1);
    assert.equal(chars, SIZE - 8 + 6);   // 'data: ' 前缀保留，尾部 '\n\n' 属于分隔符
    assert.deepEqual(m.value.data, []);
    // 旧实现每块对整份累积缓冲 replace()/split()，20MB 单帧累计重扫 >3GB；
    // 新实现每块只处理新增文本，大字符串 replace 总量应接近一个包大小。
    assert.ok(m.c.replaceBytes < 50 * MB, `大缓冲 replace 总量 ${fmt(m.c.replaceBytes)} 过大，疑似退化为 O(n²)`);
    assert.ok(m.ms < 2500, `20MB 单帧耗时 ${m.ms.toFixed(0)}ms，疑似退化为 O(n²)`);
    console.log(`    20MB 单帧 SSE：${m.ms.toFixed(0)}ms / 峰值RSS Δ${fmt(m.rssDelta)} / replace 总量 ${fmt(m.c.replaceBytes)}`);
});

/* ---------------- 5. 分帧算法边界（重写后的语义回归） ---------------- */
function streamResponse(chunks) {
    const enc = new TextEncoder();
    return new Response(new ReadableStream({
        start(ctrl) { for (const ch of chunks) ctrl.enqueue(enc.encode(ch)); ctrl.close(); },
    }), { headers: { 'content-type': 'text/event-stream' } });
}
async function framesOf(chunks) {
    const got = [];
    const r = await api({
        url: BASE + '/sse',
        responseType: 'stream',
        onStream: (f) => got.push(f),
        engine: async () => streamResponse(chunks),
    });
    assert.deepEqual(r.data, []);
    return got;
}
await check('分帧语义：BOM / CRLF / CR / 尾帧 / 跨块分隔符全部等价', async () => {
    assert.deepEqual(
        await framesOf(['\uFEFFdata: 1\r\n\r\ndata: 2\r\n\r\n']),
        ['data: 1', 'data: 2'],
    );
    // 注意：这是重写前就存在的行为（已用旧算法做 193 组等价性对照确认）。
    // 流末尾的孤立 '\r' 会为「跨块 CRLF」保留成字面 '\r'，因此第二个空行
    // 不会闭合，'data: 2\n\r' 作为尾帧交给调用方。本轮只做 O(n) 优化，不改语义。
    assert.deepEqual(
        await framesOf(['data: 1\r\rdata: 2\r\r']),
        ['data: 1', 'data: 2\n\r'],
    );
    // '\n\n' 横跨两个 chunk：上一块以 \n 结尾、下一块以 \n 开头
    assert.deepEqual(
        await framesOf(['data: X\n', '\ndata: Y\n\n']),
        ['data: X', 'data: Y'],
    );
    // CRLF 横跨两个 chunk：上一块留下 '\r'
    assert.deepEqual(
        await framesOf(['data: A\r', '\n\r\ndata: B\n\n']),
        ['data: A', 'data: B'],
    );
    // 未以空行结束的尾帧仍交给调用方
    assert.deepEqual(await framesOf(['data: 1\n\n', 'tail: 2']), ['data: 1', 'tail: 2']);
    // 空帧被忽略
    assert.deepEqual(await framesOf(['\n\n', 'data: ok\n\n']), ['data: ok']);
});

/** 重写前的分帧实现，作为等价性参照（oracle）。语义必须逐字节保持一致。 */
function referenceFrames(chunks) {
    const frames = [];
    let buffer = '';
    let started = false;
    const emit = (f) => { if (f.trim()) frames.push(f); };
    const feed = (text) => {
        buffer += text;
        if (!started) { started = true; if (buffer.charCodeAt(0) === 0xFEFF) buffer = buffer.slice(1); }
        let hold = '';
        if (buffer.endsWith('\r')) { hold = '\r'; buffer = buffer.slice(0, -1); }
        buffer = buffer.replace(/\r\n|\r/g, '\n') + hold;
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) emit(part);
    };
    for (const ch of chunks) if (ch) feed(ch);
    if (buffer.trim()) emit(buffer);
    return frames;
}
await check('增量分帧与重写前算法语义等价（多载荷 × 多种切块 fuzz）', async () => {
    const payloads = [
        '\uFEFFdata: 1\r\n\r\ndata: 2\r\n\r\n',
        'data: 1\r\rdata: 2\r\r',
        'data: 1\n\ndata: 2\n\n',
        'data: 1\r\n\r\ntail: 2',
        '\n\ndata: ok\n\n',
        'data: a\n\n\ndata: b\n\n',
        'data: x\n', 'data: x\r', '\r', '\n', '',
        'a\n\nb\r\n\r\nc\r\rd\n\n',
    ];
    let count = 0;
    for (const payload of payloads) {
        const splits = [[payload]];
        if (payload.length > 1) splits.push([...payload]);
        for (let seed = 0; seed < 4; seed++) {
            const parts = [];
            let i = 0;
            while (i < payload.length) {
                const n = 1 + ((seed * 7 + i * 3) % 5);
                parts.push(payload.slice(i, i + n));
                i += n;
            }
            splits.push(parts);
        }
        for (const chunks of splits) {
            assert.deepEqual(
                await framesOf(chunks), referenceFrames(chunks),
                `载荷 ${JSON.stringify(payload)} 切块 ${JSON.stringify(chunks)} 语义不一致`,
            );
            count++;
        }
    }
    console.log(`    分帧等价性 fuzz：${count} 组全部一致`);
});

/* ---------------- 6. XHR 引擎大上传 ---------------- */
class MockXHR {
    constructor() {
        this.status = 0; this.statusText = ''; this.response = null;
        this.responseType = ''; this.responseURL = '';
        this.withCredentials = false; this.upload = { onprogress: null };
        this._headers = {}; this._rawHeaders = [];
        this.onload = this.onerror = this.onabort = this.ontimeout = this.onprogress = null;
    }
    open(method, url) { this._method = method; this._url = url; }
    setRequestHeader(k, v) { this._headers[k] = v; }
    getAllResponseHeaders() { return this._rawHeaders.map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n'; }
    send(body) {
        const target = new URL(this._url);
        const headers = { ...this._headers };
        if (body != null) headers['content-length'] = String(body.byteLength ?? body.length ?? 0);
        const req = http.request({
            hostname: target.hostname, port: target.port,
            path: target.pathname + target.search, method: this._method, headers,
        }, (res) => {
            const chunks = [];
            res.on('data', (x) => chunks.push(x));
            res.on('end', () => {
                this.status = res.statusCode;
                this.statusText = res.statusMessage;
                this.responseURL = this._url;
                this._rawHeaders = [];
                for (let i = 0; i < res.rawHeaders.length; i += 2) {
                    this._rawHeaders.push([res.rawHeaders[i], res.rawHeaders[i + 1]]);
                }
                const buf = Buffer.concat(chunks);
                this.response = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                if (this.onload) this.onload();
            });
        });
        req.on('error', () => { if (this.onerror) this.onerror(); });
        if (body != null) req.write(body);
        req.end();
    }
    abort() { if (this.onabort) this.onabort(); }
}
await check('XHR 引擎 10MB 上传：request.arrayBuffer() 物化后仍字节完整', async () => {
    const previous = globalThis.XMLHttpRequest;
    globalThis.XMLHttpRequest = MockXHR;
    try {
        const fd = new FormData();
        fd.append('file', new Blob([f10]), 'xhr.bin');
        const m = await measured(() => api({
            url: BASE + '/upload', method: 'POST', data: fd,
            responseType: 'json', engine: 'xhr',
        }));
        assert.equal(m.value.data.files.length, 1);
        assert.equal(m.value.data.files[0].size, 10 * MB);
        assert.equal(m.value.data.files[0].sum, sumOf(f10));
        console.log(`    XHR 10MB：${m.ms.toFixed(0)}ms / 峰值RSS Δ${fmt(m.rssDelta)}（含一次整包物化拷贝）`);
    } finally {
        if (previous === undefined) delete globalThis.XMLHttpRequest;
        else globalThis.XMLHttpRequest = previous;
    }
});

/* ---------------- 收尾 ---------------- */
TextDecoder.prototype.decode = origDecode;
JSON.parse = origParse;
ArrayBuffer.prototype.slice = origSlice;
String.prototype.replace = origReplace;
server.close();
await new Promise((r) => setTimeout(r, 20));
assert.equal(unhandled.length, 0, `出现 ${unhandled.length} 个未处理的 rejection`);
const active = typeof process.getActiveResourcesInfo === 'function'
    ? process.getActiveResourcesInfo().filter((x) => x === 'Timeout').length : 0;
assert.equal(active, 0, `残留 ${active} 个定时器`);

console.log(`\n大 body 容量 / 完整性 / 内存性能回归：${passed} 项通过${failed ? `，${failed} 项失败` : ''}`);
if (failed) process.exit(1);
