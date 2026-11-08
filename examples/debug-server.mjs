/**
 * bxf 通用调试 Mock 服务（纯 Node.js，无第三方依赖）。
 *
 * 用法：
 *   node examples/debug-server.mjs            # 默认 http://127.0.0.1:7799
 *   PORT=8080 node examples/debug-server.mjs  # 指定端口
 *
 * 提供：
 *   GET  /               案例库网页（examples/debug.html）
 *   GET  /bxf.js          构建产物 dist/bxf.umd.min.js（同源加载，避开 CORS）
 *   ALL  /mock            通用接口：支持任意 method，响应可配置，回显请求，
 *                        支持文件上传（multipart 解析回显）、消息流（SSE）。
 *
 * /mock 查询参数（响应可配置）：
 *   status=<code>   响应状态码（默认 200）
 *   delay=<ms>      延迟响应（上限 60s），用于测试超时
 *   rt=<type>       响应 content-type：json(默认) | text | urlencode | sse
 *   body=<text>     自定义响应体（rt=json 时尝试 JSON.parse，否则原样）
 *   echo=0          关闭请求回显（只返回 body/ok）
 *   stream=1        消息流：配合 n=<条数> ms=<间隔毫秒> 逐帧输出 SSE
 *   charset=gbk & wrongct=1   响应头错标 utf-8、字节却是 GBK（测 charset 覆盖）
 *   redirect=<n>    先经 n 次 302 再响应（默认 0），用于测 responseURL / redirected
 *
 * 端口被占用时明确退出，方便探测冲突。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '../dist/bxf.umd.min.js');
const HTML = path.resolve(HERE, 'debug.html');

const PORT = Number(process.env.PORT) || 7799;
const HOST = '127.0.0.1';
// 大文件上传需要放得下（单文件 10MB / 多个 10MB）。超限返回 413 而不是
// req.destroy()——后者在客户端表现为 ECONNRESET，很难排查。
const MAX_BODY = (Number(process.env.MAX_BODY_MB) || 64) * 1024 * 1024;

// GBK 字节（响应头错标 utf-8）用于 charset 覆盖场景：
// “GBK中文测试：你好，世界”
const GBK_BYTES = Buffer.from('47424bd6d0cec4b2e2cad4a3bac4e3bac3a3accac0bde7', 'hex');

const sendJSON = (res, status, obj, extra = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra });
    res.end(JSON.stringify(obj));
};

/**
 * 极简 multipart/form-data 解析，仅用于回显字段名 / 文件名 / 类型 / 大小。
 * 不解析二进制体内容，只记录元信息。
 */
function parseMultipart(buf, contentType) {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
    if (!m) return null;
    const boundary = '--' + (m[1] || m[2]).trim();
    const fields = {};
    const files = [];
    let pos = 0;
    while (true) {
        const idx = buf.indexOf(boundary, pos);
        if (idx < 0) break;
        const segEnd = buf.indexOf(boundary, idx + boundary.length);
        if (segEnd < 0) break;
        let seg = buf.subarray(idx + boundary.length, segEnd);
        // 去掉段首 \r\n 与段尾 \r\n
        if (seg[0] === 0x0d && seg[1] === 0x0a) seg = seg.subarray(2);
        if (seg[seg.length - 2] === 0x0d && seg[seg.length - 1] === 0x0a) seg = seg.subarray(0, seg.length - 2);
        // 结束边界 “--”
        if (seg.length === 2 && seg[0] === 0x2d && seg[1] === 0x2d) break;
        const he = seg.indexOf('\r\n\r\n');
        if (he >= 0) {
            const head = seg.subarray(0, he).toString('utf8');
            const bodyBuf = seg.subarray(he + 4);
            let name = '';
            let filename = null;
            let ctype = null;
            for (const line of head.split('\r\n')) {
                if (/^content-disposition:/i.test(line)) {
                    name = /name="([^"]*)"/i.exec(line)?.[1] || '';
                    filename = /filename="([^"]*)"/i.exec(line)?.[1] || null;
                } else if (/^content-type:/i.test(line)) {
                    ctype = /content-type:\s*(.+)/i.exec(line)?.[1].trim() || null;
                }
            }
            if (filename) {
                files.push({ field: name, filename, type: ctype || 'application/octet-stream', size: bodyBuf.length });
            } else if (name) {
                fields[name] = bodyBuf.toString('utf8');
            }
        }
        pos = segEnd;
    }
    return { fields, files };
}

const server = http.createServer((req, res) => {
    let url;
    try {
        url = new URL(req.url, `http://${HOST}:${PORT}`);
    } catch {
        return sendJSON(res, 400, { error: 'bad url' });
    }
    const p = url.pathname;
    const q = url.searchParams;

    // 调试页与脚本
    if (req.method === 'GET' && p === '/') {
        return fs.readFile(HTML, (err, buf) => {
            if (err) return sendJSON(res, 500, { error: 'debug.html 缺失，请确认 examples/debug.html 存在' });
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            res.end(buf);
        });
    }
    if (req.method === 'GET' && p === '/bxf.js') {
        return fs.readFile(DIST, (err, buf) => {
            if (err) return sendJSON(res, 500, { error: 'dist 缺失，请先 pnpm build 生成 dist/bxf.umd.min.js' });
            res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
            res.end(buf);
        });
    }

    // 通用接口
    if (p === '/mock') {
        const chunks = [];
        let received = 0;
        let tooLarge = false;
        // 关键：必须始终挂 data 监听器，否则暂停态读入流不推进、end 永不触发，
        // GET 等无体请求会永久挂起。
        // 早期写法在每个 chunk 里都 Buffer.concat(chunks) 求长度，是 O(n²) 全量复制
        // （30MB 上传会反复复制近 GB 数据）；这里改用计数器，只在 end 时拼接一次。
        req.on('data', (c) => {
            received += c.length;
            if (received > MAX_BODY) {
                tooLarge = true;
                chunks.length = 0;   // 超限后不再占内存，但继续排空请求流
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            if (tooLarge) {
                return sendJSON(res, 413, {
                    error: `请求体超过上限 ${MAX_BODY} 字节（可用 MAX_BODY_MB 调整）`,
                    received,
                });
            }
            try {
                // 302 重定向链：n 次后仍落到 /mock 正常响应。fetch 与 XHR 都会
                // 跟随，用来实测 res.responseURL / res.redirected 与 config.url 的区别。
                const redirects = Math.min(Math.max(Number(q.get('redirect')) || 0, 0), 10);
                if (redirects > 0) {
                    const next = new URL(req.url, `http://${HOST}:${PORT}`);
                    if (redirects === 1) next.searchParams.delete('redirect');
                    else next.searchParams.set('redirect', String(redirects - 1));
                    res.writeHead(302, { location: next.pathname + next.search });
                    return res.end();
                }
                const buf = Buffer.concat(chunks, received);
                const status = Number(q.get('status')) || 200;
                const delay = Math.min(Number(q.get('delay')) || 0, 60000);
                const rt = (q.get('rt') || 'json').toLowerCase();
                const echo = q.get('echo') !== '0';

                // 请求回显
                const ct = req.headers['content-type'] || '';
                let fields = {};
                let files = [];
                let bodyText = '';
                if (/multipart\/form-data/i.test(ct)) {
                    // multipart 是二进制：不要先把整包 30MB 转成 UTF-8 字符串再
                    // 尝试 JSON.parse（纯浪费且会污染内存）。只解析元信息即可。
                    const mp = parseMultipart(buf, ct);
                    if (mp) { fields = mp.fields; files = mp.files; }
                    else bodyText = buf.toString('utf8');
                } else {
                    bodyText = buf.toString('utf8');
                    if (/x-www-form-urlencoded/i.test(ct)) {
                        fields = Object.fromEntries(new URLSearchParams(bodyText));
                    }
                }
                let bodyJson = null;
                if (bodyText) {
                    try { bodyJson = JSON.parse(bodyText); } catch { /* not json */ }
                }

                const requestInfo = {
                    method: req.method,
                    url: p + url.search,
                    query: Object.fromEntries(q),
                    headers: req.headers,
                    bodyText: bodyText || undefined,
                    bodyJson: bodyJson || undefined,
                    fields: Object.keys(fields).length ? fields : undefined,
                    files: files.length ? files : undefined,
                };

                const respond = () => {
                    // GBK 错误 content-type 场景
                    if (q.get('wrongct') === '1' && q.get('charset') === 'gbk') {
                        res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
                        return res.end(GBK_BYTES);
                    }
                    // 消息流 SSE
                    if (q.get('stream') === '1') {
                        const n = Math.min(Number(q.get('n')) || 3, 50);
                        const ms = Math.max(Number(q.get('ms')) || 60, 0);
                        res.writeHead(status, {
                            'content-type': 'text/event-stream; charset=utf-8',
                            'cache-control': 'no-cache',
                            connection: 'keep-alive',
                        });
                        let i = 0;
                        const tick = () => {
                            if (i >= n) { res.write('data: [DONE]\n\n'); return res.end(); }
                            i += 1;
                            res.write(`data: {"n":${i},"t":${Date.now()}}\n\n`);
                            if (ms > 0) setTimeout(tick, ms);
                            else tick();
                        };
                        return tick();
                    }
                    const customBody = q.get('body');
                    // urlencode 响应
                    if (rt === 'urlencode') {
                        const payload = Object.keys(fields).length
                            ? new URLSearchParams(fields).toString()
                            : (customBody || `mock=1&type=urlencode&ts=${Date.now()}`);
                        res.writeHead(status, { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' });
                        return res.end(payload);
                    }
                    // 纯文本响应
                    if (rt === 'text') {
                        const payload = customBody || (echo
                            ? `${req.method} ${url.search}\n` +
                              (bodyText ? `body=${bodyText}\n` : '') +
                              (Object.keys(fields).length ? `fields=${JSON.stringify(fields)}\n` : '') +
                              (files.length ? `files=${files.map((f) => f.filename).join(',')}\n` : '')
                            : 'ok');
                        res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
                        return res.end(payload);
                    }
                    // json（默认）
                    let data;
                    if (customBody != null) {
                        try { data = JSON.parse(customBody); } catch { data = customBody; }
                    } else if (echo) {
                        data = { request: requestInfo };
                    } else {
                        data = { ok: true };
                    }
                    return sendJSON(res, status, data);
                };

                if (delay > 0) return setTimeout(respond, delay);
                return respond();
            } catch (err) {
                sendJSON(res, 500, { error: String((err && err.message) || err) });
            }
        });
        return;
    }

    return sendJSON(res, 404, { error: 'not found', path: p });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`端口 ${PORT} 已被占用，调试服务无法启动（换 PORT 或先结束占用进程）。`);
        process.exit(1);
    }
    throw err;
});

server.listen(PORT, HOST, () => {
    console.log(`bxf 通用调试 Mock 服务已启动：http://${HOST}:${PORT}/`);
    console.log(`通用接口：/mock  ?status= &rt=json|text|urlencode|sse &delay= &body= &stream=1&n=&ms= &charset=gbk&wrongct=1 &redirect=`);
    console.log(`（按 Ctrl+C 停止）`);
});
