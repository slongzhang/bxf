/**
 * BxfResponse 契约与原生句柄入口（可运行示例）
 *
 * 运行：
 *   node --experimental-default-type=module examples/response-access.mjs
 *
 * 契约只有两条：
 *   1. BxfResponse 固定 7 字段 {data, status, statusText, headers, config,
 *      responseURL, redirected}，成功侧 res 与失败侧 err.response 完全同形；
 *      不暴露原生 Response 句柄，也不再输出解析前的 raw 中间产物。
 *      唯一不可枚举元数据是 engine。
 *      responseURL 是跟随重定向后的最终地址；response.url 为空时（自定义引擎
 *      手工 new Response()、opaque response）回退到绝对化的 request.url，
 *      redirected 明确为 false。config.url 则是用户原始入参，三者不可混用。
 *   2. 确实需要原生 WHATWG Response 时指定 responseType:'raw'，
 *      此时 data 就是未消费的原生句柄，body 流从 data.body 取。
 *      XHR 适配器已按 @mswjs/interceptors 方案补齐 url / redirected。
 *
 * 五个场景：
 *   1. 成功请求                -> 7 字段，无 raw / Response 字段
 *   2. 状态码被 resolveStatus 拒绝 -> err.response 是同形的 7 字段 BxfResponse
 *   3. 网络层失败              -> err.response 不存在（根本没拿到 HTTP 响应）
 *   4. raw 模式                -> data 是原生 Response；重定向 url / clone / 流中转
 *   5. 统一取值写法            -> 有无响应都能安全读
 */
import http from 'node:http';
import { createClient } from '../src/core/createClient.js';

/* ---------------- 本地测试服务 ---------------- */
const routes = {
    '/user': (res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, name: '张三' }));
    },
    '/rate-limited': (res) => {
        res.writeHead(429, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code: 429, message: 'too many requests' }));
    },
    '/redirect': (res) => {
        res.writeHead(302, { location: '/final' });
        res.end();
    },
    '/final': (res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ landed: true }));
    },
};

const server = http.createServer((req, res) => {
    const path = req.url.split('?')[0];
    (routes[path] || ((r) => { r.writeHead(404); r.end(); }))(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;
const bxf = createClient({ baseURL });

const line = (t) => console.log(`\n${'─'.repeat(8)} ${t} ${'─'.repeat(8)}`);
const FIELDS = [
    'data', 'status', 'statusText', 'headers', 'config', 'responseURL', 'redirected',
];

/* ================= 场景 1：成功 ================= */
line('场景 1｜请求成功 → BxfResponse 固定 7 字段');
{
    const res = await bxf.get('/user');

    console.log('Object.keys(res) =', Object.keys(res));
    console.log('与契约一致        =', JSON.stringify(Object.keys(res)) === JSON.stringify(FIELDS));
    console.log('是否暴露 Response 字段 =', 'Response' in res);
    console.log('是否还有 raw 字段      =', 'raw' in res);
    console.log('res.data          =', res.data);   // 已解析的业务数据
    console.log('res.status        =', res.status);
    console.log('res.engine        =', res.engine, '（不可枚举元数据）');
    console.log('res.config.url    =', res.config.url, '（原始入参）');
    console.log('res.responseURL   =', res.responseURL, '（最终实际请求地址）');
    console.log('res.redirected    =', res.redirected);
}

/* ================= 场景 2：被状态码规则拒绝 ================= */
line('场景 2｜429 被 resolveStatus 拒绝 → err.response');
{
    const err = await bxf({ url: '/rate-limited', resolveStatus: [[200, 300]] })
        .then(() => { throw new Error('本应被拒绝'); })
        .catch((e) => e);

    console.log('err.code       =', err.code);        // ERR_HTTP_STATUS
    console.log('err.status     =', err.status);      // 429
    console.log('err.response 的键 =', Object.keys(err.response));
    console.log('与成功响应同形 =', JSON.stringify(Object.keys(err.response)) === JSON.stringify(FIELDS));
    console.log('err.response.data   =', err.response.data);      // 业务体仍可读
    console.log('err.response.status =', err.response.status);
    console.log('err.response.responseURL =', err.response.responseURL, '| redirected =', err.response.redirected);
    console.log('是否暴露原生句柄   =', 'Response' in err.response);
    console.log('err.config === err.response.config =', err.config === err.response.config);
    console.log('err.retry / err.retryCount =', err.retry, err.retryCount, '（均已移除）');
}

/* ================= 场景 3：网络层失败 ================= */
line('场景 3｜网络层失败 → 没有 err.response');
{
    const err = await bxf.get('http://127.0.0.1:1/nope').catch((e) => e);

    console.log('err.code        =', err.code);       // ERR_NETWORK
    console.log('err.status      =', err.status);     // undefined
    console.log('err.response    =', err.response);   // undefined
    console.log('err.config.url  =', err.config.url); // config 仍然在，可回喂
}

/* ================= 场景 4：raw 模式 ================= */
line('场景 4｜responseType:"raw" → data 是唯一的原生句柄入口');
{
    const res = await bxf.get('/redirect', { responseType: 'raw' });

    console.log('res.data instanceof Response =', res.data instanceof Response);
    console.log('res.data.bodyUsed            =', res.data.bodyUsed);   // false
    console.log('data.body 是 ReadableStream   =', typeof res.data.body.getReader === 'function');
    console.log('res.data.url                 =', res.data.url);        // 重定向后的最终地址
    console.log('res.data.redirected          =', res.data.redirected); // true
    console.log('顶层 res.responseURL         =', res.responseURL);      // 与 data.url 一致
    console.log('顶层 res.redirected          =', res.redirected);       // 无需 raw 即可读

    // clone 之后 url 仍然保留（对齐 msw FetchResponse.clone 的转发逻辑）
    const clone = res.data.clone();
    console.log('clone().url                  =', clone.url);
    console.log('clone().redirected           =', clone.redirected);
    // tee 出来的两个分支都要消费/释放
    const [a, b] = await Promise.all([res.data.arrayBuffer(), clone.arrayBuffer()]);
    console.log('两个分支都能读               =', a.byteLength === b.byteLength);

    // 代理下载 / 边下边传：直接把 data.body 当作下一次 fetch 的 body
    const plain = await bxf.get('/user', { responseType: 'raw' });
    const text = await new Response(plain.data.body).text();
    console.log('自行读取的响应体             =', text);
}

/* ================= 场景 5：统一取值写法 ================= */
line('场景 5｜统一取值｜有无响应都能安全读');
{
    const grab = async (cfg) => {
        try {
            const res = await bxf(cfg);
            return { kind: 'resolve', status: res.status, data: res.data };
        } catch (err) {
            // 有 err.response 说明拿到了 HTTP 响应（业务/状态码层面失败）
            // 没有则说明是网络层失败
            return {
                kind: 'reject',
                code: err.code,
                status: err.response ? err.response.status : undefined,
                data: err.response ? err.response.data : undefined,
            };
        }
    };

    console.log('成功     ->', await grab({ url: '/user' }));
    console.log('状态拒绝 ->', await grab({ url: '/rate-limited', resolveStatus: [[200, 300]] }));
    console.log('网络失败 ->', await grab({ url: 'http://127.0.0.1:1/nope' }));
}

server.close();
