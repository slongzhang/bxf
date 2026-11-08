/**
 * bxf 控制台实验室 —— Node.js 单命令启动
 * ------------------------------------------------------------------
 * 用法：
 *   node examples/playground/server.mjs            # 默认 7788（跨源站 7789）
 *   node examples/playground/server.mjs 9000      # 指定端口
 *   PORT=9000 node examples/playground/server.mjs
 *
 * 页面：http://127.0.0.1:<PORT>/
 * 注意：需要一个连续的两个端口（PORT 与 PORT+1），任一被占用都会明确报错退出，
 *       不会出现「页面开得出来但请求打到别的服务」的半启动状态。
 *   - 自动内联 dist/bxf.umd.js 与 toolkit.js
 *   - 所有 ?api=xxx 端点由本文件提供，零第三方依赖
 *   - 页面里每个案例都有「复制」(贴到 DevTools 控制台) 与「运行」(页内直接看结果)
 *
 * 案例唯一数据源：cases.mjs（README 的案例章节也由它生成，不会两处漂移）
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CASES, GROUPS } from './cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DIST_FILE = path.join(ROOT, 'dist', 'bxf.umd.js');
const TOOLKIT_FILE = path.join(HERE, 'toolkit.js');

const PORT = Number(process.argv[2] || process.env.PORT || 7788);
const CROSS_PORT = PORT + 1;
const MAIN_ORIGIN = `http://127.0.0.1:${PORT}`;

// 一组 GBK 编码的中文（Node 没有内置 iconv，直接下发字节），用于验证 charset 提取
const GBK_TEXT_HEX = '47424bd6d0cec4b2e2cad4a3bac4e3bac3a3accac0bde720a1aaa1aa206368617273657420c0b4d7d420636f6e74656e742d74797065';
const PNG_1PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

/**
 * 读取查询参数里的整数并夹到 [min,max]。
 * 必须区分「参数缺失」与「参数值为 0」：用 `parseInt(x) || def` 会把 0 换成默认值，
 * 在 redirect 的 n=0（重定向链终点）上会造成无限 302 循环。
 */
function clampInt(sp, key, def, min, max) {
    const raw = sp.get(key);
    if (raw === null || raw === '') return def;
    const v = parseInt(raw, 10);
    if (!Number.isFinite(v)) return def;
    return Math.min(Math.max(v, min), max);
}

function readBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', () => resolve(Buffer.concat(chunks)));
    });
}

function commonHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Bxf-Playground', '1');
}

/** 跨源端口：任何请求都带 CORS 头；主端口的 ?api=cors 也带 */
function applyCors(res, req) {
    const origin = req.headers.origin || MAIN_ORIGIN;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || 'content-type,x-demo,xsrf-token,authorization');
    res.setHeader('Access-Control-Expose-Headers', '*');
}

function sendJson(res, data, status = 200) {
    const body = Buffer.from(JSON.stringify(data, null, 2));
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': body.length,
    });
    res.end(body);
}

function sendText(res, text, contentType = 'text/plain; charset=utf-8', status = 200) {
    const body = Buffer.isBuffer(text) ? text : Buffer.from(text);
    res.writeHead(status, { 'Content-Type': contentType, 'Content-Length': body.length });
    res.end(body);
}

/* ================================================================== *
 * API 端点
 * ================================================================== */
async function handleApi(req, res, url, isCross) {
    const api = url.searchParams.get('api') || '';
    const sp = url.searchParams;
    commonHeaders(res);
    if (isCross || api === 'cors') applyCors(res, req);
    res.setHeader('X-Bxf-Api', api);

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const body = await readBody(req);

    switch (api) {
        /* ---------- 请求回显：method / query / headers / body ---------- */
        case 'echo': {
            const query = {};
            for (const [k, v] of sp.entries()) { if (k !== 'api') query[k] = v; }
            sendJson(res, {
                method: req.method,
                url: req.url,
                query,
                headers: req.headers,
                cookie: req.headers.cookie || null,
                body: body.toString('utf8'),
                bodyLength: body.length,
                bodyMd5: md5(body),
                serverTime: new Date().toISOString(),
            });
            return;
        }

        /* ---------- 各种响应体 ---------- */
        case 'json':
            return sendJson(res, {
                ok: true, text: '中文正常', n: 1,
                list: [1, 2, 3], nested: { a: { b: true } }, nullValue: null,
            });

        case 'text':
            return sendText(res, '纯文本响应\n第二行：中文');

        case 'badjson':
            return sendText(res, 'this is { not valid json', 'application/json; charset=utf-8');

        case 'html':
            return sendText(res,
                '<!DOCTYPE html><html><head><title>T</title></head>' +
                '<body><div id="app" class="box">HTML 响应</div></body></html>',
                'text/html; charset=utf-8');

        case 'xml':
            return sendText(res,
                '<?xml version="1.0" encoding="utf-8"?><root><item id="1">中文</item></root>',
                'application/xml; charset=utf-8');

        case 'binary':
            return sendText(res, PNG_1PX, 'application/octet-stream');

        case 'utf8':
            return sendText(res, 'UTF-8 编码：你好，世界 —— 测试 charset 提取');

        case 'gbk':
            return sendText(res, Buffer.from(GBK_TEXT_HEX, 'hex'), 'text/plain; charset=gbk');

        case 'gbk-wrongct':
            // 响应头错写 utf-8、字节实际是 GBK（1688 等页面的真实场景），
            // 用于验证 config.charset 能覆盖响应头声明。
            return sendText(res, Buffer.from(GBK_TEXT_HEX, 'hex'), 'text/plain; charset=utf-8');

        case 'empty':
            return sendText(res, '', 'application/json; charset=utf-8');

        case '204':
            res.writeHead(204); res.end(); return;

        case '304':
            res.writeHead(304); res.end(); return;

        case 'bytes': {
            const n = clampInt(sp, 'n', 64, 0, 1024 * 1024);
            const buf = Buffer.alloc(n);
            for (let i = 0; i < n; i++) buf[i] = i % 256;
            return sendText(res, buf, 'application/octet-stream');
        }

        /* ---------- 任意状态码 + 业务体（resolveStatus / err.response） ---------- */
        case 'status': {
            let code = clampInt(sp, 'code', 429, 100, 599);
            if (code === 204 || code === 304) { res.writeHead(code); res.end(); return; }
            return sendJson(res, { status: code, ok: false, message: `forced status ${code}` }, code);
        }

        /* ---------- 重复响应头 / Set-Cookie ---------- */
        case 'multiheader': {
            const payload = Buffer.from(JSON.stringify({ multiHeader: true, expect: 'X-Multi 应合并为 "alpha, beta"' }));
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': payload.length,
                'X-Multi': ['alpha', 'beta'],
                'X-Bxf-Single': 'only-one',
            });
            res.end(payload); return;
        }

        case 'cookie': {
            res.setHeader('Set-Cookie', ['mc_one=1; Path=/', 'mc_two=2; Path=/']);
            return sendJson(res, { setCookie: true, receivedCookie: req.headers.cookie || null });
        }

        /* ---------- 延迟 / 超时 / 取消 ---------- */
        case 'delay': {
            const ms = clampInt(sp, 'ms', 800, 0, 30000);
            await sleep(ms);
            return sendJson(res, { delayedMs: ms, ok: true });
        }

        /* ---------- SSE 流（responseType:"stream" / onStream） ---------- */
        case 'sse': {
            const n = clampInt(sp, 'n', 4, 1, 50);
            const ms = clampInt(sp, 'ms', 120, 0, 5000);
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
            for (let i = 1; i <= n; i++) {
                res.write(`id: ${i}\nevent: tick\ndata: ${JSON.stringify({ i, at: Date.now() })}\n\n`);
                await sleep(ms);
            }
            res.write('data: [DONE]\n\n');
            res.end(); return;
        }

        /* ---------- 慢速分块（raw 流中转 / onDownloadProgress） ---------- */
        case 'slowchunks': {
            const n = clampInt(sp, 'n', 6, 1, 100);
            const ms = clampInt(sp, 'ms', 150, 0, 5000);
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            for (let i = 1; i <= n; i++) {
                res.write(`chunk-${i}/${n} `);
                await sleep(ms);
            }
            res.end(); return;
        }

        /* ---------- 大响应（下载进度 / blob / arraybuffer） ---------- */
        case 'large': {
            const kb = clampInt(sp, 'kb', 256, 1, 8192);
            const chunks = clampInt(sp, 'chunks', 8, 1, 64);
            const ms = clampInt(sp, 'ms', 30, 0, 2000);
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'X-Bxf-Total': String(kb * 1024),
            });
            const each = Math.ceil((kb * 1024) / chunks);
            let sent = 0;
            for (let i = 0; i < chunks && sent < kb * 1024; i++) {
                const size = Math.min(each, kb * 1024 - sent);
                res.write(Buffer.alloc(size, 65 + (i % 26)));
                sent += size;
                await sleep(ms);
            }
            res.end(); return;
        }

        /* ---------- 重定向（redirect 一等公民能力） ---------- */
        case 'redirect': {
            const n = clampInt(sp, 'n', 2, 0, 10);
            if (n > 0) {
                res.writeHead(302, { Location: `${url.pathname}?api=redirect&n=${n - 1}` });
                res.end(); return;
            }
            return sendJson(res, { redirected: true, final: true });
        }

        /* ---------- 上传回显（代理下载 / 上传进度） ---------- */
        case 'upload':
            return sendJson(res, {
                received: body.length,
                md5: md5(body),
                contentType: req.headers['content-type'] || null,
                ok: true,
            });

        /* ---------- 异常：非法 JSON / 中途断连 ---------- */
        case 'broken': {
            if (sp.get('mode') === 'destroy') {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.write('{"half":');
                await sleep(80);
                res.destroy();            // 制造 ERR_NETWORK
                return;
            }
            return sendText(res, '{ invalid json', 'application/json; charset=utf-8', 200);
        }

        /* ---------- CORS（跨源端口所有端点都可用，这个只是显式标记） ---------- */
        case 'cors':
            return sendJson(res, { cors: true, origin: req.headers.origin || null });

        default:
            return sendJson(res, {
                error: `未知端点 api=${api}`,
                available: [
                    'echo', 'json', 'text', 'badjson', 'html', 'xml', 'binary', 'utf8', 'gbk',
                    'gbk-wrongct',
                    'empty', '204', '304', 'bytes', 'status', 'multiheader', 'cookie', 'delay',
                    'sse', 'slowchunks', 'large', 'redirect', 'upload', 'broken', 'cors',
                ],
            }, 404);
    }
}

/* ================================================================== *
 * 页面
 * ================================================================== */
function htmlPage(hasLib) {
    const payload = JSON.stringify({ groups: GROUPS, cases: CASES, hasLib, port: PORT, crossPort: CROSS_PORT })
        .replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>bxf 控制台实验室</title>
<style>
  :root{--bg:#f5f7fb;--card:#fff;--ink:#16233a;--muted:#66738c;--line:#e2e8f2;
        --blue:#1d5fd0;--blue-soft:#eaf1ff;--code:#0f1b2d;--code-ink:#dbe8ff;
        --ok:#0f8a56;--warn:#b45309;--err:#c0392b;--chip:#eef3fb}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
       font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  header{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--line);
         padding:14px 24px;box-shadow:0 2px 10px rgba(20,40,80,.05)}
  .top{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  h1{font-size:19px;margin:0;letter-spacing:.3px}
  h1 span{color:var(--blue)}
  .meta{color:var(--muted);font-size:12.5px}
  .meta code{background:var(--chip);padding:2px 6px;border-radius:4px;color:var(--blue)}
  .search{margin-left:auto;border:1px solid var(--line);border-radius:8px;padding:7px 11px;
          min-width:240px;font-size:13px;outline:none;background:#fbfcff}
  .search:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-soft)}
  .banner{margin-top:10px;padding:9px 12px;border-radius:8px;font-size:13px;line-height:1.6}
  .banner.info{background:var(--blue-soft);color:#17458f}
  .banner.bad{background:#fdecea;color:#922}
  .banner code{background:rgba(255,255,255,.7);padding:1px 5px;border-radius:4px}
  .wrap{display:flex;gap:22px;max-width:1500px;margin:0 auto;padding:22px 24px 80px}
  nav{width:230px;flex:none;position:sticky;top:96px;align-self:flex-start;max-height:calc(100vh - 120px);overflow:auto}
  nav a{display:block;padding:6px 10px;color:var(--muted);text-decoration:none;border-radius:6px;font-size:13px}
  nav a:hover{background:var(--blue-soft);color:var(--blue)}
  nav .navtitle{font-size:11px;color:#98a4bb;letter-spacing:1px;margin:4px 10px 8px}
  main{flex:1;min-width:0}
  section{scroll-margin-top:100px;margin-bottom:30px}
  .grouphead{display:flex;align-items:baseline;gap:10px;margin:0 0 12px}
  .grouphead h2{font-size:17px;margin:0}
  .grouphead p{margin:0;color:var(--muted);font-size:12.5px}
  .case{background:var(--card);border:1px solid var(--line);border-radius:11px;margin-bottom:12px;overflow:hidden;
        box-shadow:0 1px 3px rgba(20,40,80,.04)}
  .case-head{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--line)}
  .num{font-size:11px;color:#fff;background:var(--blue);border-radius:5px;padding:1px 7px;flex:none}
  .case-title{font-weight:600;font-size:14px}
  .case-desc{color:var(--muted);font-size:12.5px;margin-left:4px}
  .btns{margin-left:auto;display:flex;gap:7px;flex:none}
  button{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:7px;
         padding:5px 12px;font-size:12.5px;cursor:pointer;transition:.15s}
  button:hover{border-color:var(--blue);color:var(--blue)}
  button.primary{background:var(--blue);border-color:var(--blue);color:#fff}
  button.primary:hover{background:#164fae;color:#fff}
  button.copied{background:var(--ok);border-color:var(--ok);color:#fff}
  pre{margin:0;padding:13px 15px;background:var(--code);color:var(--code-ink);overflow:auto;
      font:12.5px/1.7 "SFMono-Regular",Consolas,"Liberation Mono",monospace;white-space:pre}
  .out{display:none;border-top:1px solid var(--line);background:#fafbff;padding:10px 14px;
       font:12px/1.6 "SFMono-Regular",Consolas,monospace;white-space:pre-wrap;max-height:340px;overflow:auto}
  .out.show{display:block}
  .out .lvl-err{color:var(--err)} .out .lvl-warn{color:var(--warn)}
  .empty{color:var(--muted);padding:10px 14px}
  .toolbar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
  .hidden{display:none!important}
  footer{max-width:1500px;margin:0 auto;padding:0 24px 60px;color:var(--muted);font-size:12px}
</style>
</head>
<body>
<header>
  <div class="top">
    <h1>bxf <span>控制台实验室</span></h1>
    <div class="meta">服务 <code>${MAIN_ORIGIN}</code> · 跨源站 <code>http://127.0.0.1:${CROSS_PORT}</code> · 案例 <b id="caseCount">0</b> 条</div>
    <input class="search" id="q" placeholder="搜索案例 / 参数 / 代码…">
  </div>
  <div class="banner ${hasLib ? 'info' : 'bad'}" id="banner"></div>
</header>

<div class="wrap">
  <nav><div class="navtitle">案例分组</div><div id="nav"></div></nav>
  <main>
    <div class="toolbar">
      <button id="expandAll">全部展开输出</button>
      <button id="clearAll">清空输出</button>
      <button id="runAll" class="primary">顺序跑一遍（看全库行为）</button>
    </div>
    <div id="content"></div>
  </main>
</div>
<footer>案例数据源：<code>examples/playground/cases.mjs</code> · README 由同一份数据生成 · 工具库：<code>examples/playground/toolkit.js</code></footer>

<script>window.__LAB__ = ${payload};</script>
${hasLib ? '<script src="/__bxf.js"></script>' : ''}
<script src="/__toolkit.js"></script>
<script>
(function () {
  var DATA = window.__LAB__;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var content = $('#content'), nav = $('#nav');
  $('#caseCount').textContent = DATA.cases.length;
  $('#banner').innerHTML = DATA.hasLib
    ? '控制台已挂载：<code>api</code>（已配好的实例）、<code>apiUrl(name, extra)</code>、<code>crossUrl()</code>、<code>show()</code>、<code>dump()</code>、<code>inspect()</code>、<code>probeAll()</code>。<b>复制任意代码到 DevTools 控制台即可执行，改参数就能看结果。</b>'
    : '未找到 <code>dist/bxf.umd.js</code>，请先在仓库根目录执行 <code>pnpm run build</code> 后刷新本页。';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var idx = 0;
  DATA.groups.forEach(function (g) {
    var list = DATA.cases.filter(function (c) { return c.group === g.id; });
    if (!list.length) return;
    var sec = document.createElement('section');
    sec.id = 'g-' + g.id;
    sec.innerHTML = '<div class="grouphead"><h2>' + esc(g.title) + '</h2><p>' + esc(g.desc || '') + '</p></div>';
    list.forEach(function (c) {
      idx++;
      var el = document.createElement('div');
      el.className = 'case';
      el.dataset.search = (c.title + ' ' + c.desc + ' ' + c.code + ' ' + g.title).toLowerCase();
      el.innerHTML =
        '<div class="case-head"><span class="num">' + idx + '</span>' +
        '<span class="case-title">' + esc(c.title) + '</span>' +
        '<span class="case-desc">' + esc(c.desc || '') + '</span>' +
        '<span class="btns"><button data-act="run">▶ 运行</button>' +
        '<button data-act="copy" class="primary">复制代码</button></span></div>' +
        '<pre><code>' + esc(c.code) + '</code></pre>' +
        '<div class="out"></div>';
      el._code = c.code;
      sec.appendChild(el);
    });
    content.appendChild(sec);
    var a = document.createElement('a');
    a.href = '#g-' + g.id;
    a.textContent = g.title + ' (' + list.length + ')';
    nav.appendChild(a);
  });

  /* ---------- 页内运行：临时劫持 console，把 show() 的输出留在卡片里 ---------- */
  function fmt(v) {
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (v instanceof Error) return v.name + ': ' + v.message + (v.code ? ' [' + v.code + ']' : '');
    if (v && v.isBxfError) return 'BxfError(' + v.code + ') ' + v.message;
    if (v && typeof v === 'object') {
      var keys = Object.keys(v);
      if (keys.indexOf('data') >= 0 && keys.indexOf('status') >= 0 && keys.indexOf('config') >= 0) {
        return 'BxfResponse {status:' + v.status + ', data:<见下>, engine:' + (v.engine || '?') + '}';
      }
      try { var s = JSON.stringify(v, function (k, val) {
        if (k === 'config' || k === 'Response' || k === 'response') return '<略，控制台可展开>';
        return val;
      }, 2); return s.length > 1400 ? s.slice(0, 1400) + ' …' : s; } catch (e) { return String(v); }
    }
    return String(v);
  }

  async function runCode(code, out) {
    var logs = [];
    var orig = {};
    ['log','warn','error','info'].forEach(function (lv) {
      orig[lv] = console[lv];
      console[lv] = function () {
        var args = Array.prototype.slice.call(arguments);
        logs.push({ lv: lv, text: args.map(fmt).join(' ') });
        if (orig[lv]) orig[lv].apply(console, arguments);
      };
    });
    out.classList.add('show');
    out.innerHTML = '⏳ 运行中…';
    try {
      var fn = new Function('return (async () => {\\n' + code + '\\n})()');
      await fn();
    } catch (e) {
      logs.push({ lv: 'error', text: '❌ ' + (e && e.stack ? e.stack : String(e)) });
    } finally {
      Object.keys(orig).forEach(function (lv) { console[lv] = orig[lv]; });
    }
    out.innerHTML = logs.length
      ? logs.map(function (l) { return '<div class="lvl-' + (l.lv === 'error' ? 'err' : l.lv === 'warn' ? 'warn' : '') + '">' + esc(l.text) + '</div>'; }).join('')
      : '<span class="empty">（无输出：案例可能只把结果挂到了变量上，去控制台展开看）</span>';
    return out;
  }

  content.addEventListener('click', async function (ev) {
    var btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    var card = btn.closest('.case');
    var out = $('.out', card);
    if (btn.dataset.act === 'copy') {
      var text = card._code;
      try { await navigator.clipboard.writeText(text); }
      catch (e) {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      var old = btn.textContent; btn.textContent = '✓ 已复制'; btn.classList.add('copied');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('copied'); }, 1200);
    } else {
      btn.disabled = true; btn.textContent = '…';
      await runCode(card._code, out);
      btn.disabled = false; btn.textContent = '▶ 运行';
    }
  });

  $('#expandAll').onclick = function () {
    Array.prototype.forEach.call(document.querySelectorAll('.out'), function (o) {
      o.classList.add('show'); if (!o.innerHTML) o.innerHTML = '<span class="empty">（尚未运行）</span>';
    });
  };
  $('#clearAll').onclick = function () {
    Array.prototype.forEach.call(document.querySelectorAll('.out'), function (o) {
      o.innerHTML = ''; o.classList.remove('show');
    });
  };
  $('#runAll').onclick = async function () {
    var b = this; b.disabled = true;
    var cards = Array.prototype.filter.call(document.querySelectorAll('.case'), function (c) { return !c.classList.contains('hidden'); });
    for (var i = 0; i < cards.length; i++) {
      b.textContent = '运行中 ' + (i + 1) + '/' + cards.length;
      await runCode(cards[i]._code, $('.out', cards[i]));
    }
    b.disabled = false; b.textContent = '顺序跑一遍（看全库行为）';
  };

  $('#q').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll('.case'), function (c) {
      c.classList.toggle('hidden', q !== '' && c.dataset.search.indexOf(q) < 0);
    });
    Array.prototype.forEach.call(document.querySelectorAll('section'), function (s) {
      var vis = s.querySelectorAll('.case:not(.hidden)').length;
      s.classList.toggle('hidden', vis === 0);
    });
  });
})();
</script>
</body>
</html>`;
}

/* ================================================================== *
 * 静态资源 & 启动
 * ================================================================== */
function serveFile(res, file, type) {
    if (!fs.existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('not found: ' + file); return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(file));
}

function makeHandler(isCross) {
    const base = `http://127.0.0.1:${isCross ? CROSS_PORT : PORT}`;
    return async (req, res) => {
        // 畸形 URL（例如 req.url === '//'）会让 new URL 抛错；
        // 不兜住的话一个请求就能让整个服务进程退出。
        let url;
        try {
            url = new URL(req.url, base);
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('bad request url: ' + req.url);
            return;
        }
        try {
            const pathname = url.pathname;

            if (pathname === '/__bxf.js') return serveFile(res, DIST_FILE, 'application/javascript; charset=utf-8');
            if (pathname === '/__toolkit.js') return serveFile(res, TOOLKIT_FILE, 'application/javascript; charset=utf-8');
            if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
            if (url.searchParams.has('api')) return await handleApi(req, res, url, isCross);
            if (pathname === '/' || pathname === '/index.html') {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end(htmlPage(fs.existsSync(DIST_FILE))); return;
            }
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404');
        } catch (e) {
            console.error('[bxf lab] 处理请求异常：', e && e.message);
            if (!res.headersSent) {
                try { res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }); } catch (_) { /* ignore */ }
            }
            try { res.end(JSON.stringify({ error: String(e && e.message || e) })); } catch (_) { /* ignore */ }
        }
    };
}

const main = http.createServer(makeHandler(false));
const cross = http.createServer(makeHandler(true));

main.listen(PORT, '127.0.0.1', () => {
    console.log(`\n[bxf lab] 页面已就绪： ${MAIN_ORIGIN}/`);
    console.log(`[bxf lab] 跨源测试站：  http://127.0.0.1:${CROSS_PORT}/  (?api=... 带 CORS 头)`);
    console.log(`[bxf lab] 案例 ${CASES.length} 条 / ${GROUPS.length} 组；dist 库文件：${fs.existsSync(DIST_FILE) ? '已加载' : '缺失（先跑 pnpm run build）'}\n`);
});
cross.listen(CROSS_PORT, '127.0.0.1');

function onListenError(which, port) {
    return (e) => {
        console.error(`\n[bxf lab] ${which}端口 ${port} 启动失败：${e.message}`);
        if (e.code === 'EADDRINUSE') {
            console.error(`[bxf lab] 端口被占用。换一组端口试试：node examples/playground/server.mjs ${port + 10}`);
        }
        process.exit(1);   // 必须整体退出，避免只起来一半导致请求打到别的服务
    };
}
main.on('error', onListenError('主', PORT));
cross.on('error', onListenError('跨源', CROSS_PORT));
