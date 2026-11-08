/**
 * bxf 控制台实验室 —— 案例唯一数据源
 * ------------------------------------------------------------------
 * 该文件同时被两处消费：
 *   1. server.mjs        生成网页里的案例卡片（复制 / 页内运行）
 *   2. gen-readme.mjs    生成 README 的「控制台案例」章节
 * 因此 README 与网页的案例永远不会漂移。
 *
 * 每条 code 的约定（重要）：
 *   - 一段可独立复制到 DevTools 控制台执行的语句，不依赖页面 DOM
 *   - 只依赖 toolkit.js 挂的全局：api / apiUrl / crossUrl / show / grab /
 *     dump / inspect / meta / cmp / probeAll / instance / typeOf / sleep
 *   - 不写顶层 const/let（避免重复粘贴时报「已声明」）；多步用 async IIFE 包起来
 *   - 可能失败的用例一律用 `await grab(...)`，成功/失败都打印
 */

export const GROUPS = [
    { id: 'start',     title: '① 快速开始',        desc: '最小请求、完整响应、错误响应、速览工具' },
    { id: 'call',      title: '② 调用形态与实例',  desc: '4 种入参、方法快捷方式、create/all/spread' },
    { id: 'encode',    title: '③ URL / params / data', desc: '参数序列化（对象 / 字符串 / URLSearchParams / 表单数组）、请求体编码、baseURL、绝对地址' },
    { id: 'headers',   title: '④ 请求头与凭据',    desc: 'headers（对象 / Headers / 键值对数组）、auth、xsrf、cookie、重复响应头、CORS' },
    { id: 'response',  title: '⑤ 响应契约与 responseType', desc: '全 8 种响应类型、charset、空体/204/304' },
    { id: 'status',    title: '⑥ resolveStatus 与错误响应', desc: '数字/数组/区间/函数规则、err.response 家族' },
    { id: 'engine',    title: '⑦ 引擎与能力矩阵',  desc: '显式引擎、自动选引擎、能力冲突、自定义引擎' },
    { id: 'progress',  title: '⑧ 上传 / 下载进度', desc: 'XHR 专属能力，未指定引擎时自动切换' },
    { id: 'stream',    title: '⑨ 流式与流中转',    desc: 'SSE / onStream / raw 流中转 / 边下边传' },
    { id: 'cancel',    title: '⑩ 超时与取消',      desc: 'timeout、signal、AbortController、长流不被掐断' },
    { id: 'hooks',     title: '⑪ 拦截器与前置钩子', desc: 'request/response 顺序、rejected、eject/clear、beforeInterceptors' },
    { id: 'replay',    title: '⑫ 配置快照与重放',  desc: 'res.config / err.config 回喂、外部重放、可序列化' },
    { id: 'advanced',  title: '⑬ 一等公民与逃生舱', desc: 'fetchOptions/xhrOptions/rawFields、mode/redirect/cache 等' },
    { id: 'errors',    title: '⑭ 错误码全景',      desc: '各 code 的可复现触发方式与速查表' },
];

export const CASES = [

    /* ==================== ① 快速开始 ==================== */
    { group: 'start', title: '最小请求', desc: '默认 GET + auto 解析，拿到完整 BxfResponse', code:
`show(await api.get(apiUrl('json')));` },

    { group: 'start', title: '完整响应的所有属性', desc: '固定 5 字段：data / status / statusText / headers / config', code:
`show(await api.get(apiUrl('json')), '完整响应');` },

    { group: 'start', title: '只要业务数据 onlyData', desc: '返回 res.data，不再是完整响应对象', code:
`show(await api.get(apiUrl('json'), { onlyData: true }), 'onlyData');` },

    { group: 'start', title: '任何 HTTP 状态码默认都 resolve', desc: '不传 resolveStatus 时 429/502 也算成功', code:
`show(await api.get(apiUrl('status', 'code=502')), '502 也 resolve');` },

    { group: 'start', title: '状态码被拒绝 → err.response', desc: 'ERR_HTTP_STATUS 时拿到整包响应', code:
`await grab(api.get(apiUrl('status', 'code=429'), { resolveStatus: [[200, 300]] }), '429 被拒');` },

    { group: 'start', title: '网络层失败 → 没有 err.response', desc: '没拿到 HTTP 响应，config 仍可回喂', code:
`await grab(api.get('http://127.0.0.1:1/nope'), '网络失败');` },

    { group: 'start', title: '列出全部属性（含不可枚举）', desc: 'engine 是不可枚举的元数据', code:
`inspect(await api.get(apiUrl('json')));` },

    { group: 'start', title: '只看元数据', desc: 'engine 是实际生效引擎，不是你传入的原值', code:
`meta(await api.get(apiUrl('json')));` },

    { group: 'start', title: '一次性看全库行为', desc: '16 个代表性场景跑成一张对照表', code:
`await probeAll();` },

    /* ==================== ② 调用形态与实例 ==================== */
    { group: 'call', title: '形态 1：bxf(config)', desc: '单对象入参', code:
`show(await api({ url: apiUrl('json') }));` },

    { group: 'call', title: '形态 2：bxf(url, config)', desc: '字符串 URL + 配置对象', code:
`show(await api(apiUrl('json'), { responseType: 'text' }));` },

    { group: 'call', title: '形态 3：bxf.get(url, config)', desc: '无 data 的快捷方法', code:
`show(await api.get(apiUrl('json'), { onlyData: true }));` },

    { group: 'call', title: '形态 4：bxf.post(url, data, config)', desc: '带 data 的快捷方法', code:
`show(await api.post(apiUrl('echo'), { a: 1, b: '中文' }), 'POST JSON');` },

    { group: 'call', title: 'bxf.request === bxf', desc: '同一个函数引用', code:
`console.log('bxf.request === bxf →', bxf.request === bxf, '| api.request === api →', api.request === api);` },

    { group: 'call', title: 'PUT / PATCH 带请求体', desc: 'method 会转成大写', code:
`show(await api.put(apiUrl('echo'), { via: 'put' }), 'PUT');` },

    { group: 'call', title: 'DELETE / HEAD / OPTIONS', desc: '无请求体方法，echo 回显真实 method', code:
`console.log('DELETE →', (await api.delete(apiUrl('echo'))).data.method,
  '| HEAD →', (await api.head(apiUrl('echo'))).status,
  '| OPTIONS →', (await api.options(apiUrl('echo'))).data.method);` },

    { group: 'call', title: 'DELETE / OPTIONS 也能带请求体', desc: '快捷方法把 data 写进 config：api.delete(url, { data })', code:
`show(await api.delete(apiUrl('echo'), { data: { id: 7, reason: 'cleanup' } }), 'DELETE 带体');
show(await api.options(apiUrl('echo'), { data: { probe: 1 } }), 'OPTIONS 带体');` },

    { group: 'call', title: '任意 method 覆盖', desc: 'config.method 不限于快捷方法', code:
`show(await api({ url: apiUrl('echo'), method: 'PROPFIND' }), '自定义 method');` },

    { group: 'call', title: 'create(defaults) 独立实例', desc: 'defaults 不共享，baseURL 自动补 /', code:
`await (async () => {
  var x = instance({ baseURL: location.origin + '/', timeout: 5000, headers: { 'X-From': 'instance' } });
  show(await x.get('?api=echo'), '相对地址 + defaults');
})();` },

    { group: 'call', title: '单次 config 覆盖 defaults', desc: 'deepMerge 后以单次配置为准', code:
`await (async () => {
  var x = instance({ headers: { 'X-Level': 'defaults' }, responseType: 'text' });
  show(await x.get(apiUrl('echo'), { headers: { 'X-Level': 'single' }, responseType: 'auto' }), '覆盖 defaults');
})();` },

    { group: 'call', title: 'api.all 并发', desc: '等价于 Promise.all', code:
`show(await api.all([api.get(apiUrl('json')), api.get(apiUrl('text'))]), 'all 两条');` },

    { group: 'call', title: 'api.spread 展开结果', desc: '把数组摊开成多参数', code:
`show(await api.all([api.get(apiUrl('json')), api.get(apiUrl('text'))])
  .then(api.spread(function (a, b) { return { first: a.status, second: b.data }; })), 'spread');` },

    /* ==================== ③ URL / params / data ==================== */
    { group: 'encode', title: 'params 对象（含嵌套 / 数组 / 中文）', desc: 'jQuery.param 风格编码，echo 回显 query', code:
`show(await api.get(apiUrl('echo'), { params: { a: 1, b: '中文', arr: [1, 2], nested: { x: 1 } } }), 'params');` },

    { group: 'encode', title: 'params 字符串原样拼接', desc: '字符串不再二次编码', code:
`show(await api.get(apiUrl('echo'), { params: 'a=1&b=2' }), 'params 字符串');` },

    { group: 'encode', title: 'params: URLSearchParams', desc: '走其 toString()，不会因遍历原型方法崩溃', code:
`show(await api.get(apiUrl('echo'), { params: new URLSearchParams({ a: '1', c: '中文' }) }), 'URLSearchParams params');` },

    { group: 'encode', title: 'params: [{name,value}] 表单数组', desc: 'jQuery 表单数组形态，按 name=value 拼接', code:
`show(await api.get(apiUrl('echo'), { params: [{ name: 'a', value: 1 }, { name: 'c', value: '中文' }] }), '表单数组 params');` },

    { group: 'encode', title: 'paramsSerializer 自定义', desc: '完全接管序列化', code:
`show(await api.get(apiUrl('echo'), { params: { a: 1, b: 2 }, paramsSerializer: function (p) { return Object.keys(p).map(function (k) { return k + '=' + p[k]; }).join('&'); } }), '自定义序列化');` },

    { group: 'encode', title: 'GET 的 data 自动降级为 params', desc: '仅纯对象生效', code:
`show(await api.get(apiUrl('echo'), { data: { fromData: 1 } }), 'GET data → params');` },

    { group: 'encode', title: 'POST 对象自动 JSON 编码', desc: '自动补 content-type: application/json', code:
`show(await api.post(apiUrl('echo'), { hello: 'world', n: 1 }), '自动 JSON');` },

    { group: 'encode', title: 'requestType: "query" 表单编码', desc: 'content-type: application/x-www-form-urlencoded', code:
`show(await api.post(apiUrl('echo'), { a: 1, b: '中文' }, { requestType: 'query' }), '表单编码');` },

    { group: 'encode', title: 'requestType: "json" + JSON 字符串', desc: '字符串是合法 JSON 时补 json 头', code:
`show(await api.post(apiUrl('echo'), '{"raw":"json"}', { requestType: 'json' }), 'JSON 字符串');` },

    { group: 'encode', title: '原始字符串 body', desc: '不指定 requestType 时原样发送', code:
`show(await api.post(apiUrl('echo'), 'plain text body'), '原始字符串');` },

    { group: 'encode', title: 'URLSearchParams 作为请求体', desc: 'fetch 会自动设置表单头', code:
`show(await api.post(apiUrl('echo'), new URLSearchParams({ k: 'v', c: '中文' })), 'URLSearchParams');` },

    { group: 'encode', title: 'ArrayBuffer / ReadableStream 作为请求体', desc: '二进制与流式 body 原样透传；ReadableStream 自动补 duplex:"half"（需浏览器支持流式上传）', code:
`await grab(api.post(apiUrl('echo'), new TextEncoder().encode('hello-ab').buffer, { engine: 'fetch' }), 'ArrayBuffer body');
await grab(api.post(apiUrl('echo'), new ReadableStream({ start: function (c) { c.enqueue(new TextEncoder().encode('hello-stream')); c.close(); } }), { engine: 'fetch' }), 'ReadableStream body');` },

    { group: 'encode', title: 'FormData 上传', desc: 'multipart/form-data，两引擎都走统一解析层', code:
`show(await api.post(apiUrl('upload'), (function () { var fd = new FormData(); fd.append('name', 'bxf'); fd.append('file', new Blob(['hello']), 'a.txt'); return fd; })()), 'FormData');` },

    { group: 'encode', title: 'baseURL + 相对地址', desc: '末尾斜杠自动归一，不会拼出 //', code:
`show(await api({ baseURL: location.origin, url: '/?api=json' }), 'baseURL');` },

    { group: 'encode', title: 'initUrl 也能当 URL 入参', desc: '对象形态下 initUrl 优先于 url', code:
`show(await api({ initUrl: apiUrl('json'), responseType: 'text' }), 'initUrl');` },

    { group: 'encode', title: '绝对地址不受 baseURL 影响', desc: 'isAbsoluteURL 判定后跳过拼接', code:
`show(await api({ baseURL: 'http://wrong.example/', url: apiUrl('json') }), '绝对地址');` },

    /* ==================== ④ 请求头与凭据 ==================== */
    { group: 'headers', title: '自定义 headers（键名小写归一）', desc: 'echo 里看规范化后的头', code:
`show(await api.get(apiUrl('echo'), { headers: { 'X-Demo': 'abc', 'X-Trace': '1' } }), '自定义头');` },

    { group: 'headers', title: 'headers: new Headers()', desc: '原生 Headers 实例也支持，不再被静默丢弃', code:
`show(await api.get(apiUrl('echo'), { headers: new Headers({ 'X-From-Headers': 'yes' }) }), 'Headers 实例');` },

    { group: 'headers', title: 'headers: [[k,v], ...] 键值对数组', desc: '第三种形态，同样小写归一', code:
`show(await api.get(apiUrl('echo'), { headers: [['X-From-Array', 'yes'], ['X-Trace', '2']] }), '键值对数组');` },

    { group: 'headers', title: '用户 content-type 不被内置值覆盖', desc: '内置头只补缺', code:
`show(await api.post(apiUrl('echo'), { a: 1 }, { headers: { 'Content-Type': 'application/vnd.my+json' } }), '用户 content-type 优先');` },

    { group: 'headers', title: 'auth 快捷写 Authorization', desc: '等价于 headers.authorization', code:
`show(await api.get(apiUrl('echo'), { auth: 'Bearer abc123' }), 'auth');` },

    { group: 'headers', title: 'xsrfHeaderName + xsrfCookieName', desc: '从 document.cookie 取值注入请求头', code:
`await (async () => {
  document.cookie = 'xsrf-token=abc123; Path=/';
  show(await api.get(apiUrl('echo'), { xsrfHeaderName: 'X-XSRF-TOKEN', xsrfCookieName: 'xsrf-token' }), 'XSRF');
})();` },

    { group: 'headers', title: '重复响应头合并成 "alpha, beta"', desc: '两引擎一致（WHATWG Headers 规范）', code:
`show(await api.get(apiUrl('multiheader')), '重复头');` },

    { group: 'headers', title: 'Set-Cookie 与 credentials', desc: 'resources 看响应的 set-cookie 处理', code:
`show(await api.get(apiUrl('cookie'), { credentials: 'include' }), 'cookie');` },

    { group: 'headers', title: 'credentials 三态对照', desc: 'same-origin / include / omit', code:
`await cmp({ url: apiUrl('echo'), credentials: 'include' }, 'credentials=include');` },

    { group: 'headers', title: '跨源请求（专用端口 + CORS 头）', desc: 'crossUrl 指向 PORT+1 的独立站点', code:
`await grab(api.get(crossUrl('cors')), '跨源 cors');` },

    { group: 'headers', title: '跨源 + credentials: include', desc: '服务端带 Allow-Credentials + Allow-Origin 回显', code:
`await grab(api.get(crossUrl('cors'), { credentials: 'include', mode: 'cors' }), '跨源带凭据');` },

    { group: 'headers', title: '跨源自定义头触发 OPTIONS 预检', desc: '服务端对 OPTIONS 直接回 204 + CORS', code:
`await grab(api.get(crossUrl('echo'), { headers: { 'X-Demo': 'preflight' } }), '预检');` },

    /* ==================== ⑤ 响应契约与 responseType ==================== */
    { group: 'response', title: 'auto（默认）自动解析 JSON', desc: '非法 JSON 保留字符串，不抛异常', code:
`show(await api.get(apiUrl('json'), { responseType: 'auto' }), 'auto');` },

    { group: 'response', title: 'text 纯字符串', desc: 'data 就是字符串，不再输出 raw 中间产物', code:
`show(await api.get(apiUrl('text'), { responseType: 'text' }), 'text');` },

    { group: 'response', title: 'json：非法 JSON 不抛异常', desc: '声明 application/json 但内容非法', code:
`show(await api.get(apiUrl('badjson'), { responseType: 'json' }), '非法 JSON');` },

    { group: 'response', title: 'blob', desc: 'data 就是 Blob', code:
`show(await api.get(apiUrl('binary'), { responseType: 'blob' }), 'blob');` },

    { group: 'response', title: 'arraybuffer', desc: '适合二进制协议 / 解密', code:
`show(await api.get(apiUrl('bytes', 'n=32'), { responseType: 'arraybuffer' }), 'arraybuffer');` },

    { group: 'response', title: 'charset 覆盖响应头：解 GBK 页面（1688 场景）', desc: '响应头错写 utf-8 时，用 charset 覆盖才能解出中文', code:
`await (async () => {
  var bad = await api.get(apiUrl('gbk-wrongct'), { responseType: 'text' });
  var fixed = await api.get(apiUrl('gbk-wrongct'), { responseType: 'text', charset: 'gbk' });
  console.log('默认（响应头说 utf-8）→', bad.data.slice(0, 26));
  console.log('text + charset:gbk →', fixed.data.slice(0, 26));
  show(fixed, 'GBK 正确解码');
})();` },

    { group: 'response', title: 'document：HTML → Document', desc: '用 DOMParser 解析（无 DOMParser 环境降级为字符串）', code:
`show(await api.get(apiUrl('html'), { responseType: 'document' }), 'document/html');` },

    { group: 'response', title: 'document：XML → Document', desc: '按 content-type 选 mime', code:
`show(await api.get(apiUrl('xml'), { responseType: 'document' }), 'document/xml');` },

    { group: 'response', title: 'charset 自动从 content-type 提取', desc: 'GBK 字节用 TextDecoder 解码', code:
`show(await api.get(apiUrl('gbk'), { responseType: 'text' }), 'GBK 自动识别');` },

    { group: 'response', title: 'charset 显式指定优先于响应头', desc: '强制按 utf-8 解 GBK 字节 → 乱码对照', code:
`show(await api.get(apiUrl('gbk'), { responseType: 'text', charset: 'utf-8' }), '强制 utf-8');` },

    { group: 'response', title: '空响应体（200）', desc: 'data 为空字符串', code:
`show(await api.get(apiUrl('empty')), '空体');` },

    { group: 'response', title: '204 无响应体', desc: 'WHATWG 限制由 createResponse 兜住', code:
`show(await api.get(apiUrl('204')), '204');` },

    { group: 'response', title: '304 无响应体', desc: '同样走 BODYLESS_STATUS 白名单', code:
`await grab(api.get(apiUrl('304'), { cache: 'no-store' }), '304');` },

    { group: 'response', title: '未知 responseType 降级为 auto', desc: '白名单外的值不会报错', code:
`show(await api.get(apiUrl('json'), { responseType: 'whatever' }), '未知类型→auto');` },

    { group: 'response', title: 'raw 模式：原生句柄的唯一入口', desc: 'data 就是未消费的 Response，body 流从 data.body 取', code:
`await (async () => {
  var r = await api.get(apiUrl('json'), { responseType: 'raw' });
  console.log('data instanceof Response →', r.data instanceof Response);
  console.log('data.bodyUsed =', r.data.bodyUsed, '| data.body 是流 →', typeof r.data.body.getReader === 'function');
  console.log('对外字段 =', Object.keys(r), '（固定 5 字段，无 raw / Response）');
  console.log('data.url =', r.data.url, '| redirected =', r.data.redirected);
  await r.data.body.cancel();
  show(r, 'raw');
})();` },

    { group: 'response', title: '重定向：raw 拿最终 URL，双引擎一致（对齐 msw）', desc: 'xhr.responseURL 已透传进 WHATWG Response', code:
`await (async () => {
  var u = apiUrl('redirect', 'n=2');
  var f = await api.get(u, { engine: 'fetch', responseType: 'raw' });
  var x = await api.get(u, { engine: 'xhr', responseType: 'raw' });
  console.log('fetch →', f.data.url, '| redirected =', f.data.redirected);
  console.log('xhr   →', x.data.url, '| redirected =', x.data.redirected);
  console.log('一致 →', f.data.url === x.data.url && f.data.redirected === x.data.redirected);
  await Promise.all([f.data.body.cancel(), x.data.body.cancel()]);
})();` },

    { group: 'response', title: 'onlyData + resolveStatus 正交', desc: '两者互不影响', code:
`show(await api.get(apiUrl('status', 'code=429'), { onlyData: true, resolveStatus: [200, 429] }), '组合');` },

    /* ==================== ⑥ resolveStatus 与错误响应 ==================== */
    { group: 'status', title: '规则：数字精确匹配', desc: '命中才 resolve', code:
`await grab(api.get(apiUrl('status', 'code=429'), { resolveStatus: 200 }), '数字规则');` },

    { group: 'status', title: '规则：数组=若干单一码', desc: '[200, 429] 表示「200 或 429」，不是区间', code:
`show(await api.get(apiUrl('status', 'code=429'), { resolveStatus: [200, 429] }), '单码数组');` },

    { group: 'status', title: '规则：区间 [[200, 300]] 左闭右开', desc: '299 命中，300 不命中', code:
`console.log('299 →', (await grab(api.get(apiUrl('status', 'code=299'), { resolveStatus: [[200, 300]] }))).status,
  '| 300 →', (await grab(api.get(apiUrl('status', 'code=300'), { resolveStatus: [[200, 300]] }))).code);` },

    { group: 'status', title: '规则：混合数字 / 区间 / 函数', desc: '数组内任一项命中即可；区间项是一层数组 [min,max]', code:
`show(await api.get(apiUrl('status', 'code=418'), { resolveStatus: [200, [400, 500], function (s) { return s === 599; }] }), '混合规则');` },

    { group: 'status', title: '规则：函数 (status, response) => boolean', desc: '第二个参数是完整 BxfResponse', code:
`show(await api.get(apiUrl('status', 'code=429'), { resolveStatus: function (s, r) { console.log('函数收到', s, r.status, r.data.message); return s === 429; } }), '函数规则');` },

    { group: 'status', title: '非法规则 → ERR_BAD_OPTION_VALUE', desc: '字符串 / 对象 / null 之外的类型不允许', code:
`await grab(api.get(apiUrl('json'), { resolveStatus: '200' }), '非法规则');` },

    { group: 'status', title: 'null / 不传 = 只要有响应就 resolve', desc: '包括 429 / 502', code:
`show(await api.get(apiUrl('status', 'code=502'), { resolveStatus: null }), 'null 规则');` },

    { group: 'status', title: 'err.response（小写）是整包 BxfResponse', desc: '业务体不丢；err.status 是顶层副本', code:
`await (async () => {
  var e = await api.get(apiUrl('status', 'code=429'), { resolveStatus: 200 }).catch(function (x) { return x; });
  console.log('code =', e.code, '| err.status =', e.status, '| err.response.status =', e.response.status);
  console.log('err.response.data =', e.response.data);
  console.log('err.config === err.response.config →', e.config === e.response.config);
  console.log('err.response 字段 =', Object.keys(e.response));
  console.log('是否暴露原生句柄 →', 'Response' in e.response);
})();` },

    { group: 'status', title: '对外不暴露原生 Response 句柄', desc: 'BxfResponse 固定 5 字段；需要原生句柄请用 raw', code:
`await (async () => {
  var r = await api.get(apiUrl('json'));
  console.log('Object.keys(res) =', Object.keys(r));
  console.log('是否暴露原生句柄 →', 'Response' in r);
  var raw = await api.get(apiUrl('json'), { responseType: 'raw' });
  console.log('raw.data instanceof Response →', raw.data instanceof Response);
  var c = raw.data.clone();
  console.log('clone().url =', c.url, '（url 会随 clone 转发）');
  await Promise.all([raw.data.body.cancel(), c.body.cancel()]);
})();` },

    { group: 'status', title: '失败时 err.response 与成功 res 完全同形', desc: '都是 5 字段 BxfResponse，无大小写嵌套', code:
`await grab(api.get(apiUrl('status', 'code=500'), { resolveStatus: [[200, 300]] }), '500 被拒');` },

    /* ==================== ⑦ 引擎与能力矩阵 ==================== */
    { group: 'engine', title: '显式 engine: "fetch"', desc: 'meta.engine 看实际生效引擎', code:
`meta(show(await api.get(apiUrl('json'), { engine: 'fetch' }), 'fetch'));` },

    { group: 'engine', title: '显式 engine: "xhr"', desc: 'XHR 结果被构造成等价的 WHATWG Response', code:
`meta(show(await api.get(apiUrl('json'), { engine: 'xhr' }), 'xhr'));` },

    { group: 'engine', title: '未指定引擎 → fetch 优先', desc: '两者都支持时默认 fetch', code:
`meta(await api.get(apiUrl('json')));` },

    { group: 'engine', title: '双引擎同参数对照', desc: '字段集合、status、data 类型应完全一致', code:
`await cmp({ url: apiUrl('json') }, 'json');` },

    { group: 'engine', title: '双引擎对照：中文 / 重复头 / 二进制', desc: '一次看三类容易不一致的场景', code:
`await cmp({ url: apiUrl('multiheader'), responseType: 'arraybuffer' }, 'binary+headers');` },

    { group: 'engine', title: 'responseType:"stream" 自动切到 fetch', desc: '未指定引擎时按能力挑选', code:
`meta(await api.get(apiUrl('sse', 'n=2&ms=60'), { responseType: 'stream' }));` },

    { group: 'engine', title: '进度回调自动切到 XHR', desc: '只要传了 onUpload/OnDownloadProgress', code:
`meta(await api.get(apiUrl('large', 'kb=16&chunks=2&ms=10'), { onDownloadProgress: function () {} }));` },

    { group: 'engine', title: '能力互斥且未指定引擎 → ERR_UNSUPPORTED', desc: 'stream 只有 fetch、进度只有 XHR，无法自动选', code:
`await grab(api.get(apiUrl('sse', 'n=2&ms=20'), { responseType: 'stream', onDownloadProgress: function () {} }), '能力冲突');` },

    { group: 'engine', title: '显式 fetch + 进度 → ERR_UNSUPPORTED', desc: '不偷偷换引擎', code:
`await grab(api.get(apiUrl('large', 'kb=16&chunks=2&ms=10'), { engine: 'fetch', onDownloadProgress: function () {} }), 'fetch 不支持进度');` },

    { group: 'engine', title: '显式 XHR + stream → ERR_UNSUPPORTED', desc: '同上', code:
`await grab(api.get(apiUrl('sse', 'n=2&ms=20'), { engine: 'xhr', responseType: 'stream' }), 'XHR 不支持 stream');` },

    { group: 'engine', title: 'engine 传全局 fetch 函数', desc: '按函数名识别为 fetch 引擎', code:
`show(await api.get(apiUrl('json'), { engine: window.fetch }), '传全局 fetch');` },

    { group: 'engine', title: 'nativeEngine: true 取 iframe 原生 API', desc: 'MV3 核心能力：绕过网页对 fetch 的 hook', code:
`await grab(api.get(apiUrl('json'), { nativeEngine: true }), 'iframe 原生 fetch');` },

    { group: 'engine', title: '自定义函数引擎（返回标准 Response）', desc: '自定义引擎仍走同一套统一解析层', code:
`await grab(api({ url: apiUrl('json'), engine: async function (spec, request) {
  return new Response(JSON.stringify({ custom: true, method: request.method }),
    { status: 200, headers: { 'content-type': 'application/json' } });
} }), '自定义引擎');` },

    { group: 'engine', title: 'XHR 不支持的一等公民能力会 warn', desc: 'mode/cache/referrer 等被忽略而不是静默，看控制台警告', code:
`show(await api.get(apiUrl('json'), { engine: 'xhr', mode: 'cors', cache: 'no-store', keepalive: true }), 'XHR 能力 warn');` },

    /* ==================== ⑧ 上传 / 下载进度 ==================== */
    { group: 'progress', title: 'onDownloadProgress', desc: '自动切到 XHR，事件对象原生 ProgressEvent', code:
`show(await api.get(apiUrl('large', 'kb=64&chunks=8&ms=40'), {
  onDownloadProgress: function (e) { if (e.lengthComputable) console.log('下载', e.loaded + '/' + e.total); }
}), '下载进度');` },

    { group: 'progress', title: 'onUploadProgress', desc: 'POST 一个较大的 body 才看得到分片', code:
`show(await api.post(apiUrl('upload'), 'x'.repeat(128 * 1024), {
  onUploadProgress: function (e) { if (e.lengthComputable) console.log('上传', e.loaded + '/' + e.total); }
}), '上传进度');` },

    { group: 'progress', title: '两个进度回调同时用', desc: '都属于 XHR 专属能力', code:
`meta(await api.post(apiUrl('upload'), 'y'.repeat(64 * 1024), {
  onUploadProgress: function (e) { console.log('↑', e.loaded); },
  onDownloadProgress: function (e) { console.log('↓', e.loaded); }
}));` },

    { group: 'progress', title: '进度能力 + 显式 engine: "xhr"', desc: '显式指定且能力匹配时正常执行', code:
`show(await api.get(apiUrl('large', 'kb=16&chunks=2&ms=10'), { engine: 'xhr', onDownloadProgress: function (e) { console.log('progress', e.loaded); } }), '显式 XHR 进度');` },

    { group: 'progress', title: '进度回调与 resolveStatus 组合', desc: '进度不影响状态码判定', code:
`await grab(api.get(apiUrl('status', 'code=429'), { resolveStatus: 200, onDownloadProgress: function () {} }), '进度 + 状态拒绝');` },

    /* ==================== ⑨ 流式与流中转 ==================== */
    { group: 'stream', title: 'responseType: "stream" 按帧读取', desc: '无 onStream 时 data 是完整帧原文数组（含注释帧 / 尾帧）', code:
`show(await api.get(apiUrl('sse', 'n=3&ms=80'), { responseType: 'stream' }), 'SSE 帧');` },

    { group: 'stream', title: 'onStream 一帧一回调 + 二选一', desc: '有回调时只回调不累积，res.data 恒为 []', code:
`await (async () => {
  var frames = [];
  var r = await api.get(apiUrl('sse', 'n=4&ms=100'), {
    responseType: 'stream',
    onStream: function (frame) { frames.push(frame); console.log('frame →', frame.slice(0, 48)); }
  });
  console.log('有回调时 res.data =', r.data, '| 自己收到', frames.length, '帧');
  show(r, 'onStream');
})();` },

    { group: 'stream', title: 'stream 必须走 fetch（自动选择）', desc: 'meta.engine 应为 fetch', code:
`meta(await api.get(apiUrl('sse', 'n=2&ms=40'), { responseType: 'stream' }));` },

    { group: 'stream', title: 'raw 模式自己读 reader', desc: '不消费响应体，完全由调用方掌控', code:
`await (async () => {
  var r = await api.get(apiUrl('slowchunks', 'n=6&ms=100'), { responseType: 'raw' });
  var reader = r.data.body.getReader(), dec = new TextDecoder(), text = '';
  for (;;) { var x = await reader.read(); if (x.done) break; text += dec.decode(x.value, { stream: true }); }
  console.log('自行读取完成：', text.trim());
})();` },

    { group: 'stream', title: '代理下载：边下边传', desc: '把响应流直接接到上传请求体，不落盘不缓冲', code:
`await (async () => {
  var r = await api.get(apiUrl('slowchunks', 'n=6&ms=80'), { responseType: 'raw' });
  var up = await fetch(apiUrl('upload'), { method: 'POST', body: r.data.body, duplex: 'half' });
  show(await up.json(), '上传回显');
})();` },

    { group: 'stream', title: 'raw + timeout：长流不被掐断', desc: 'timeout 只覆盖到「引擎交出响应」为止', code:
`await (async () => {
  var r = await api.get(apiUrl('slowchunks', 'n=8&ms=120'), { responseType: 'raw', timeout: 200 });
  var text = await r.data.text();
  console.log('拿到响应头后仍能读完整个流，字节数 =', text.length);
})();` },

    { group: 'stream', title: 'stream + timeout 会覆盖整个读取过程', desc: '需要读完流才交出响应，因此可能 ETIMEDOUT', code:
`await grab(api.get(apiUrl('sse', 'n=8&ms=120'), { responseType: 'stream', timeout: 200 }), 'stream 超时');` },

    /* ==================== ⑩ 超时与取消 ==================== */
    { group: 'cancel', title: 'timeout 命中 → ETIMEDOUT', desc: '服务端延迟 600ms，客户端只给 120ms', code:
`await grab(api.get(apiUrl('delay', 'ms=600'), { timeout: 120 }), '超时');` },

    { group: 'cancel', title: 'timeout 未命中正常返回', desc: '可清除的 setTimeout，不会留下悬挂定时器', code:
`show(await api.get(apiUrl('delay', 'ms=80'), { timeout: 2000 }), '未超时');` },

    { group: 'cancel', title: 'signal + AbortController → ERR_CANCELED', desc: '主动取消', code:
`await (async () => {
  var c = new AbortController();
  var p = api.get(apiUrl('delay', 'ms=800'), { signal: c.signal });
  c.abort();
  await grab(p, '主动取消');
})();` },

    { group: 'cancel', title: '延迟取消（已经发出去的请求）', desc: 'sleep 后再 abort', code:
`await (async () => {
  var c = new AbortController();
  var p = api.get(apiUrl('delay', 'ms=800'), { signal: c.signal });
  await sleep(100); c.abort();
  await grab(p, '延迟取消');
})();` },

    { group: 'cancel', title: 'AbortSignal.timeout 作为外部 signal', desc: 'reason.name=TimeoutError → 映射 ETIMEDOUT', code:
`await grab(api.get(apiUrl('delay', 'ms=600'), { signal: AbortSignal.timeout(120) }), '外部超时信号');` },

    { group: 'cancel', title: 'timeout 与 signal 合并取最先触发者', desc: 'anySignal 透传触发源的 reason', code:
`await (async () => {
  var c = new AbortController();
  var p = api.get(apiUrl('delay', 'ms=800'), { timeout: 3000, signal: c.signal });
  await sleep(100); c.abort();
  await grab(p, '合并信号');
})();` },

    /* ==================== ⑪ 拦截器与前置钩子 ==================== */
    { group: 'hooks', title: 'request 拦截器加请求头', desc: '收到的是 RequestSpec，改 spec.headers 生效', code:
`await (async () => {
  var x = instance({});
  x.interceptors.request.use(function (spec) { spec.headers['x-demo'] = 'from-request'; return spec; });
  show(await x.get(apiUrl('echo')), 'request.use');
})();` },

    { group: 'hooks', title: 'request 拦截器「后添加先执行」', desc: '栈顺序，打印执行次序', code:
`await (async () => {
  var x = instance({}), order = [];
  x.interceptors.request.use(function (s) { order.push('A'); return s; });
  x.interceptors.request.use(function (s) { order.push('B'); return s; });
  await x.get(apiUrl('json'));
  console.log('执行顺序 →', order.join(' → '), '（应为 B → A）');
})();` },

    { group: 'hooks', title: 'response 拦截器改写 data', desc: 'resolveStatus / onlyData 在其之后仍生效', code:
`await (async () => {
  var x = instance({});
  x.interceptors.response.use(function (r) { r.data = Object.assign({}, r.data, { intercepted: true }); return r; });
  show(await x.get(apiUrl('json')), 'response.use');
})();` },

    { group: 'hooks', title: 'response 拦截器「先添加先执行」', desc: '队列顺序', code:
`await (async () => {
  var x = instance({}), order = [];
  x.interceptors.response.use(function (r) { order.push('A'); return r; });
  x.interceptors.response.use(function (r) { order.push('B'); return r; });
  await x.get(apiUrl('json'));
  console.log('执行顺序 →', order.join(' → '), '（应为 A → B）');
})();` },

    { group: 'hooks', title: 'rejected 处理器捕获错误', desc: 'x.interceptors.response.use(null, fn)', code:
`await (async () => {
  var x = instance({});
  x.interceptors.response.use(null, function (err) { console.log('拦截到错误 →', err.code); throw err; });
  await grab(x.get('http://127.0.0.1:1/nope'), 'rejected handler');
})();` },

    { group: 'hooks', title: 'eject / clear 移除拦截器', desc: 'use 返回索引 id', code:
`await (async () => {
  var x = instance({});
  var id = x.interceptors.request.use(function (s) { s.headers['x-temp'] = '1'; return s; });
  console.log('第一次 headers.x-temp =', (await x.get(apiUrl('echo'))).data.headers['x-temp']);
  x.interceptors.request.eject(id);
  console.log('eject 后 headers.x-temp =', (await x.get(apiUrl('echo'))).data.headers['x-temp']);
  x.interceptors.request.clear();
})();` },

    { group: 'hooks', title: 'beforeInterceptors 返回 false 终止', desc: 'BEFORE_TERMINATE，请求不会发出', code:
`await grab(api({ url: apiUrl('json'), beforeInterceptors: function (spec) {
  console.log('before 收到 spec:', spec.method, spec.url);
  return false;
} }), 'BEFORE_TERMINATE');` },

    { group: 'hooks', title: 'beforeInterceptors 返回 Promise', desc: '支持异步前置（例如先取 token）', code:
`show(await api({ url: apiUrl('echo'), beforeInterceptors: async function (spec) {
  spec.headers['x-async'] = 'ready';
  return true;
} }), '异步前置');` },

    { group: 'hooks', title: '响应拦截器替换对象后仍补挂元数据', desc: '展开对象仍保留 engine 元数据', code:
`await (async () => {
  var x = instance({});
  x.interceptors.response.use(function (r) { return Object.assign({}, r); });
  meta(await x.get(apiUrl('json')));
})();` },

    /* ==================== ⑫ 配置快照与重放 ==================== */
    { group: 'replay', title: '成功响应 res.config 可直接回喂', desc: '扁平纯数据，url 未拼接、data 未编码', code:
`await (async () => {
  var r = await api.get(apiUrl('json'), { headers: { 'X-A': '1' } });
  console.log('config =', r.config);
  show(await api(r.config), '回喂 config');
})();` },

    { group: 'replay', title: '失败响应 err.config 同样可回喂', desc: 'token 过期重试的前提', code:
`await (async () => {
  var e = await api.get(apiUrl('status', 'code=401'), { resolveStatus: 200 }).catch(function (x) { return x; });
  console.log('err.config =', e.config);
  show(await api(Object.assign({}, e.config, { resolveStatus: 401 })), '失败后重放');
})();` },

    { group: 'replay', title: '模拟 token 过期重试（完整流程）', desc: '库不自动重放，由你的代码决定何时再发', code:
`await (async () => {
  var token = 'expired';
  var cfg = { url: apiUrl('echo'), headers: { Authorization: 'Bearer ' + token } };
  var e = await api(cfg).then(null, function (x) { return x; });
  console.log('首次结果 →', e.status, e.data.headers.authorization);
  // 业务判断：401 就刷新 token 后用同一份 config 再发一次
  var r = await api(Object.assign({}, cfg, { headers: { Authorization: 'Bearer fresh' } }));
  console.log('重放后 Authorization →', r.data.headers.authorization);
})();` },

    { group: 'replay', title: '同一份 config 换参数再发一次', desc: '重放完全由调用方发起，库不提供 retry() 糖', code:
`await (async () => {
  var r = await api.get(apiUrl('json'), { responseType: 'text' });
  console.log('第一次 data 类型 =', typeOf(r.data));
  var r2 = await api(Object.assign({}, r.config, { responseType: 'auto' }));
  console.log('重放后 data 类型 =', typeOf(r2.data), '| config.url =', r2.config.url);
})();` },

    { group: 'replay', title: '响应不再挂 raw / retry / retryCount', desc: '唯一不可枚举元数据是 engine', code:
`await (async () => {
  var r = await api.get(apiUrl('json'));
  console.log('Object.keys(res) =', Object.keys(r));
  console.log('raw / retry / retryCount 存在 →', 'raw' in r, typeof r.retry, r.retryCount);
  console.log('engine =', r.engine, '| 可枚举 =', Object.keys(r).includes('engine'));
  var e = await api.get(apiUrl('status', 'code=429'), { resolveStatus: 200 }).catch(function (x) { return x; });
  console.log('err.engine =', e.engine, '| err.retry =', e.retry);
})();` },

    { group: 'replay', title: '失败后用 err.config 手动重放', desc: '何时重试、重试几次全由业务代码决定', code:
`await (async () => {
  var e = await api.get(apiUrl('status', 'code=429'), { resolveStatus: 200 }).catch(function (x) { return x; });
  var r = await api(Object.assign({}, e.config, { resolveStatus: 429 }));
  console.log('重放 status =', r.status, '| engine =', r.engine);
  show(r, '手动重放');
})();` },

    { group: 'replay', title: 'config 可 JSON.stringify / postMessage', desc: '不含 signal / cleanup / 函数等运行态', code:
`await (async () => {
  var r = await api.get(apiUrl('json'), { params: { a: 1 }, timeout: 1000 });
  console.log('JSON →', JSON.stringify(r.config));
  console.log('是否含 signal →', 'signal' in r.config, '| 是否含 cleanup →', 'cleanup' in r.config);
})();` },

    { group: 'replay', title: '元数据不可枚举，不污染 Object.keys', desc: 'engine 隐藏；JSON 里只含固定 5 字段', code:
`await (async () => {
  var r = await api.get(apiUrl('json'));
  console.log('Object.keys(res) =', Object.keys(r));
  console.log('JSON.stringify 里的键 =', Object.keys(JSON.parse(JSON.stringify(r))));
})();` },

    /* ==================== ⑬ 一等公民与逃生舱 ==================== */
    { group: 'advanced', title: 'fetchOptions 透传非保护字段', desc: '如 priority；核心字段 method/headers/body 不可覆盖', code:
`show(await api.get(apiUrl('json'), { fetchOptions: { priority: 'high', method: 'DELETE' } }), 'fetchOptions');` },

    { group: 'advanced', title: 'xhrOptions 透传自定义属性', desc: '保护键（timeout/withCredentials/...）会被跳过', code:
`show(await api.get(apiUrl('json'), { engine: 'xhr', xhrOptions: { labFlag: 'hello', responseType: 'text' } }), 'xhrOptions');` },

    { group: 'advanced', title: 'rawFields 按最终引擎分流', desc: 'fetch 分流到 fetchOptions，XHR 分流到 xhrOptions', code:
`await cmp({ url: apiUrl('json'), rawFields: { labRaw: 1 } }, 'rawFields');` },

    { group: 'advanced', title: 'mode: "cors" / "no-cors" 对照', desc: 'no-cors 会得到 opaque 响应（status 0）', code:
`console.log('cors →', (await api.get(apiUrl('json'), { mode: 'cors' })).status,
  '| no-cors →', (await api.get(apiUrl('json'), { mode: 'no-cors' })).status);` },

    { group: 'advanced', title: 'redirect: "follow" 默认跟随', desc: '302 链走到最终 JSON', code:
`show(await api.get(apiUrl('redirect', 'n=2')), 'follow');` },

    { group: 'advanced', title: 'redirect: "manual" 拿到 opaqueredirect', desc: '浏览器返回 status 0 的 opaque 响应', code:
`await grab(api.get(apiUrl('redirect', 'n=1'), { redirect: 'manual' }), 'manual redirect');` },

    { group: 'advanced', title: 'cache / referrerPolicy / keepalive', desc: '一等公民能力，直接透传到 RequestInit', code:
`show(await api.get(apiUrl('json'), { cache: 'no-store', referrerPolicy: 'no-referrer', keepalive: true }), '一等公民');` },

    { group: 'advanced', title: 'integrity 不匹配会导致请求失败', desc: 'SRI 校验由浏览器执行', code:
`await grab(api.get(apiUrl('json'), { integrity: 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }), 'SRI 不匹配');` },

    { group: 'advanced', title: 'credentials: "omit" / "same-origin" / "include"', desc: '三种取值都能跑通', code:
`await (async () => {
  for (var c of ['omit', 'same-origin', 'include']) {
    console.log(c, '→', (await api.get(apiUrl('echo'), { credentials: c })).status);
  }
})();` },

    { group: 'advanced', title: 'responseType + charset + resolveStatus 组合', desc: '多参数叠加互不干扰', code:
`show(await api.get(apiUrl('gbk'), { responseType: 'text', charset: 'gbk', resolveStatus: 200, onlyData: false }), '组合');` },

    /* ==================== ⑭ 错误码全景 ==================== */
    { group: 'errors', title: '错误码速查表', desc: '全部 BxfError.code', code:
`console.table(BXF_CODES);` },

    { group: 'errors', title: 'ERR_NETWORK：断网 / 端口不通 / 跨域被拦', desc: 'causeName=TypeError', code:
`await grab(api.get('http://127.0.0.1:1/nope'), 'ERR_NETWORK');` },

    { group: 'errors', title: 'ETIMEDOUT：超时', desc: '可清除定时器触发', code:
`await grab(api.get(apiUrl('delay', 'ms=500'), { timeout: 100 }), 'ETIMEDOUT');` },

    { group: 'errors', title: 'ERR_CANCELED：主动取消', desc: 'AbortController.abort()', code:
`await (async () => { var c = new AbortController(); var p = api.get(apiUrl('delay', 'ms=500'), { signal: c.signal }); c.abort(); await grab(p, 'ERR_CANCELED'); })();` },

    { group: 'errors', title: 'ERR_HTTP_STATUS：状态码被拒', desc: '唯一会带 err.response 的常见错误', code:
`await grab(api.get(apiUrl('status', 'code=503'), { resolveStatus: [[200, 300]] }), 'ERR_HTTP_STATUS');` },

    { group: 'errors', title: 'ERR_UNSUPPORTED：能力不匹配', desc: '显式引擎与所需能力冲突', code:
`await grab(api.get(apiUrl('sse', 'n=2&ms=20'), { engine: 'xhr', responseType: 'stream' }), 'ERR_UNSUPPORTED');` },

    { group: 'errors', title: 'ERR_BAD_OPTION_VALUE：配置类型非法', desc: 'resolveStatus 传字符串', code:
`await grab(api.get(apiUrl('json'), { resolveStatus: {} }), 'ERR_BAD_OPTION_VALUE');` },

    { group: 'errors', title: 'BEFORE_TERMINATE：前置钩子终止', desc: 'beforeInterceptors 返回 false', code:
`await grab(api({ url: apiUrl('json'), beforeInterceptors: function () { return false; } }), 'BEFORE_TERMINATE');` },

    { group: 'errors', title: 'ERR_INVALID_URL：URL 无法构造 Request', desc: 'catch 后统一包装', code:
`await grab(api({ url: 'http://[' }), 'ERR_INVALID_URL');` },

    { group: 'errors', title: '统一取值写法（有无响应都能安全读）', desc: 'err.response 存在与否先判断；配置数组串行发起，避免未处理的 Promise', code:
`await (async () => {
  var configs = [
    { url: apiUrl('status', 'code=429'), resolveStatus: 200 },
    { url: 'http://127.0.0.1:1/nope' },
  ];
  for (var cfg of configs) {
    try { var r = await api(cfg); console.log('resolve:', r.status, r.data); }
    catch (e) {
      console.log('reject:', e.code,
        '| status =', e.response ? e.response.status : undefined,
        '| data =', e.response ? e.response.data : undefined,
        '| config 可回喂 =', !!e.config);
    }
  }
})();` },
];

export default CASES;
