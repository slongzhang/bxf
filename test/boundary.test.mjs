/**
 * 边界与回归测试（第三轮全量源码梳理新增）。
 *
 * 运行：
 *   node --experimental-default-type=module test/boundary.test.mjs
 *
 * 全部用纯函数 / 自定义引擎，不依赖本地 HTTP 服务与第三方测试框架。
 * 覆盖：配置形态（Headers / URLSearchParams / 表单数组）、拦截器生命周期、
 * 钩子错误契约、定时器泄漏、错误码可读性。
 */
import assert from 'node:assert/strict';
import { queryEncode } from '../src/utils/queryEncode.js';
import { InterceptorManager } from '../src/interceptors/interceptorManager.js';
import { dispatchWithInterceptors } from '../src/interceptors/dispatchWithInterceptors.js';
import { createClient } from '../src/core/createClient.js';
import { normalizeRequest } from '../src/core/normalizeRequest.js';

const ABS = 'http://127.0.0.1:9/echo';
const jsonRes = (body = '{}') => new Response(body, {
    headers: { 'content-type': 'application/json' },
});
const engineWith = (sink) => async (spec) => { sink(spec); return jsonRes(); };

let passed = 0;
const failures = [];
async function check(name, fn) {
    if (process.env.BXF_VERBOSE) console.error('  →', name);
    try { await fn(); passed++; }
    catch (e) { failures.push(`${name}: ${e.message}`); }
}

/* ============ 1. queryEncode 入参形态 ============ */

await check('params 表单数组 [{name,value}] 正确序列化（原解构崩溃）', () => {
    assert.equal(
        queryEncode([{ name: 'a', value: '1' }, { name: 'b', value: '中文' }]),
        'a=1&b=%E4%B8%AD%E6%96%87',
    );
});

await check('表单数组含 null / 基本类型不再抛 TypeError', () => {
    assert.doesNotThrow(() => queryEncode([{ name: 'a', value: '1' }, null, 3]));
});

await check('queryEncode 直接接收 URLSearchParams 不抛 ERR_INVALID_THIS', () => {
    assert.equal(
        queryEncode(new URLSearchParams({ a: '1', b: '中' })),
        'a=1&b=%E4%B8%AD',
    );
});

await check('普通对象 / 字符串 / 嵌套 params 序列化保持原有语义', () => {
    assert.equal(queryEncode({ a: 1, b: '中' }), 'a=1&b=%E4%B8%AD');
    assert.equal(queryEncode('a=1&b=2'), 'a=1&b=2');
    assert.equal(queryEncode({ n: { x: 1 } }), 'n%5Bx%5D=1');
});

/* ============ 2. 拦截器生命周期 ============ */

await check('response 拦截器 eject 后剩余拦截器仍正常执行（原 null 崩溃）', async () => {
    const im = new InterceptorManager();
    const id = im.use(r => ({ ...r, first: 1 }));
    im.use(r => ({ ...r, second: 2 }));
    im.eject(id);
    const r = await dispatchWithInterceptors(
        { x: 1 }, async c => ({ ...c, ok: true }),
        { request: new InterceptorManager(), response: im },
    );
    assert.equal(r.ok, true);
    assert.equal(r.first, undefined, '被 eject 的拦截器不应执行');
    assert.equal(r.second, 2, '其余拦截器必须继续执行');
});

await check('request 拦截器 eject 后同理不崩溃', async () => {
    const im = new InterceptorManager();
    const id = im.use(c => ({ ...c, dropped: true }));
    im.use(c => ({ ...c, kept: true }));
    im.eject(id);
    const r = await dispatchWithInterceptors(
        { x: 1 }, async c => ({ ...c, ok: true }),
        { request: im, response: new InterceptorManager() },
    );
    assert.equal(r.dropped, undefined);
    assert.equal(r.kept, true);
});

await check('请求拦截器忘记 return config 时给出明确 ERR_BAD_OPTION_VALUE', async () => {
    const api = createClient();
    for (const ret of [undefined, null, 0, 'x']) {
        const inst = createClient();
        inst.interceptors.request.use(() => ret);
        const e = await inst({ url: ABS, engine: engineWith(() => {}) }).catch(x => x);
        assert.equal(e.code, 'ERR_BAD_OPTION_VALUE', `返回值 ${String(ret)} 应明确报错`);
        assert.match(e.message, /return config/);
    }
});

/* ============ 3. beforeInterceptors 契约 ============ */

await check('beforeInterceptors 同步抛错：bxf() 仍返回 Promise 且能 catch', async () => {
    const api = createClient();
    let p;
    assert.doesNotThrow(() => {
        p = api({
            url: ABS,
            beforeInterceptors: () => { throw new Error('boom'); },
            engine: engineWith(() => {}),
        });
    });
    assert.ok(p && typeof p.then === 'function', '必须返回 Promise');
    const e = await p.catch(x => x);
    assert.equal(e.isBxfError, true);
    assert.equal(e.causeName, 'Error');
    assert.equal(e.message, 'boom');
});

await check('beforeInterceptors 返回 rejected Promise：统一为 BxfError', async () => {
    const api = createClient();
    const e = await api({
        url: ABS,
        beforeInterceptors: () => Promise.reject(new Error('rejected hook')),
        engine: engineWith(() => {}),
    }).catch(x => x);
    assert.equal(e.isBxfError, true);
    assert.equal(e.message, 'rejected hook');
});

await check('beforeInterceptors 拒绝 / 终止时 timeout 定时器被清理（无泄漏）', async () => {
    const api = createClient();
    const countTimers = () => process.getActiveResourcesInfo().filter(t => t === 'Timeout').length;
    const before = countTimers();
    // rejected 分支（历史 bug：进程会多挂 timeout 毫秒）
    await api({
        url: ABS, timeout: 5000,
        beforeInterceptors: () => Promise.reject(new Error('x')),
        engine: engineWith(() => {}),
    }).catch(() => {});
    assert.equal(countTimers(), before, 'rejected 分支泄漏了 timeout 定时器');
    // false 分支（Bug C 修复回归）
    await api({
        url: ABS, timeout: 5000,
        beforeInterceptors: () => false,
        engine: engineWith(() => {}),
    }).catch(() => {});
    assert.equal(countTimers(), before, 'false 分支泄漏了 timeout 定时器');
});

await check('beforeInterceptors 返回 thenable / true / undefined 都继续执行', async () => {
    const api = createClient();
    const thenable = { then: (res) => res(true) };
    for (const ret of [true, undefined, thenable]) {
        const r = await api({
            url: ABS, beforeInterceptors: () => ret,
            engine: engineWith(() => {}),
        });
        assert.equal(r.status, 200);
    }
});

/* ============ 4. 配置形态（headers / params / xsrf） ============ */

await check('headers 传 WHATWG Headers 实例不再被静默丢弃', async () => {
    let seen = null;
    const api = createClient();
    await api({ url: ABS, headers: new Headers({ 'X-From-Headers': 'yes' }), engine: engineWith(s => { seen = s; }) });
    assert.equal(seen.headers['x-from-headers'], 'yes');
});

await check('headers 传 [key,value][] 也能识别', async () => {
    let seen = null;
    const api = createClient();
    await api({ url: ABS, headers: [['X-A', '1'], ['X-B', '2']], engine: engineWith(s => { seen = s; }) });
    assert.equal(seen.headers['x-a'], '1');
    assert.equal(seen.headers['x-b'], '2');
});

await check('headers 为 Headers 实例时 res.config 是纯数据、可序列化', async () => {
    const api = createClient();
    const r = await api({ url: ABS, headers: new Headers({ 'X-Token': 'abc' }), engine: engineWith(() => {}) });
    assert.deepEqual(r.config.headers, { 'x-token': 'abc' });
    assert.ok(JSON.stringify(r.config).includes('x-token'));
});

await check('params 传 URLSearchParams 正确拼 URL 且不抛错', async () => {
    let seen = null;
    const api = createClient();
    await api({
        url: ABS, params: new URLSearchParams({ a: '1', b: '中' }),
        engine: engineWith(s => { seen = s; }),
    });
    assert.equal(seen.url, `${ABS}?a=1&b=%E4%B8%AD`);
});

await check('paramsSerializer 返回非字符串时被安全转成字符串', async () => {
    const spec = normalizeRequest(ABS, { params: { a: 1 }, paramsSerializer: () => 123 });
    assert.equal(spec.url, `${ABS}?123`);
});

await check('xsrfCookieName 含正则元字符时精确匹配（不再吃到别的 cookie）', () => {
    const prev = globalThis.document;
    try {
        globalThis.document = { cookie: 'aXb=WRONG; a.b=RIGHT; other=1' };
        const spec = normalizeRequest(ABS, { xsrfCookieName: 'a.b', xsrfHeaderName: 'X-XSRF' });
        assert.equal(spec.headers['x-xsrf'], 'RIGHT');

        globalThis.document = { cookie: 'csrf(tok)=TOKEN; other=1' };
        const spec2 = normalizeRequest(ABS, { xsrfCookieName: 'csrf(tok)', xsrfHeaderName: 'X-CSRF' });
        assert.equal(spec2.headers['x-csrf'], 'TOKEN', '括号不应让正则失效被 catch 吞掉');
    } finally {
        if (prev === undefined) delete globalThis.document; else globalThis.document = prev;
    }
});

/* ============ 5. resolveStatus 校验增强 ============ */

await check('resolveStatus: NaN / Infinity 明确报 ERR_BAD_OPTION_VALUE', async () => {
    const api = createClient();
    for (const v of [NaN, Infinity, -Infinity]) {
        const e = await api({ url: ABS, resolveStatus: v, engine: engineWith(() => {}) }).catch(x => x);
        assert.equal(e.code, 'ERR_BAD_OPTION_VALUE');
    }
});

await check('resolveStatus 正常规则不受校验增强影响', async () => {
    const api = createClient();
    for (const v of [200, [200, 300], [[200, 300]], (s) => s < 400]) {
        const r = await api({ url: ABS, resolveStatus: v, engine: engineWith(() => {}) });
        assert.equal(r.status, 200);
    }
});

/* ============ 6. 已知行为（文档化，避免回归） ============ */

await check('DELETE/OPTIONS 带 data 走请求体；快捷方法需写进 config.data', async () => {
    let seen = null;
    const api = createClient();
    await api.delete(ABS, { data: { id: 7 }, engine: engineWith(s => { seen = s; }) });
    assert.equal(seen.method, 'DELETE');
    assert.equal(seen.data, '{"id":7}');
    await api({ url: ABS, method: 'options', data: { id: 8 }, engine: engineWith(s => { seen = s; }) });
    assert.equal(seen.method, 'OPTIONS');
    assert.equal(seen.data, '{"id":8}');
});

await check('GET/HEAD 不允许 body：字符串 data 被忽略、对象 data 降级为 params', () => {
    const s1 = normalizeRequest(ABS, { method: 'GET', data: 'raw-string' });
    assert.equal(s1.url, ABS);
    assert.equal(s1.data, undefined);
    assert.equal(s1.headers['content-type'], undefined, 'GET 不应附带 JSON content-type');
    const s2 = normalizeRequest(ABS, { method: 'GET', data: { q: '中文' } });
    assert.equal(s2.url, `${ABS}?q=%E4%B8%AD%E6%96%87`);
    assert.equal(s2.data, undefined);
    assert.equal(s2.headers['content-type'], undefined);
});

// Bug：hasBody 用小写 method 比大写常量，恒为 true，GET/HEAD 的 data 被当 body 序列化
// 并错误附上 application/json，参数也丢了。四种大小写写法都要覆盖。
await check('GET/HEAD 大小写写法都不会把 data 误判为请求体', () => {
    for (const m of ['GET', 'get', 'HEAD', 'head']) {
        const s = normalizeRequest(ABS, { method: m, data: { a: 1 } });
        assert.equal(s.data, undefined, `${m}: 不应产生 body`);
        assert.equal(s.headers['content-type'], undefined, `${m}: 不应附带 JSON content-type`);
        assert.ok(s.url.includes('a=1'), `${m}: data 应降级为 params`);
    }
    // 显式 params 优先，不被 data 覆盖
    const s = normalizeRequest(ABS, { method: 'GET', params: { p: 9 }, data: { a: 1 } });
    assert.equal(s.url, `${ABS}?p=9`);
});

await check('onlyData 返回的业务数据不被挂上内部 engine 属性', async () => {
    const api = createClient();
    const data = await api({
        url: ABS, onlyData: true,
        engine: async () => jsonRes('{"a":1}'),
    });
    assert.deepEqual(data, { a: 1 });
    assert.deepEqual(Object.getOwnPropertyNames(data), ['a']);
});

/* ============ 汇总 ============ */
if (failures.length) {
    console.error(`\n失败 ${failures.length} 项 / 共 ${passed + failures.length} 项：`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
}
console.log(`\n边界与回归测试全部通过：${passed} 项`);
