# bxf

一个基于 Promise 的双引擎（fetch / XMLHttpRequest）请求库，专为 **MV3 浏览器扩展**设计，同时可用于普通网页与 Service Worker。

核心思路参考 `@mswjs/interceptors`：**把引擎差异全部压进适配器，中间只流动 WHATWG 标准对象**。

```
RequestSpec → WHATWG Request → [fetch | XHR 适配器] → WHATWG Response → 唯一解析层 → BxfResponse
```

因此两个引擎返回的对象形状、字段类型、错误码完全一致；解析逻辑只有一份。

---

## 特性

- **双引擎对等**：XHR 统一用 `responseType='arraybuffer'` 读字节，再构造成标准 `Response`（含 204/205/304 无响应体处理）。
- **能力矩阵**：无法对等的能力不做模拟。`stream` 只有 fetch 支持，进度回调只有 XHR 支持；显式指定引擎却不匹配所需能力时直接抛 `ERR_UNSUPPORTED`，不偷偷换引擎。未指定引擎时自动挑选，两者都支持则 **fetch 优先**。
- **可重放配置**：成功与失败都能拿到 `config`（扁平纯数据、url 未拼接、data 未编码、不含 signal/cleanup），可直接回喂 `bxf(config)` 再发一次。库**不会**自动重放，重放时机由你的业务代码决定（例如 token 过期刷新后重试）。
- **干净响应契约**：BxfResponse 固定 7 字段 `{data, status, statusText, headers, config, responseURL, redirected}`，不向外透出原生 `Response` 句柄、也不输出 `raw` 中间产物；需要原生能力时指定 `responseType:'raw'`，此时 `data` 就是未消费的 `Response`。小写 `response` 只出现在 `BxfError` 上，表示被拒的整包响应。
- **最终地址可见**：`responseURL` 是跟随重定向后的实际请求地址，`redirected` 标记是否发生过重定向，普通模式即可读取，不必切 `raw`；XHR 适配器把 `xhr.responseURL` 透传进 WHATWG `Response`（对齐 msw），双引擎语义一致（含 `clone()` 转发）。
- **MV3 友好**：`nativeEngine` 通过 `about:blank` iframe 取未被网页 hook 的原生 `fetch`/`XMLHttpRequest`；Service Worker 里无 `FileReader`/`DOMParser` 时走 `TextDecoder` 与明确降级。
- **零依赖**，UMD / IIFE 双产物。

---

## 安装与构建

```bash
pnpm install
pnpm run build       # 产出 dist/bxf.umd.js / bxf.iife.js / *.min.js
pnpm test            # 151 项：一致性 62 + 流中转/重放 30 + 边界回归 23 + 并发/暴力 22 + 大 body 14
```

> **要跑本文档里的案例，构建是必需步骤。** 实验室页面加载 `dist/bxf.umd.js`，  
> 缺了它页面会红条提示「bxf 未加载」，控制台里 `show()` / `apiUrl()` 全部是 `undefined`。  
> 从零到「复制案例 → 看到完整响应」的完整步骤，见下文  
> [控制台实验室 → 30 秒部署测试环境](#30-秒部署测试环境)。

页面里直接引入：

```html
<script src="dist/bxf.umd.js"></script>
<script>
  bxf.get('/api/user').then(res => console.log(res.data));
</script>
```



---

## 在线调试台（通用 Mock：文件上传 / 消息流 / 任意响应）

想快速验证「文件上传、消息流、指定响应类型 / 状态码」这类场景，用这个更轻量的调试台。  
它只提供一个**可配置的通用接口 `/mock`**，网页是**案例库**：复制到浏览器控制台（F12）直接跑，  
跑完输入 `res` / `err` 看完整成功 / 失败响应。

```bash
node examples/debug-server.mjs            # 默认 http://127.0.0.1:7799
PORT=8080 node examples/debug-server.mjs  # 指定端口
MAX_BODY_MB=128 node examples/debug-server.mjs   # 请求体上限，默认 64MB
```

打开 `http://127.0.0.1:7799/`：页面自动加载 `dist/bxf.umd.min.js` 并挂载全局函数  
`bxf` / `API` / `genFile` / `api` / `run`；每个案例有「复制」按钮，贴进控制台即可。

### /mock 通用接口

接受任意 method（GET / POST / PUT / DELETE / …），响应由查询参数配置：

| 参数                               | 作用                                     |
| -------------------------------- | -------------------------------------- |
| `status=<code>`                  | 响应状态码，默认 200                           |
| `rt=json\|text\|urlencode\|sse`  | 响应 content-type，默认 json（json 回显你发出的请求） |
| `delay=<ms>`                     | 延迟响应（上限 60s），测超时                       |
| `body=<text>`                    | 自定义响应体，**优先级最高**：`rt=json` 尝试 `JSON.parse`，`rt=text` / `urlencode` 原样使用 |
| `echo=0`                         | 关闭**默认 json 回显**（返回 `{ ok: true }`）；仅作用于 `rt=json`，`text` / `urlencode` 有自己的载荷规则 |
| `stream=1` + `n=<条>` + `ms=<间隔>` | 消息流：逐帧 SSE 输出，`n` 上限 50，末帧固定为 `data: [DONE]` |
| `charset=gbk` + `wrongct=1`      | 响应头错标 utf-8、字节却是 GBK，测 `charset` 覆盖    |
| `redirect=<n>`                   | 先经 n 次 302 再响应（上限 10），测 `res.responseURL` / `res.redirected` |

不论什么 method，服务端都会**回显请求**（method / query / headers / body / 解析出的  
`fields` 与 `files`），所以普通请求、表单、文件上传都能直接看到「服务端实际收到了什么」。  
请求体上限默认 **64MB**（`MAX_BODY_MB` 调整），超限返回 `413` 而不是断开连接；  
单文件 10MB、多个 10MB 文件上传均已实测通过。

### 全局基础函数

| 全局                    | 作用                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `bxf`                 | 请求库（默认导出即 `createClient()` 实例，自带 `.get` / `.post` / `.create` / `.interceptors`）             |
| `API`                 | 当前源地址（`location.origin`），拼接口用                                                                |
| `genFile(type, size)` | 按 MIME 类型与字节数生成 `Blob`，直接 `formData.append('file', genFile('image/png', 2048), 'a.png')` 测上传 |
| `api(path, opts)`     | `bxf({ url: location.origin + path, ...opts })` 便捷封装                                         |
| `run(cfg)`            | 经典 `res` / `err` 模式包装：**返回 Promise**，并在该 Promise 上挂 `.res()` / `.err()`，请求完成后可取出完整响应 / 错误    |

### 控制台工作流

```js
var res = null, err = null;
bxf({ url: API + '/mock?rt=json', method: 'GET' })
  .then(r => { res = r; console.log('✅', r.status, r.data); })
  .catch(e => { err = e; console.warn('❌', e); });
// 运行后控制台输入 res / err 查看完整响应
```

也可以直接用页面封装的 `run(cfg)`（等请求完成后再取）：

```js
var job = run({ url: API + '/mock?status=401', method: 'GET' });
// 请求完成后：
job.res();   // 成功时是完整 BxfResponse，失败时为 null
job.err();   // 失败时是完整 BxfError，成功时为 null
```

### 可复制案例（覆盖 `/mock` 全部参数）

下面每段都可在**调试台页面**（`http://127.0.0.1:7799/`）的 Console 里直接粘贴运行；  
调试台全局只有 `bxf` / `API` / `genFile` / `api` / `run`（实验室的 `show` / `apiUrl` 不在这里）。  
所有片段均已用真实 HTTP 请求实测通过：

```js
// ① 普通 GET（rt=json 默认回显请求）+ 经典 res / err 完整查看
var res = null, err = null;
bxf({ url: API + '/mock?rt=json', method: 'GET' })
  .then(function (r) { res = r; console.log('✅', r.status, r.data); })
  .catch(function (e) { err = e; console.warn('❌', e.code, e); });
// 运行后输入 res / err 展开完整成功 / 失败响应

// ② body= + echo=0 + rt=text：自定义响应体优先级最高 → "hello"
bxf.get(API + '/mock?rt=text&body=hello&echo=0', { responseType: 'text' })
  .then(function (r) { console.log(r.status, JSON.stringify(r.data)); });

// ③ rt=urlencode：bxf 无内置 urlencode 响应类型，用 text 接再 URLSearchParams 解析
bxf.get(API + '/mock?rt=urlencode', { responseType: 'text' })
  .then(function (r) { console.table(Object.fromEntries(new URLSearchParams(r.data))); });

// ④ status=401 + resolveStatus：走 err，看完整失败响应与可回喂的 config
bxf.get(API + '/mock?status=401', { resolveStatus: 200 })
  .catch(function (e) { console.warn(e.code, e.status, e.response, e.config); });

// ⑤ delay > timeout：ETIMEDOUT
bxf.get(API + '/mock?delay=800', { timeout: 200 })
  .catch(function (e) { console.log('超时 →', e.code); });

// ⑥ stream=1：SSE 逐帧（n=3 实际共 4 帧，末帧固定是 data: [DONE]）
var frames = [];
bxf.get(API + '/mock?stream=1&n=3&ms=50', {
  responseType: 'stream',
  onStream: function (frame) { frames.push(frame); console.log('帧', frames.length, frame); }
}).then(function (r) { console.log('总帧数', frames.length, '| res.data', r.data); }); // 有回调时 res.data 恒为 []

// ⑦ charset=gbk & wrongct=1：响应头错标 utf-8，靠 charset 覆盖解出中文
bxf.get(API + '/mock?charset=gbk&wrongct=1', { responseType: 'text', charset: 'gbk' })
  .then(function (r) { console.log(r.data); }); // "GBK中文测试：你好，世界"

// ⑧ 文件上传：genFile(类型, 字节数) → Blob，直接 append（服务端回显 field/filename/type/size）
var fd = new FormData();
fd.append('file', genFile('image/png', 2 * 1024 * 1024), 'big.png');
fd.append('note', 'two-megabytes');
bxf({ url: API + '/mock?rt=json', method: 'POST', data: fd })
  .then(function (r) { console.table(r.data.request.files); });
```

页面里的「案例库」卡片还含 DELETE 带体、FormData 文本字段、拦截器、取消请求、  
`run(cfg)` 包装等完整示例，每条都有「复制」按钮。

> 与下面「控制台实验室」的区别：实验室是覆盖**全 API 的 147 条案例 + 跨源 CORS 端点**；  
> 本调试台聚焦**单一通用 `/mock` + 文件上传 / 流 / 任意响应**，并内置 `genFile` 造数。

---

## 大请求体 / 大文件上传 / 大文件下载

`test/large-body.test.mjs` 用本地 Node HTTP 服务做**真实传输**（零第三方依赖），逐字节校验 checksum，  
覆盖 2MB JSON 请求体、单文件 10MB / 3×10MB 文件上传、20MB 下载（7 种响应形态）、  
20MB 单帧 SSE、XHR 引擎大上传，并用白盒计数器锁住内存行为。当前实测（Node 22）：

| 场景 | 耗时 | 峰值 RSS 增量 | 说明 |
| --- | --- | --- | --- |
| POST 2MB JSON | ~58ms | ~11MB | 校验和一致，`res.config` 可回喂 |
| POST 单文件 10MB | ~87ms | ~35MB | multipart 10.00MB，文件字节完整 |
| POST 3×10MB 多文件 | ~284ms | ~71MB | 3 个文件逐个校验大小与 checksum |
| GET 20MB `arraybuffer` | ~148ms | ~26MB | **0 次文本解码、0 次额外拷贝** |
| GET 20MB `blob` | ~158ms | ~26MB | **0 次文本解码** |
| GET 20MB 单帧 SSE | ~224ms | ~40MB | 增量分帧，线性复杂度 |
| XHR 引擎 10MB 上传 | ~93ms | ~40MB | 比 fetch 多一次整包物化 |

### 本轮修掉的内存 / 性能问题（优化前 → 优化后，均为实测）

| 位置 | 问题 | 优化前 | 优化后 |
| --- | --- | --- | --- |
| `normalizeResponse` | `blob` / `arraybuffer` 也无条件 `decodeBytes()` 生成整包 UTF-16 字符串；`arraybuffer` 还再 `slice()` 复制一次 | heap +40MB，307ms / 305ms | heap +0.3MB / +0.1MB，148ms / 158ms |
| `normalizeResponse` | `isJson(text) ? JSON.parse(text) : text` 把大 JSON **解析两遍** | 20MB 解析 2 次，heap +60MB（auto） | 解析 1 次，heap +40MB |
| `parseStream` | 每块对「整份累积缓冲」做 `replace()` / `split()`，单帧大消息是 **O(n²)** | 20MB 单帧 4632ms、heap +158MB、RSS +126MB | 224ms、heap +43MB、RSS +40MB |
| `normalizeRequest` | MB 级多键嵌套 `data` 被 `deepMerge` 深拷贝两次 | 单次 ~27ms | 单次 ~20ms（少一次整树拷贝） |
| `debug-server` `/mock` | 每个 chunk 都 `Buffer.concat(chunks)` 求长度（O(n²)）+ 10MB 硬上限 `req.destroy()` | 9MB 291ms、**10MB 直接 ECONNRESET** | O(1) 计数 + 64MB 上限 + 413；9MB 47ms、10MB 50ms、30MB 三文件 119ms |

> 分帧算法重写后与重写前做过 **193 组（多载荷 × 多种切块）等价性对照，0 差异**，  
> 并已固化为 `large-body.test.mjs` 里的 69 组 fuzz 回归。

### 使用建议

- **大文件下载**：优先 `responseType:'raw'`（完全不消费响应体）或 `'stream'`（逐帧）；  
  需要整包时用 `arraybuffer` / `blob`，现在不会再多出一份文本字符串。
- **大文件上传**：默认走 fetch 引擎。XHR 引擎为了拿到 multipart 字节会执行  
  `request.arrayBuffer()` 整包物化，多一份拷贝（10MB 实测 RSS ~40MB vs fetch ~35MB）。
- **SSE 大帧**：务必提供 `onStream(frame)`；不提供时 `res.data` 会累积全部帧文本  
  （20MB 单帧就是 20MB 字符串），这是二选一契约，不是泄漏。
- **大 JSON 请求体**：库会 `JSON.stringify` 一次，且 `res.config` 保留一份纯数据快照，  
  约 2× 体积属正常；同样体积下「数组形状」比「多键嵌套对象」更省（后者触发 `deepMerge` 递归）。
- **已知边界**：流末尾的孤立 `\r` 会为跨块 CRLF 保留，作为尾帧文本原样交给调用方  
  （重写前即如此，等价性测试已锁定），本轮只做 O(n) 优化、未改该语义。

---

## 控制台实验室（推荐）

**本 README 里所有以 `show(...)` / `apiUrl(...)` / `grab(...)` 开头的案例，都在这个页面的 DevTools 控制台里执行。**  
页面负责加载 `bxf` 与工具库；你只需复制代码、粘贴、回车，就能看到完整成功 / 失败响应。

### 30 秒部署测试环境

```bash
# ① 仓库根目录：安装依赖 + 构建（必须！页面加载 dist/bxf.umd.js）
pnpm install
pnpm run build

# ② 启动实验室：主站 7788 + 跨源站 7789（两个连续端口都要空闲）
node examples/playground/server.mjs
#    换端口：node examples/playground/server.mjs 9000   # 跨源站自动 9001

# ③ 浏览器打开 http://127.0.0.1:7788/ ，按 F12 → Console
```

打开后先核对顶部是**蓝色**提示条，再做一次冒烟检查：

| 检查                                    | 期望结果                                                            |
| ------------------------------------- | --------------------------------------------------------------- |
| 页面顶部横幅                                | 蓝色「控制台已挂载：`api` / `apiUrl()` / `show()` …」                      |
| `typeof show`                         | `"function"`                                                    |
| `typeof apiUrl`                       | `"function"`                                                    |
| `apiUrl('json')`                      | `"http://127.0.0.1:7788/?api=json"`                             |
| `show(await api.get(apiUrl('json')))` | 逐行打印 `data / statusText / headers / config / meta`，末尾给出可展开的完整对象 |

若横幅是红色「未找到 `dist/bxf.umd.js`」，回到第 ① 步重新 `pnpm run build` 后刷新；  
此时工具库会退化成只报「bxf 未加载」，`show` / `apiUrl` 都不可用，案例自然跑不起来。

> 服务占用 `PORT` 与 `PORT+1` 两个连续端口，任一被占用都会**整体报错退出**，  
> 不会出现「页面开得出来但请求打到别的服务」的半启动状态。跨源站仅供 CORS 案例使用。  
> 另外还有 24 个 `?api=xxx` 测试端点，全部零第三方依赖，清单见本章末尾。

### 全局公共函数完整清单（案例里出现的都在这里）

页面加载 `examples/playground/toolkit.js` 后挂到 `window`，控制台可直接调用：

| 全局                 | 签名                                                                 | 作用 / 返回                                                                                                                                                   | 示例                                                                         |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `bxf`              | UMD 全局                                                             | **库本身**：默认导出即 `createClient()` 实例，由 `dist/bxf.umd.js` 提供，不是工具库定义的；自带 `.get/.post/.create/.interceptors`                                                   | `bxf.get('/?api=json')`                                                    |
| `api`              | `api(config)` / `api.get(url, cfg)` / `api.post(url, data, cfg)` … | `bxf.create({})` 实例，**不带 defaults**，参数显式可见；返回 `Promise<BxfResponse>`                                                                                      | `api.get(apiUrl('json'))`                                                  |
| `apiUrl`           | `apiUrl(name, extra?) → string`                                    | 拼同源端点 `origin + pathname + '?api=' + name`；`extra` 支持字符串 `'code=429'` 或对象 `{ code: 429 }`（自动 encode）                                                      | `apiUrl('status', 'code=502')`                                             |
| `crossUrl`         | `crossUrl(name, extra?) → string`                                  | 同上但指向跨源站 `PORT+1`，用于 CORS 案例                                                                                                                              | `crossUrl('json')`                                                         |
| `instance`         | `instance(defaults?) → 实例`                                         | `bxf.create(defaults)` 便捷封装，测 `baseURL` / `timeout` 等 defaults                                                                                            | `instance({ baseURL: '/' }).get('?api=json')`                              |
| `show`             | `show(x, label?) → x`                                              | **万能打印器**：自动识别 `BxfResponse` / `BxfError` / 普通值，逐字段打印 `data / statusText / headers / config(可回喂) / responseURL / redirected / 字段 / meta`；失败时额外打印 `code / status / err.response`；返回原值 | `show(await api.get(apiUrl('json')), '完整响应')`                              |
| `grab`             | `grab(promise, label?) → Promise<any>`                             | 成功失败**都** `show` 且**不抛错**；`await grab(...)` 保证页内「运行」等到输出                                                                                                  | `await grab(api.get(apiUrl('status','code=429'), { resolveStatus: 200 }))` |
| `inspect` / `dump` | `inspect(x, label?) → x`                                           | 列出**全部自有属性**（含不可枚举的 `engine`），并展开完整对象                                                                                                                     | `inspect(await api.get(apiUrl('json')))`                                   |
| `meta`             | `meta(x, label?) → x`                                              | 只看不可枚举元数据 `{ engine, enumerableKeys }`                                                                                                                    | `meta(res)`                                                                |
| `cmp`              | `cmp(config, label?) → Promise<Array>`                             | 同一份配置分别跑 `fetch` / `xhr`，`console.table` 输出对照表                                                                                                            | `await cmp({ url: apiUrl('json') })`                                       |
| `probeAll`         | `probeAll() → Promise<Array>`                                      | 16 个代表性场景一次跑完，输出全库行为速览表                                                                                                                                   | `await probeAll()`                                                         |
| `typeOf`           | `typeOf(v) → string`                                               | 细分类型名（`ArrayBuffer` / `Blob` / `Document` / `Array(n)` / 错误名 …）                                                                                           | `typeOf(res.data)`                                                         |
| `sleep`            | `sleep(ms) → Promise`                                              | 等待，配合超时 / 取消案例                                                                                                                                            | `await sleep(300)`                                                         |
| `BXF_CODES`        | `string[]`                                                         | 错误码速查数组（`ETIMEDOUT` / `ERR_CANCELED` / `ERR_HTTP_STATUS` …）                                                                                               | `console.table(BXF_CODES)`                                                 |

> 工具库源码：`examples/playground/toolkit.js`（浏览器 IIFE，非模块）。  
> `api` 刻意**不带 defaults**，就是为了让每条案例的参数都显式可见；想测 `create({...})` 请用 `instance(defaults)`。

### 控制台工作流：完整查看成功 / 失败响应

**方式 A —— `show()` 一行看全（案例中绝大多数写法）**

```js
show(await api.get(apiUrl('json')));
// 控制台逐行输出：data / statusText / headers / config(可回喂) / responseURL / redirected / 字段 / meta / 完整对象（可展开）
```

失败场景不用写 `try/catch`，交给 `grab()`：

```js
await grab(api.get(apiUrl('status', 'code=429'), { resolveStatus: [[200, 300]] }), '429 被拒');
// 打印 BxfError：message / code / status / config / err.response（整包 7 字段 BxfResponse）
```

**方式 B —— `res` / `err` 变量，事后反复查看**

```js
var res = null, err = null;
api.get(apiUrl('json'))
  .then(r => { res = r; console.log('✅', r.status, r.data); })
  .catch(e => { err = e; console.warn('❌', e.code, e.message, e.response); });
// 运行后控制台输入 res / err / res.config / err.response 逐个展开
```

> Chrome DevTools 支持**顶层 `await`**；案例一律不声明顶层 `const` / `let`，  
> 可以反复粘贴执行而不报「已声明」。多步案例用 `async IIFE` 包起来避免变量冲突。  
> 页面里的「▶ 运行」按钮会临时接管 `console`，把同样的输出留在卡片内，控制台里也能同时看到。

> 案例唯一数据源是 `examples/playground/cases.mjs`，**本 README 的案例章节由 `node examples/playground/gen-readme.mjs` 从它生成**，两处不会漂移。

### 案例自检

改完 `cases.mjs` 后：

```bash
pnpm run readme                                        # 同步 README 案例章节
pnpm run verify                                        # 语法 + 逐条执行（需先起服务）
node examples/playground/verify-cases.mjs --syntax    # 只做语法校验，不需要服务
```

`verify` 会加载 `dist/bxf.umd.js` + 工具库，用真实 `fetch` 把 147 条案例跑一遍。Node 没有 `XMLHttpRequest` / `DOMParser` / 浏览器 `location`，因此 XHR 引擎与进度回调相关的案例会被标注为「环境差异」而非错误——它们在浏览器里才会真正生效。当前结果：语法 **147/147**、运行 **138/147**，9 条为上述环境差异。

### 测试端点

| 端点                                   | 用途                                                |
| ------------------------------------ | ------------------------------------------------- |
| `echo`                               | 回显 method / query / headers / cookie / body / md5 |
| `json` `text` `badjson` `html` `xml` | 各种响应体（含声明 json 但内容非法）                             |
| `binary` `bytes` `large`             | 二进制 / 指定字节数 / 分块大响应（下载进度）                         |
| `utf8` `gbk`                         | 字符集自动识别与手动指定                                      |
| `empty` `204` `304`                  | 空体与无响应体状态码                                        |
| `status?code=xxx`                    | 任意状态码 + 业务体（`resolveStatus` / `err.response`）     |
| `multiheader` `cookie`               | 重复响应头合并 / Set-Cookie                              |
| `delay?ms=`                          | 超时、取消                                             |
| `sse?n=&ms=`                         | SSE 流（`responseType:'stream'` / `onStream`）       |
| `slowchunks?n=&ms=`                  | 慢速分块（raw 流中转 / 边下边传）                              |
| `upload`                             | 接收任意请求体，回显字节数与 md5（上传进度 / 代理下载）                   |
| `redirect?n=`                        | 302 重定向链                                          |
| `broken` `broken?mode=destroy`       | 非法 JSON / 中途断连                                    |
| `cors`                               | 带 CORS 头的响应                                       |

---

## 调用形态与实例 API

```js
bxf(config);                              // 对象形态
bxf(url, config);                          // URL + 配置
bxf.get(url, config);                      // 无 data 方法
bxf.post(url, data, config);               // 带 data 方法
```

| API                                   | 说明                                                   |
| ------------------------------------- | ---------------------------------------------------- |
| `bxf.request`                         | 等于 `bxf` 本身                                          |
| `bxf.create(defaults)`                | 创建独立实例，`defaults` 不共享                                |
| `bxf.get / delete / head / options`   | 无请求体方法 `(url, config)`                               |
| `bxf.post / put / patch`              | 带请求体方法 `(url, data, config)`                         |
| `bxf.all(iterable)`                   | `Promise.all`                                        |
| `bxf.spread(fn)`                      | 把数组结果摊开成多参数                                          |
| `bxf.defaults`                        | 实例默认配置（可直接改）                                         |
| `bxf.interceptors.request / response` | `use(fulfilled, rejected)` / `eject(id)` / `clear()` |

- `request` 拦截器**后添加先执行**（栈），`response` 拦截器**先添加先执行**（队列）。
- 拦截器收到的是 `RequestSpec` / `BxfResponse`；响应拦截器替换对象后，不可枚举元数据会补挂一次。

---

## 完整参数表

所有参数都可写在单次 `config` 或 `create(defaults)` 里，单次配置优先（`deepMerge`）。


### 地址与方法

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `url` | string | `''` | 绝对地址，或相对 `baseURL` / 当前页面 |
| `initUrl` | string | — | 对象形态下可代替 `url`，优先级更高 |
| `baseURL` | string | `''` | 末尾斜杠自动归一 |
| `method` | string | `'GET'` | 统一转大写，不限于快捷方法 |

### 请求内容

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `data` | any | — | **除 GET/HEAD 外所有 method 都可带请求体**（含 DELETE / OPTIONS）；纯对象自动 JSON 序列化并设 `application/json`，`FormData` / `Blob` / `ArrayBuffer` / `URLSearchParams` / `ReadableStream` 原样透传（`ReadableStream` 自动补 `duplex:'half'`；见案例 17 / 33 / 34 / 35）。GET/HEAD 下纯对象降级为 `params`，其它类型忽略（不会附带 `content-type`） |
| `params` | object / string / URLSearchParams / `[{name,value}][]` | — | 拼到 URL；普通对象走 jQuery.param 风格编码（支持嵌套、数组、中文），`URLSearchParams` 走其 `toString()`，表单数组按 `name=value` 拼接 |
| `paramsSerializer` | function | — | `(params) => string`，完全接管序列化；返回值会被安全转成字符串 |
| `requestType` | `'query'` / `'json'` | — | `query` 用表单编码并设 `application/x-www-form-urlencoded`；`json` 对合法 JSON 字符串补 `application/json`；对象默认自动 JSON 序列化 |
| `headers` | object / `Headers` / `[key,value][]` | `{}` | 三种形态都支持，键名小写归一；用户设置优先于内置 `content-type`；`res.config.headers` 始终是纯数据普通对象 |
| `auth` | string | — | 快捷写入 `authorization` 头 |
| `xsrfHeaderName` / `xsrfCookieName` | string | — | 从 `document.cookie` 取值注入请求头；cookie 名中的正则元字符已转义；无 DOM 环境自动跳过 |

### 响应

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `responseType` | string | `'auto'` | 见下方响应类型表；白名单外的值降级为 `auto` |
| `charset` | string | — | 手动指定解码字符集，**优先于响应头**；不传时从 `content-type` 提取（用于 1688 等响应头错写 utf-8、字节却是 GBK 的页面） |
| `onStream` | function | — | `(frame)`，仅 `responseType:'stream'` 时逐帧回调原始帧文本（帧级：按空行切分，含注释帧 / 尾帧） |
| `onlyData` | boolean | `false` | `true` 时只返回 `res.data` |
| `resolveStatus` | number / array / function | `undefined` | 见下方状态码规则表；**不传 = 只要拿到 HTTP 响应就 resolve**（含 429/502）；数值必须是有限数字，`NaN` / `Infinity` 会报 `ERR_BAD_OPTION_VALUE` |

### 一等公民能力（直接映射到 RequestInit）

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `credentials` | `'same-origin'` | `omit` / `same-origin` / `include` |
| `mode` | — | `cors` / `no-cors` / `same-origin` |
| `cache` | — | `default` / `no-store` / `reload` … |
| `redirect` | `'follow'` | `follow` / `manual` / `error` |
| `referrer` / `referrerPolicy` | — | 透传 |
| `integrity` | — | SRI 校验 |
| `keepalive` | — | 透传 |

> XHR 引擎无法表达 `mode/cache/referrer/referrerPolicy/integrity/keepalive` 与非 `follow` 的 `redirect`，会输出一次警告而不是静默忽略。

### 引擎与逃生舱

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `engine` | `'fetch'` / `'xhr'` / function | 自动 | 显式指定不自动切换；传函数即自定义引擎（需返回标准 `Response` 或 `BxfResponse`） |
| `nativeEngine` | boolean | `false` | 通过 `about:blank` iframe 取原生 API，绕过网页 hook（MV3 核心能力） |
| `fetchOptions` | object | `{}` | 透传给 fetch 的非保护字段；`method/headers/body/signal/url/window` 不可覆盖 |
| `xhrOptions` | object | `{}` | 赋值到 xhr 实例；保护键（`timeout`/`withCredentials`/`responseType` 等）会被跳过 |
| `rawFields` | object | — | 按**最终引擎**分流到 `fetchOptions`（fetch）或 `xhrOptions`（XHR） |

### 中断、进度、上层行为

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `timeout` | number | `0` | 毫秒；只覆盖到「引擎交出响应」为止，raw 模式长流不会被掐断 |
| `signal` | AbortSignal | — | 与内部超时/取消信号合并（等价 `AbortSignal.any`） |
| `onUploadProgress` | function | — | XHR 专属；会触发引擎自动选择 |
| `onDownloadProgress` | function | — | XHR 专属；会触发引擎自动选择 |
| `beforeInterceptors` | function | — | `(spec) => boolean｜Promise<boolean>`；返回 `false` 抛 `BEFORE_TERMINATE`；同步抛错也会转成 rejected Promise 并清理超时定时器 |

---

## 能力矩阵

| 所需能力 | 未指定引擎 | 显式 `engine:'fetch'` | 显式 `engine:'xhr'` |
| --- | --- | --- | --- |
| 普通请求 | fetch 优先 | ✅ | ✅ |
| `responseType:'stream'` | 自动 fetch | ✅ | ❌ `ERR_UNSUPPORTED` |
| 进度回调 | 自动 XHR | ❌ `ERR_UNSUPPORTED` | ✅ |
| stream + 进度 | ❌ 能力互斥报错 | ❌ | ❌ |

---

## 响应契约

成功时（`onlyData:false`）返回同一个形状，两个引擎完全一致：

```js
{
  data,         // 解析后的业务数据
  status,       // HTTP 状态码
  statusText,   // 状态描述
  headers,      // 普通对象，重复头合并为 "a, b"
  config,       // 可直接回喂 bxf() 的请求配置；成功 / 失败 / 双引擎同一份形状
  responseURL,  // 跟随重定向后的最终实际请求地址（绝对 URL）
  redirected,   // 是否发生过重定向（boolean）
}
```

成功侧 `res` 与失败侧 `err.response` **完全同形**（都是上面 7 个字段），不需要再区分大小写或多层嵌套。

### 最终请求地址：`responseURL` / `redirected`

普通模式（无需 `responseType:'raw'`）即可读到重定向后的实际地址：

```js
const res = await bxf.get('/download', { params: { v: 2 } });

res.responseURL;   // 跟随重定向后的最终绝对地址
res.redirected;    // 是否发生过重定向
res.config.url;    // 用户原始入参（未拼 params、未补 baseURL）
```

三个 `url` 语义不同，不要混用（尤其**回喂请用 `res.config`，不要 `bxf(res)` 或 `{...res.config, ...res}`**，否则会把终点地址当成起点、短路重定向链）：

| 值 | 含义 | 典型值 |
| --- | --- | --- |
| `res.config.url` | 用户传入的原始地址，可直接回喂 `bxf(config)` | `/download` |
| `spec.url`（内部） | 拼完 `params` 后的请求地址，可能是相对路径 | `/download?v=2` |
| `res.responseURL` | 引擎拿到的最终响应地址，绝对 URL | `https://cdn.example.com/file.zip` |

实现上：fetch 引擎读原生 `Response.url`；XHR 引擎由适配器把 `xhr.responseURL` 透传进 WHATWG `Response`（对齐 msw）。当 `response.url` 为空时（自定义函数引擎返回手工 `new Response()`、`redirect:'manual'` 的 opaqueredirect、`mode:'no-cors'` 的 opaque response），用 `createRequest()` 产出的绝对化 `Request.url` 兜底 —— 此时 `responseURL` 表示「实际发出的请求地址」而非重定向终点，`redirected` 明确为 `false`，不做猜测。

以下路径拿不到这两个字段，属预期：`onlyData:true`（只返回 `data`）、网络层 / 超时 / 取消失败（`err.response === undefined`）、响应拦截器返回全新自定义对象（只补不可枚举的 `engine`）。

两点收敛：

- **不暴露原生 `Response` 句柄**：普通模式下解析层已消费 body，句柄是空壳（`clone()` 会抛错）；确实需要原生能力时用 `responseType:'raw'`。
- **不再输出 `raw` 字段**：引擎边界已按 msw 方案统一成 WHATWG `Response`，早期「按引擎给不同原生句柄」的 raw 失去了存在理由，且 `text`/`blob`/`arraybuffer` 下它与 `data` 本就是同一个值。`stream` 的原始帧由 `onStream(frame)` 逐帧给出（帧级、按空行分帧，不解析 `data:` 字段、不 `JSON.parse`），`raw` 模式的 body 流从 `data.body` 取。

唯一不可枚举元数据是 `engine`（实际生效引擎），不出现在 `Object.keys(res)` / `JSON.stringify` 里。`retry()` / `retryCount` 已移除 —— 重放完全由调用方 `bxf(config)` 发起。

| `responseType` | `data` | 备注 |
| --- | --- | --- |
| `auto`（默认） | JSON 自动解析，非法则保留字符串 | 按 charset 解码 |
| `text` | 字符串 | 按 charset 解码 |
| `json` | 对象；非法 JSON 保留字符串（不抛异常） | 按 charset 解码 |
| `blob` | Blob | 原始字节 |
| `arraybuffer` | ArrayBuffer | 原始字节 |
| `document` | Document（无 DOMParser 环境降级为字符串） | 按 content-type 选 mime |
| `raw` | 未消费的原生 `Response` | body 流从 `data.body` 取 |
| `stream` | 无 `onStream` 时是完整帧原文数组；有 `onStream` 时只回调不累积，`res.data` 恒为 `[]` | 帧级：按空行切分，UTF-8 解码，含注释帧 / 尾帧；不做字段解析与 `JSON.parse` |

> `charset` 显式指定时**优先于响应头**：个别页面（如 1688）响应头错写 `charset=utf-8`、字节却是 GBK，此时 `charset:'gbk'` 能覆盖响应头声明；不传时才从 `content-type` 提取。

> `raw` 模式下 `data` 与 `data.body` 共享同一个 body，**只能消费一次**。

### 原生句柄：`responseType:'raw'` 是唯一入口

```js
const res = await bxf.get('/download/file.zip', { responseType: 'raw' });

res.data instanceof Response;      // true，bodyUsed === false
res.data.body;                     // ReadableStream（未消费）
res.data.url;                      // 重定向后的最终 URL
res.data.redirected;               // 是否发生过重定向
res.data.clone();                  // 可用，且 clone 后 url 仍然保留
await res.data.text();             // 或 .arrayBuffer() / .body.getReader()
```

XHR 引擎的 `Response` 由适配器构造，已按 `@mswjs/interceptors` 的 `FetchResponse.setUrl()` 方案补齐 `url` / `redirected`（读取 `xhr.responseURL`），所以两个引擎在 raw 模式下拿到的元信息一致。

> 只想看最终地址不必切 `raw`：顶层 `res.responseURL` / `res.redirected` 与这里的 `res.data.url` / `res.data.redirected` 同源同值，`raw` 的价值在于拿到未消费的 body 流与 `clone()`。

### `err.response`（失败时的整包响应）

小写 `response` **只出现在 `BxfError` 上**，且永远是 7 字段的 BxfResponse，与成功的 `res` 同形。

| 场景 | `err.response` |
| --- | --- |
| 状态码被 `resolveStatus` 拒绝（`ERR_HTTP_STATUS`） | 完整 BxfResponse，业务体 `err.response.data` 不丢 |
| 网络层 / 超时 / 取消 / 能力错误 | `undefined`（根本没拿到 HTTP 响应，或响应未完成解析） |

```js
// 状态码被拒：整包响应与业务体都不会丢
try {
  await bxf.get('/api', { resolveStatus: [[200, 300]] });
} catch (err) {
  err.response.data;                     // 429 的业务体
  err.response.status;                   // 也等于 err.status
  err.config === err.response.config;    // true，可直接回喂
}

// 网络层失败：没有 HTTP 响应
try { await bxf.get('https://unreachable.example.com'); }
catch (err) {
  err.code;        // ERR_NETWORK
  err.response;    // undefined
  err.config;      // 仍在，可回喂重试
}
```

统一取值的安全写法：

```js
const status = err.response ? err.response.status : undefined;
const body = err.response ? err.response.data : undefined;
```

---

## resolveStatus 规则

| 写法 | 含义 |
| --- | --- |
| 不传 / `null` | 只要拿到 HTTP 响应就 resolve（含 429 / 502） |
| `200` | 精确匹配 |
| `[200, 429]` | 两个单一码（**不是**区间） |
| `[[200, 300]]` | 左闭右开区间 `[200, 300)` |
| `[200, [400, 500], fn]` | 混合，任一项命中即可（区间项是**一层**数组） |
| `(status, response) => boolean` | 自定义，第二个参数是完整 BxfResponse |

> **易错点**：顶层数组表示「若干规则项」，所以 `[200, 300]` 是**两个单一码**；要表达 200..299 必须写成 `[[200, 300]]`（数组里放一个 `[min,max]` 项）。而在混合数组里，区间项本身就是一层 `[400, 500]`，不要再多套一层。

不命中时抛 `ERR_HTTP_STATUS`，错误对象带 `config` 与 `response`。类型非法（字符串 / 对象）抛 `ERR_BAD_OPTION_VALUE`。

---

## 错误码

所有失败都是 `BxfError`（`name='BxfError'`、`isBxfError=true`），两个引擎下 `code` 一致。

| code | 含义 | 是否带 `err.response` |
| --- | --- | --- |
| `ETIMEDOUT` | 超时 | ❌ |
| `ERR_CANCELED` | 主动取消 | ❌ |
| `ERR_NETWORK` | 网络错误 / 跨域 / DNS | ❌ |
| `ERR_BAD_RESPONSE` | 响应解析失败 | 视情况 |
| `ERR_BAD_REQUEST` | 请求构建或发送失败 | ❌ |
| `ERR_INVALID_URL` | URL 无法构造 Request | ❌ |
| `ERR_UNSUPPORTED` | 当前引擎 / 环境不支持该能力 | ❌ |
| `ERR_BAD_OPTION_VALUE` | 配置类型非法 | ❌ |
| `ERR_HTTP_STATUS` | 状态码未命中 `resolveStatus` | ✅ |
| `BEFORE_TERMINATE` | `beforeInterceptors` 返回 false | ❌ |
| `ERR_UNKNOWN` | 未归类错误的兜底码（如 `data` 含循环引用导致递归栈溢出） | ❌ |

`err` 始终带 `config`；`err.cause` 保留底层原始错误，`err.causeName` 保留其 `name`。

> `BxfError` 上还挂着 3 个**兼容别名常量**：`ERR_BAD_OPTION`、`ECONNABORTED`、`ERR_ABORT_SIGNAL`。  
> 它们只是保留给旧代码的常量，**库本身不会主动返回这三个 code**（源码 `BxfError.js` 中除定义处外零引用）；  
> 取消统一返回 `ERR_CANCELED`，超时统一返回 `ETIMEDOUT`，配置非法统一返回 `ERR_BAD_OPTION_VALUE`。

---

## 原生响应与流中转（代理下载 / 边下边传）

`responseType:'raw'` 不消费响应体，可直接把下载流接到上传请求：

```js
const res = await bxf.get('/download/file.zip', { responseType: 'raw' });

await fetch('https://cdn.example.com/upload', {
  method: 'POST',
  body: res.data.body,    // raw 模式下未消费的响应体流
  duplex: 'half',          // 浏览器要求：流式请求体必须声明
  headers: { 'content-type': 'application/octet-stream' },
});
```

`timeout` 刻意使用可清除的 `setTimeout` 而非 `AbortSignal.timeout()`：raw 模式引擎拿到响应头就交出，超时随即失效，长流不会被掐断。

---

## 控制台案例（全参数 / 全用法）

> **运行前置（缺一步，案例里的 `show` / `apiUrl` / `grab` 就是 `undefined`）**
> ① 根目录 `pnpm run build` → ② `node examples/playground/server.mjs` →
> ③ 打开 `http://127.0.0.1:7788/` 并确认顶部**蓝色**提示条 → ④ 按 `F12` 打开 Console。
> 完整部署步骤与 `show` / `apiUrl` / `grab` / `inspect` / `cmp` / `probeAll` 等
> **全部公共函数的签名、返回值和示例**，见上文「控制台实验室 → 30 秒部署测试环境 /
> 全局公共函数完整清单」。
>
> 以下每一段都可复制到实验室页面的 DevTools 控制台直接执行；改 `{}` 里的参数即可对比结果。
> 案例由 `examples/playground/cases.mjs` 生成，共分为 14 组。

<!-- CASES:START -->
共 **147** 条案例，分 **14** 组。所有代码都只依赖实验室挂载的全局工具，可反复粘贴执行。

| 组 | 条数 | 覆盖 |
| --- | --- | --- |
| ① 快速开始 | 9 | 最小请求、完整响应、错误响应、速览工具 |
| ② 调用形态与实例 | 13 | 4 种入参、方法快捷方式、create/all/spread |
| ③ URL / params / data | 16 | 参数序列化（对象 / 字符串 / URLSearchParams / 表单数组）、请求体编码、baseURL、绝对地址 |
| ④ 请求头与凭据 | 12 | headers（对象 / Headers / 键值对数组）、auth、xsrf、cookie、重复响应头、CORS |
| ⑤ 响应契约与 responseType | 18 | 全 8 种响应类型、charset、空体/204/304 |
| ⑥ resolveStatus 与错误响应 | 10 | 数字/数组/区间/函数规则、err.response 家族 |
| ⑦ 引擎与能力矩阵 | 14 | 显式引擎、自动选引擎、能力冲突、自定义引擎 |
| ⑧ 上传 / 下载进度 | 5 | XHR 专属能力，未指定引擎时自动切换 |
| ⑨ 流式与流中转 | 7 | SSE / onStream / raw 流中转 / 边下边传 |
| ⑩ 超时与取消 | 6 | timeout、signal、AbortController、长流不被掐断 |
| ⑪ 拦截器与前置钩子 | 9 | request/response 顺序、rejected、eject/clear、beforeInterceptors |
| ⑫ 配置快照与重放 | 8 | res.config / err.config 回喂、外部重放、可序列化 |
| ⑬ 一等公民与逃生舱 | 10 | fetchOptions/xhrOptions/rawFields、mode/redirect/cache 等 |
| ⑭ 错误码全景 | 10 | 各 code 的可复现触发方式与速查表 |

---

### ① 快速开始
> 最小请求、完整响应、错误响应、速览工具

#### 1. 最小请求

默认 GET + auto 解析，拿到完整 BxfResponse

```js
show(await api.get(apiUrl('json')));
```

#### 2. 完整响应的所有属性

固定 7 字段：data / status / statusText / headers / config / responseURL / redirected

```js
show(await api.get(apiUrl('json')), '完整响应');
```

#### 3. 只要业务数据 onlyData

返回 res.data，不再是完整响应对象

```js
show(await api.get(apiUrl('json'), { onlyData: true }), 'onlyData');
```

#### 4. 任何 HTTP 状态码默认都 resolve

不传 resolveStatus 时 429/502 也算成功

```js
show(await api.get(apiUrl('status', 'code=502')), '502 也 resolve');
```

#### 5. 状态码被拒绝 → err.response

ERR_HTTP_STATUS 时拿到整包响应

```js
await grab(api.get(apiUrl('status', 'code=429'), { resolveStatus: [[200, 300]] }), '429 被拒');
```

#### 6. 网络层失败 → 没有 err.response

没拿到 HTTP 响应，config 仍可回喂

```js
await grab(api.get('http://127.0.0.1:1/nope'), '网络失败');
```

#### 7. 列出全部属性（含不可枚举）

engine 是不可枚举的元数据

```js
inspect(await api.get(apiUrl('json')));
```

#### 8. 只看元数据

engine 是实际生效引擎，不是你传入的原值

```js
meta(await api.get(apiUrl('json')));
```

#### 9. 一次性看全库行为

16 个代表性场景跑成一张对照表

```js
await probeAll();
```


---

### ② 调用形态与实例
> 4 种入参、方法快捷方式、create/all/spread

#### 10. 形态 1：bxf(config)

单对象入参

```js
show(await api({ url: apiUrl('json') }));
```

#### 11. 形态 2：bxf(url, config)

字符串 URL + 配置对象

```js
show(await api(apiUrl('json'), { responseType: 'text' }));
```

#### 12. 形态 3：bxf.get(url, config)

无 data 的快捷方法

```js
show(await api.get(apiUrl('json'), { onlyData: true }));
```

#### 13. 形态 4：bxf.post(url, data, config)

带 data 的快捷方法

```js
show(await api.post(apiUrl('echo'), { a: 1, b: '中文' }), 'POST JSON');
```

#### 14. bxf.request === bxf

同一个函数引用

```js
console.log('bxf.request === bxf →', bxf.request === bxf, '| api.request === api →', api.request === api);
```

#### 15. PUT / PATCH 带请求体

method 会转成大写

```js
show(await api.put(apiUrl('echo'), { via: 'put' }), 'PUT');
```

#### 16. DELETE / HEAD / OPTIONS

无请求体方法，echo 回显真实 method

```js
console.log('DELETE →', (await api.delete(apiUrl('echo'))).data.method,
  '| HEAD →', (await api.head(apiUrl('echo'))).status,
  '| OPTIONS →', (await api.options(apiUrl('echo'))).data.method);
```

#### 17. DELETE / OPTIONS 也能带请求体

快捷方法把 data 写进 config：api.delete(url, { data })

```js
show(await api.delete(apiUrl('echo'), { data: { id: 7, reason: 'cleanup' } }), 'DELETE 带体');
show(await api.options(apiUrl('echo'), { data: { probe: 1 } }), 'OPTIONS 带体');
```

#### 18. 任意 method 覆盖

config.method 不限于快捷方法

```js
show(await api({ url: apiUrl('echo'), method: 'PROPFIND' }), '自定义 method');
```

#### 19. create(defaults) 独立实例

defaults 不共享，baseURL 自动补 /

```js
await (async () => {
  var x = instance({ baseURL: location.origin + '/', timeout: 5000, headers: { 'X-From': 'instance' } });
  show(await x.get('?api=echo'), '相对地址 + defaults');
})();
```

#### 20. 单次 config 覆盖 defaults

deepMerge 后以单次配置为准

```js
await (async () => {
  var x = instance({ headers: { 'X-Level': 'defaults' }, responseType: 'text' });
  show(await x.get(apiUrl('echo'), { headers: { 'X-Level': 'single' }, responseType: 'auto' }), '覆盖 defaults');
})();
```

#### 21. api.all 并发

等价于 Promise.all

```js
show(await api.all([api.get(apiUrl('json')), api.get(apiUrl('text'))]), 'all 两条');
```

#### 22. api.spread 展开结果

把数组摊开成多参数

```js
show(await api.all([api.get(apiUrl('json')), api.get(apiUrl('text'))])
  .then(api.spread(function (a, b) { return { first: a.status, second: b.data }; })), 'spread');
```


---

### ③ URL / params / data
> 参数序列化（对象 / 字符串 / URLSearchParams / 表单数组）、请求体编码、baseURL、绝对地址

#### 23. params 对象（含嵌套 / 数组 / 中文）

jQuery.param 风格编码，echo 回显 query

```js
show(await api.get(apiUrl('echo'), { params: { a: 1, b: '中文', arr: [1, 2], nested: { x: 1 } } }), 'params');
```

#### 24. params 字符串原样拼接

字符串不再二次编码

```js
show(await api.get(apiUrl('echo'), { params: 'a=1&b=2' }), 'params 字符串');
```

#### 25. params: URLSearchParams

走其 toString()，不会因遍历原型方法崩溃

```js
show(await api.get(apiUrl('echo'), { params: new URLSearchParams({ a: '1', c: '中文' }) }), 'URLSearchParams params');
```

#### 26. params: [{name,value}] 表单数组

jQuery 表单数组形态，按 name=value 拼接

```js
show(await api.get(apiUrl('echo'), { params: [{ name: 'a', value: 1 }, { name: 'c', value: '中文' }] }), '表单数组 params');
```

#### 27. paramsSerializer 自定义

完全接管序列化

```js
show(await api.get(apiUrl('echo'), { params: { a: 1, b: 2 }, paramsSerializer: function (p) { return Object.keys(p).map(function (k) { return k + '=' + p[k]; }).join('&'); } }), '自定义序列化');
```

#### 28. GET 的 data 自动降级为 params

仅纯对象生效

```js
show(await api.get(apiUrl('echo'), { data: { fromData: 1 } }), 'GET data → params');
```

#### 29. POST 对象自动 JSON 编码

自动补 content-type: application/json

```js
show(await api.post(apiUrl('echo'), { hello: 'world', n: 1 }), '自动 JSON');
```

#### 30. requestType: "query" 表单编码

content-type: application/x-www-form-urlencoded

```js
show(await api.post(apiUrl('echo'), { a: 1, b: '中文' }, { requestType: 'query' }), '表单编码');
```

#### 31. requestType: "json" + JSON 字符串

字符串是合法 JSON 时补 json 头

```js
show(await api.post(apiUrl('echo'), '{"raw":"json"}', { requestType: 'json' }), 'JSON 字符串');
```

#### 32. 原始字符串 body

不指定 requestType 时原样发送

```js
show(await api.post(apiUrl('echo'), 'plain text body'), '原始字符串');
```

#### 33. URLSearchParams 作为请求体

fetch 会自动设置表单头

```js
show(await api.post(apiUrl('echo'), new URLSearchParams({ k: 'v', c: '中文' })), 'URLSearchParams');
```

#### 34. ArrayBuffer / ReadableStream 作为请求体

二进制与流式 body 原样透传；ReadableStream 自动补 duplex:"half"（需浏览器支持流式上传）

```js
await grab(api.post(apiUrl('echo'), new TextEncoder().encode('hello-ab').buffer, { engine: 'fetch' }), 'ArrayBuffer body');
await grab(api.post(apiUrl('echo'), new ReadableStream({ start: function (c) { c.enqueue(new TextEncoder().encode('hello-stream')); c.close(); } }), { engine: 'fetch' }), 'ReadableStream body');
```

#### 35. FormData 上传

multipart/form-data，两引擎都走统一解析层

```js
show(await api.post(apiUrl('upload'), (function () { var fd = new FormData(); fd.append('name', 'bxf'); fd.append('file', new Blob(['hello']), 'a.txt'); return fd; })()), 'FormData');
```

#### 36. baseURL + 相对地址

末尾斜杠自动归一，不会拼出 //

```js
show(await api({ baseURL: location.origin, url: '/?api=json' }), 'baseURL');
```

#### 37. initUrl 也能当 URL 入参

对象形态下 initUrl 优先于 url

```js
show(await api({ initUrl: apiUrl('json'), responseType: 'text' }), 'initUrl');
```

#### 38. 绝对地址不受 baseURL 影响

isAbsoluteURL 判定后跳过拼接

```js
show(await api({ baseURL: 'http://wrong.example/', url: apiUrl('json') }), '绝对地址');
```


---

### ④ 请求头与凭据
> headers（对象 / Headers / 键值对数组）、auth、xsrf、cookie、重复响应头、CORS

#### 39. 自定义 headers（键名小写归一）

echo 里看规范化后的头

```js
show(await api.get(apiUrl('echo'), { headers: { 'X-Demo': 'abc', 'X-Trace': '1' } }), '自定义头');
```

#### 40. headers: new Headers()

原生 Headers 实例也支持，不再被静默丢弃

```js
show(await api.get(apiUrl('echo'), { headers: new Headers({ 'X-From-Headers': 'yes' }) }), 'Headers 实例');
```

#### 41. headers: [[k,v], ...] 键值对数组

第三种形态，同样小写归一

```js
show(await api.get(apiUrl('echo'), { headers: [['X-From-Array', 'yes'], ['X-Trace', '2']] }), '键值对数组');
```

#### 42. 用户 content-type 不被内置值覆盖

内置头只补缺

```js
show(await api.post(apiUrl('echo'), { a: 1 }, { headers: { 'Content-Type': 'application/vnd.my+json' } }), '用户 content-type 优先');
```

#### 43. auth 快捷写 Authorization

等价于 headers.authorization

```js
show(await api.get(apiUrl('echo'), { auth: 'Bearer abc123' }), 'auth');
```

#### 44. xsrfHeaderName + xsrfCookieName

从 document.cookie 取值注入请求头

```js
await (async () => {
  document.cookie = 'xsrf-token=abc123; Path=/';
  show(await api.get(apiUrl('echo'), { xsrfHeaderName: 'X-XSRF-TOKEN', xsrfCookieName: 'xsrf-token' }), 'XSRF');
})();
```

#### 45. 重复响应头合并成 "alpha, beta"

两引擎一致（WHATWG Headers 规范）

```js
show(await api.get(apiUrl('multiheader')), '重复头');
```

#### 46. Set-Cookie 与 credentials

resources 看响应的 set-cookie 处理

```js
show(await api.get(apiUrl('cookie'), { credentials: 'include' }), 'cookie');
```

#### 47. credentials 三态对照

same-origin / include / omit

```js
await cmp({ url: apiUrl('echo'), credentials: 'include' }, 'credentials=include');
```

#### 48. 跨源请求（专用端口 + CORS 头）

crossUrl 指向 PORT+1 的独立站点

```js
await grab(api.get(crossUrl('cors')), '跨源 cors');
```

#### 49. 跨源 + credentials: include

服务端带 Allow-Credentials + Allow-Origin 回显

```js
await grab(api.get(crossUrl('cors'), { credentials: 'include', mode: 'cors' }), '跨源带凭据');
```

#### 50. 跨源自定义头触发 OPTIONS 预检

服务端对 OPTIONS 直接回 204 + CORS

```js
await grab(api.get(crossUrl('echo'), { headers: { 'X-Demo': 'preflight' } }), '预检');
```


---

### ⑤ 响应契约与 responseType
> 全 8 种响应类型、charset、空体/204/304

#### 51. auto（默认）自动解析 JSON

非法 JSON 保留字符串，不抛异常

```js
show(await api.get(apiUrl('json'), { responseType: 'auto' }), 'auto');
```

#### 52. text 纯字符串

data 就是字符串，不再输出 raw 中间产物

```js
show(await api.get(apiUrl('text'), { responseType: 'text' }), 'text');
```

#### 53. json：非法 JSON 不抛异常

声明 application/json 但内容非法

```js
show(await api.get(apiUrl('badjson'), { responseType: 'json' }), '非法 JSON');
```

#### 54. blob

data 就是 Blob

```js
show(await api.get(apiUrl('binary'), { responseType: 'blob' }), 'blob');
```

#### 55. arraybuffer

适合二进制协议 / 解密

```js
show(await api.get(apiUrl('bytes', 'n=32'), { responseType: 'arraybuffer' }), 'arraybuffer');
```

#### 56. charset 覆盖响应头：解 GBK 页面（1688 场景）

响应头错写 utf-8 时，用 charset 覆盖才能解出中文

```js
await (async () => {
  var bad = await api.get(apiUrl('gbk-wrongct'), { responseType: 'text' });
  var fixed = await api.get(apiUrl('gbk-wrongct'), { responseType: 'text', charset: 'gbk' });
  console.log('默认（响应头说 utf-8）→', bad.data.slice(0, 26));
  console.log('text + charset:gbk →', fixed.data.slice(0, 26));
  show(fixed, 'GBK 正确解码');
})();
```

#### 57. document：HTML → Document

用 DOMParser 解析（无 DOMParser 环境降级为字符串）

```js
show(await api.get(apiUrl('html'), { responseType: 'document' }), 'document/html');
```

#### 58. document：XML → Document

按 content-type 选 mime

```js
show(await api.get(apiUrl('xml'), { responseType: 'document' }), 'document/xml');
```

#### 59. charset 自动从 content-type 提取

GBK 字节用 TextDecoder 解码

```js
show(await api.get(apiUrl('gbk'), { responseType: 'text' }), 'GBK 自动识别');
```

#### 60. charset 显式指定优先于响应头

强制按 utf-8 解 GBK 字节 → 乱码对照

```js
show(await api.get(apiUrl('gbk'), { responseType: 'text', charset: 'utf-8' }), '强制 utf-8');
```

#### 61. 空响应体（200）

data 为空字符串

```js
show(await api.get(apiUrl('empty')), '空体');
```

#### 62. 204 无响应体

WHATWG 限制由 createResponse 兜住

```js
show(await api.get(apiUrl('204')), '204');
```

#### 63. 304 无响应体

同样走 BODYLESS_STATUS 白名单

```js
await grab(api.get(apiUrl('304'), { cache: 'no-store' }), '304');
```

#### 64. 未知 responseType 降级为 auto

白名单外的值不会报错

```js
show(await api.get(apiUrl('json'), { responseType: 'whatever' }), '未知类型→auto');
```

#### 65. raw 模式：原生句柄的唯一入口

data 就是未消费的 Response，body 流从 data.body 取

```js
await (async () => {
  var r = await api.get(apiUrl('json'), { responseType: 'raw' });
  console.log('data instanceof Response →', r.data instanceof Response);
  console.log('data.bodyUsed =', r.data.bodyUsed, '| data.body 是流 →', typeof r.data.body.getReader === 'function');
  console.log('对外字段 =', Object.keys(r), '（固定 7 字段，无 raw / Response）');
  console.log('data.url =', r.data.url, '| data.redirected =', r.data.redirected);
  console.log('顶层 responseURL =', r.responseURL, '| redirected =', r.redirected);
  await r.data.body.cancel();
  show(r, 'raw');
})();
```

#### 66. 重定向：raw 拿最终 URL，双引擎一致（对齐 msw）

xhr.responseURL 已透传进 WHATWG Response

```js
await (async () => {
  var u = apiUrl('redirect', 'n=2');
  var f = await api.get(u, { engine: 'fetch', responseType: 'raw' });
  var x = await api.get(u, { engine: 'xhr', responseType: 'raw' });
  console.log('fetch →', f.data.url, '| redirected =', f.data.redirected);
  console.log('xhr   →', x.data.url, '| redirected =', x.data.redirected);
  console.log('一致 →', f.data.url === x.data.url && f.data.redirected === x.data.redirected);
  await Promise.all([f.data.body.cancel(), x.data.body.cancel()]);
})();
```

#### 67. 重定向：顶层 responseURL / redirected（不必切 raw）

config.url 是用户原始入参，responseURL 才是最终实际请求地址

```js
await (async () => {
  var u = apiUrl('redirect', 'n=2');
  var r = await api.get(u);
  console.log('config.url（原始入参）=', r.config.url);
  console.log('responseURL（最终地址）=', r.responseURL);
  console.log('redirected =', r.redirected);
  show(r, '重定向');
})();
```

#### 68. onlyData + resolveStatus 正交

两者互不影响

```js
show(await api.get(apiUrl('status', 'code=429'), { onlyData: true, resolveStatus: [200, 429] }), '组合');
```


---

### ⑥ resolveStatus 与错误响应
> 数字/数组/区间/函数规则、err.response 家族

#### 69. 规则：数字精确匹配

命中才 resolve

```js
await grab(api.get(apiUrl('status', 'code=429'), { resolveStatus: 200 }), '数字规则');
```

#### 70. 规则：数组=若干单一码

[200, 429] 表示「200 或 429」，不是区间

```js
show(await api.get(apiUrl('status', 'code=429'), { resolveStatus: [200, 429] }), '单码数组');
```

#### 71. 规则：区间 [[200, 300]] 左闭右开

299 命中，300 不命中

```js
console.log('299 →', (await grab(api.get(apiUrl('status', 'code=299'), { resolveStatus: [[200, 300]] }))).status,
  '| 300 →', (await grab(api.get(apiUrl('status', 'code=300'), { resolveStatus: [[200, 300]] }))).code);
```

#### 72. 规则：混合数字 / 区间 / 函数

数组内任一项命中即可；区间项是一层数组 [min,max]

```js
show(await api.get(apiUrl('status', 'code=418'), { resolveStatus: [200, [400, 500], function (s) { return s === 599; }] }), '混合规则');
```

#### 73. 规则：函数 (status, response) => boolean

第二个参数是完整 BxfResponse

```js
show(await api.get(apiUrl('status', 'code=429'), { resolveStatus: function (s, r) { console.log('函数收到', s, r.status, r.data.message); return s === 429; } }), '函数规则');
```

#### 74. 非法规则 → ERR_BAD_OPTION_VALUE

字符串 / 对象 / null 之外的类型不允许

```js
await grab(api.get(apiUrl('json'), { resolveStatus: '200' }), '非法规则');
```

#### 75. null / 不传 = 只要有响应就 resolve

包括 429 / 502

```js
show(await api.get(apiUrl('status', 'code=502'), { resolveStatus: null }), 'null 规则');
```

#### 76. err.response（小写）是整包 BxfResponse

业务体不丢；err.status 是顶层副本

```js
await (async () => {
  var e = await api.get(apiUrl('status', 'code=429'), { resolveStatus: 200 }).catch(function (x) { return x; });
  console.log('code =', e.code, '| err.status =', e.status, '| err.response.status =', e.response.status);
  console.log('err.response.data =', e.response.data);
  console.log('err.config === err.response.config →', e.config === e.response.config);
  console.log('err.response 字段 =', Object.keys(e.response));
  console.log('是否暴露原生句柄 →', 'Response' in e.response);
})();
```

#### 77. 对外不暴露原生 Response 句柄

BxfResponse 固定 7 字段；需要原生句柄请用 raw

```js
await (async () => {
  var r = await api.get(apiUrl('json'));
  console.log('Object.keys(res) =', Object.keys(r));
  console.log('是否暴露原生句柄 →', 'Response' in r);
  var raw = await api.get(apiUrl('json'), { responseType: 'raw' });
  console.log('raw.data instanceof Response →', raw.data instanceof Response);
  var c = raw.data.clone();
  console.log('clone().url =', c.url, '（url 会随 clone 转发）');
  await Promise.all([raw.data.body.cancel(), c.body.cancel()]);
})();
```

#### 78. 失败时 err.response 与成功 res 完全同形

都是 7 字段 BxfResponse，无大小写嵌套

```js
await grab(api.get(apiUrl('status', 'code=500'), { resolveStatus: [[200, 300]] }), '500 被拒');
```


---

### ⑦ 引擎与能力矩阵
> 显式引擎、自动选引擎、能力冲突、自定义引擎

#### 79. 显式 engine: "fetch"

meta.engine 看实际生效引擎

```js
meta(show(await api.get(apiUrl('json'), { engine: 'fetch' }), 'fetch'));
```

#### 80. 显式 engine: "xhr"

XHR 结果被构造成等价的 WHATWG Response

```js
meta(show(await api.get(apiUrl('json'), { engine: 'xhr' }), 'xhr'));
```

#### 81. 未指定引擎 → fetch 优先

两者都支持时默认 fetch

```js
meta(await api.get(apiUrl('json')));
```

#### 82. 双引擎同参数对照

字段集合、status、data 类型应完全一致

```js
await cmp({ url: apiUrl('json') }, 'json');
```

#### 83. 双引擎对照：中文 / 重复头 / 二进制

一次看三类容易不一致的场景

```js
await cmp({ url: apiUrl('multiheader'), responseType: 'arraybuffer' }, 'binary+headers');
```

#### 84. responseType:"stream" 自动切到 fetch

未指定引擎时按能力挑选

```js
meta(await api.get(apiUrl('sse', 'n=2&ms=60'), { responseType: 'stream' }));
```

#### 85. 进度回调自动切到 XHR

只要传了 onUpload/OnDownloadProgress

```js
meta(await api.get(apiUrl('large', 'kb=16&chunks=2&ms=10'), { onDownloadProgress: function () {} }));
```

#### 86. 能力互斥且未指定引擎 → ERR_UNSUPPORTED

stream 只有 fetch、进度只有 XHR，无法自动选

```js
await grab(api.get(apiUrl('sse', 'n=2&ms=20'), { responseType: 'stream', onDownloadProgress: function () {} }), '能力冲突');
```

#### 87. 显式 fetch + 进度 → ERR_UNSUPPORTED

不偷偷换引擎

```js
await grab(api.get(apiUrl('large', 'kb=16&chunks=2&ms=10'), { engine: 'fetch', onDownloadProgress: function () {} }), 'fetch 不支持进度');
```

#### 88. 显式 XHR + stream → ERR_UNSUPPORTED

同上

```js
await grab(api.get(apiUrl('sse', 'n=2&ms=20'), { engine: 'xhr', responseType: 'stream' }), 'XHR 不支持 stream');
```

#### 89. engine 传全局 fetch 函数

按函数名识别为 fetch 引擎

```js
show(await api.get(apiUrl('json'), { engine: window.fetch }), '传全局 fetch');
```

#### 90. nativeEngine: true 取 iframe 原生 API

MV3 核心能力：绕过网页对 fetch 的 hook

```js
await grab(api.get(apiUrl('json'), { nativeEngine: true }), 'iframe 原生 fetch');
```

#### 91. 自定义函数引擎（返回标准 Response）

自定义引擎仍走同一套统一解析层

```js
await grab(api({ url: apiUrl('json'), engine: async function (spec, request) {
  return new Response(JSON.stringify({ custom: true, method: request.method }),
    { status: 200, headers: { 'content-type': 'application/json' } });
} }), '自定义引擎');
```

#### 92. XHR 不支持的一等公民能力会 warn

mode/cache/referrer 等被忽略而不是静默，看控制台警告

```js
show(await api.get(apiUrl('json'), { engine: 'xhr', mode: 'cors', cache: 'no-store', keepalive: true }), 'XHR 能力 warn');
```


---

### ⑧ 上传 / 下载进度
> XHR 专属能力，未指定引擎时自动切换

#### 93. onDownloadProgress

自动切到 XHR，事件对象原生 ProgressEvent

```js
show(await api.get(apiUrl('large', 'kb=64&chunks=8&ms=40'), {
  onDownloadProgress: function (e) { if (e.lengthComputable) console.log('下载', e.loaded + '/' + e.total); }
}), '下载进度');
```

#### 94. onUploadProgress

POST 一个较大的 body 才看得到分片

```js
show(await api.post(apiUrl('upload'), 'x'.repeat(128 * 1024), {
  onUploadProgress: function (e) { if (e.lengthComputable) console.log('上传', e.loaded + '/' + e.total); }
}), '上传进度');
```

#### 95. 两个进度回调同时用

都属于 XHR 专属能力

```js
meta(await api.post(apiUrl('upload'), 'y'.repeat(64 * 1024), {
  onUploadProgress: function (e) { console.log('↑', e.loaded); },
  onDownloadProgress: function (e) { console.log('↓', e.loaded); }
}));
```

#### 96. 进度能力 + 显式 engine: "xhr"

显式指定且能力匹配时正常执行

```js
show(await api.get(apiUrl('large', 'kb=16&chunks=2&ms=10'), { engine: 'xhr', onDownloadProgress: function (e) { console.log('progress', e.loaded); } }), '显式 XHR 进度');
```

#### 97. 进度回调与 resolveStatus 组合

进度不影响状态码判定

```js
await grab(api.get(apiUrl('status', 'code=429'), { resolveStatus: 200, onDownloadProgress: function () {} }), '进度 + 状态拒绝');
```


---

### ⑨ 流式与流中转
> SSE / onStream / raw 流中转 / 边下边传

#### 98. responseType: "stream" 按帧读取

无 onStream 时 data 是完整帧原文数组（含注释帧 / 尾帧）

```js
show(await api.get(apiUrl('sse', 'n=3&ms=80'), { responseType: 'stream' }), 'SSE 帧');
```

#### 99. onStream 一帧一回调 + 二选一

有回调时只回调不累积，res.data 恒为 []

```js
await (async () => {
  var frames = [];
  var r = await api.get(apiUrl('sse', 'n=4&ms=100'), {
    responseType: 'stream',
    onStream: function (frame) { frames.push(frame); console.log('frame →', frame.slice(0, 48)); }
  });
  console.log('有回调时 res.data =', r.data, '| 自己收到', frames.length, '帧');
  show(r, 'onStream');
})();
```

#### 100. stream 必须走 fetch（自动选择）

meta.engine 应为 fetch

```js
meta(await api.get(apiUrl('sse', 'n=2&ms=40'), { responseType: 'stream' }));
```

#### 101. raw 模式自己读 reader

不消费响应体，完全由调用方掌控

```js
await (async () => {
  var r = await api.get(apiUrl('slowchunks', 'n=6&ms=100'), { responseType: 'raw' });
  var reader = r.data.body.getReader(), dec = new TextDecoder(), text = '';
  for (;;) { var x = await reader.read(); if (x.done) break; text += dec.decode(x.value, { stream: true }); }
  console.log('自行读取完成：', text.trim());
})();
```

#### 102. 代理下载：边下边传

把响应流直接接到上传请求体，不落盘不缓冲

```js
await (async () => {
  var r = await api.get(apiUrl('slowchunks', 'n=6&ms=80'), { responseType: 'raw' });
  var up = await fetch(apiUrl('upload'), { method: 'POST', body: r.data.body, duplex: 'half' });
  show(await up.json(), '上传回显');
})();
```

#### 103. raw + timeout：长流不被掐断

timeout 只覆盖到「引擎交出响应」为止

```js
await (async () => {
  var r = await api.get(apiUrl('slowchunks', 'n=8&ms=120'), { responseType: 'raw', timeout: 200 });
  var text = await r.data.text();
  console.log('拿到响应头后仍能读完整个流，字节数 =', text.length);
})();
```

#### 104. stream + timeout 会覆盖整个读取过程

需要读完流才交出响应，因此可能 ETIMEDOUT

```js
await grab(api.get(apiUrl('sse', 'n=8&ms=120'), { responseType: 'stream', timeout: 200 }), 'stream 超时');
```


---

### ⑩ 超时与取消
> timeout、signal、AbortController、长流不被掐断

#### 105. timeout 命中 → ETIMEDOUT

服务端延迟 600ms，客户端只给 120ms

```js
await grab(api.get(apiUrl('delay', 'ms=600'), { timeout: 120 }), '超时');
```

#### 106. timeout 未命中正常返回

可清除的 setTimeout，不会留下悬挂定时器

```js
show(await api.get(apiUrl('delay', 'ms=80'), { timeout: 2000 }), '未超时');
```

#### 107. signal + AbortController → ERR_CANCELED

主动取消

```js
await (async () => {
  var c = new AbortController();
  var p = api.get(apiUrl('delay', 'ms=800'), { signal: c.signal });
  c.abort();
  await grab(p, '主动取消');
})();
```

#### 108. 延迟取消（已经发出去的请求）

sleep 后再 abort

```js
await (async () => {
  var c = new AbortController();
  var p = api.get(apiUrl('delay', 'ms=800'), { signal: c.signal });
  await sleep(100); c.abort();
  await grab(p, '延迟取消');
})();
```

#### 109. AbortSignal.timeout 作为外部 signal

reason.name=TimeoutError → 映射 ETIMEDOUT

```js
await grab(api.get(apiUrl('delay', 'ms=600'), { signal: AbortSignal.timeout(120) }), '外部超时信号');
```

#### 110. timeout 与 signal 合并取最先触发者

anySignal 透传触发源的 reason

```js
await (async () => {
  var c = new AbortController();
  var p = api.get(apiUrl('delay', 'ms=800'), { timeout: 3000, signal: c.signal });
  await sleep(100); c.abort();
  await grab(p, '合并信号');
})();
```


---

### ⑪ 拦截器与前置钩子
> request/response 顺序、rejected、eject/clear、beforeInterceptors

#### 111. request 拦截器加请求头

收到的是 RequestSpec，改 spec.headers 生效

```js
await (async () => {
  var x = instance({});
  x.interceptors.request.use(function (spec) { spec.headers['x-demo'] = 'from-request'; return spec; });
  show(await x.get(apiUrl('echo')), 'request.use');
})();
```

#### 112. request 拦截器「后添加先执行」

栈顺序，打印执行次序

```js
await (async () => {
  var x = instance({}), order = [];
  x.interceptors.request.use(function (s) { order.push('A'); return s; });
  x.interceptors.request.use(function (s) { order.push('B'); return s; });
  await x.get(apiUrl('json'));
  console.log('执行顺序 →', order.join(' → '), '（应为 B → A）');
})();
```

#### 113. response 拦截器改写 data

resolveStatus / onlyData 在其之后仍生效

```js
await (async () => {
  var x = instance({});
  x.interceptors.response.use(function (r) { r.data = Object.assign({}, r.data, { intercepted: true }); return r; });
  show(await x.get(apiUrl('json')), 'response.use');
})();
```

#### 114. response 拦截器「先添加先执行」

队列顺序

```js
await (async () => {
  var x = instance({}), order = [];
  x.interceptors.response.use(function (r) { order.push('A'); return r; });
  x.interceptors.response.use(function (r) { order.push('B'); return r; });
  await x.get(apiUrl('json'));
  console.log('执行顺序 →', order.join(' → '), '（应为 A → B）');
})();
```

#### 115. rejected 处理器捕获错误

x.interceptors.response.use(null, fn)

```js
await (async () => {
  var x = instance({});
  x.interceptors.response.use(null, function (err) { console.log('拦截到错误 →', err.code); throw err; });
  await grab(x.get('http://127.0.0.1:1/nope'), 'rejected handler');
})();
```

#### 116. eject / clear 移除拦截器

use 返回索引 id

```js
await (async () => {
  var x = instance({});
  var id = x.interceptors.request.use(function (s) { s.headers['x-temp'] = '1'; return s; });
  console.log('第一次 headers.x-temp =', (await x.get(apiUrl('echo'))).data.headers['x-temp']);
  x.interceptors.request.eject(id);
  console.log('eject 后 headers.x-temp =', (await x.get(apiUrl('echo'))).data.headers['x-temp']);
  x.interceptors.request.clear();
})();
```

#### 117. beforeInterceptors 返回 false 终止

BEFORE_TERMINATE，请求不会发出

```js
await grab(api({ url: apiUrl('json'), beforeInterceptors: function (spec) {
  console.log('before 收到 spec:', spec.method, spec.url);
  return false;
} }), 'BEFORE_TERMINATE');
```

#### 118. beforeInterceptors 返回 Promise

支持异步前置（例如先取 token）

```js
show(await api({ url: apiUrl('echo'), beforeInterceptors: async function (spec) {
  spec.headers['x-async'] = 'ready';
  return true;
} }), '异步前置');
```

#### 119. 响应拦截器替换对象后仍补挂元数据

展开对象仍保留 engine 元数据

```js
await (async () => {
  var x = instance({});
  x.interceptors.response.use(function (r) { return Object.assign({}, r); });
  meta(await x.get(apiUrl('json')));
})();
```


---

### ⑫ 配置快照与重放
> res.config / err.config 回喂、外部重放、可序列化

#### 120. 成功响应 res.config 可直接回喂

扁平纯数据，url 未拼接、data 未编码

```js
await (async () => {
  var r = await api.get(apiUrl('json'), { headers: { 'X-A': '1' } });
  console.log('config =', r.config);
  show(await api(r.config), '回喂 config');
})();
```

#### 121. 失败响应 err.config 同样可回喂

token 过期重试的前提

```js
await (async () => {
  var e = await api.get(apiUrl('status', 'code=401'), { resolveStatus: 200 }).catch(function (x) { return x; });
  console.log('err.config =', e.config);
  show(await api(Object.assign({}, e.config, { resolveStatus: 401 })), '失败后重放');
})();
```

#### 122. 模拟 token 过期重试（完整流程）

库不自动重放，由你的代码决定何时再发

```js
await (async () => {
  var token = 'expired';
  var cfg = { url: apiUrl('echo'), headers: { Authorization: 'Bearer ' + token } };
  var e = await api(cfg).then(null, function (x) { return x; });
  console.log('首次结果 →', e.status, e.data.headers.authorization);
  // 业务判断：401 就刷新 token 后用同一份 config 再发一次
  var r = await api(Object.assign({}, cfg, { headers: { Authorization: 'Bearer fresh' } }));
  console.log('重放后 Authorization →', r.data.headers.authorization);
})();
```

#### 123. 同一份 config 换参数再发一次

重放完全由调用方发起，库不提供 retry() 糖

```js
await (async () => {
  var r = await api.get(apiUrl('json'), { responseType: 'text' });
  console.log('第一次 data 类型 =', typeOf(r.data));
  var r2 = await api(Object.assign({}, r.config, { responseType: 'auto' }));
  console.log('重放后 data 类型 =', typeOf(r2.data), '| config.url =', r2.config.url);
})();
```

#### 124. 响应不再挂 raw / retry / retryCount

唯一不可枚举元数据是 engine

```js
await (async () => {
  var r = await api.get(apiUrl('json'));
  console.log('Object.keys(res) =', Object.keys(r));
  console.log('raw / retry / retryCount 存在 →', 'raw' in r, typeof r.retry, r.retryCount);
  console.log('engine =', r.engine, '| 可枚举 =', Object.keys(r).includes('engine'));
  var e = await api.get(apiUrl('status', 'code=429'), { resolveStatus: 200 }).catch(function (x) { return x; });
  console.log('err.engine =', e.engine, '| err.retry =', e.retry);
})();
```

#### 125. 失败后用 err.config 手动重放

何时重试、重试几次全由业务代码决定

```js
await (async () => {
  var e = await api.get(apiUrl('status', 'code=429'), { resolveStatus: 200 }).catch(function (x) { return x; });
  var r = await api(Object.assign({}, e.config, { resolveStatus: 429 }));
  console.log('重放 status =', r.status, '| engine =', r.engine);
  show(r, '手动重放');
})();
```

#### 126. config 可 JSON.stringify / postMessage

不含 signal / cleanup / 函数等运行态

```js
await (async () => {
  var r = await api.get(apiUrl('json'), { params: { a: 1 }, timeout: 1000 });
  console.log('JSON →', JSON.stringify(r.config));
  console.log('是否含 signal →', 'signal' in r.config, '| 是否含 cleanup →', 'cleanup' in r.config);
})();
```

#### 127. 元数据不可枚举，不污染 Object.keys

engine 隐藏；JSON 里只含固定 7 字段

```js
await (async () => {
  var r = await api.get(apiUrl('json'));
  console.log('Object.keys(res) =', Object.keys(r));
  console.log('JSON.stringify 里的键 =', Object.keys(JSON.parse(JSON.stringify(r))));
})();
```


---

### ⑬ 一等公民与逃生舱
> fetchOptions/xhrOptions/rawFields、mode/redirect/cache 等

#### 128. fetchOptions 透传非保护字段

如 priority；核心字段 method/headers/body 不可覆盖

```js
show(await api.get(apiUrl('json'), { fetchOptions: { priority: 'high', method: 'DELETE' } }), 'fetchOptions');
```

#### 129. xhrOptions 透传自定义属性

保护键（timeout/withCredentials/...）会被跳过

```js
show(await api.get(apiUrl('json'), { engine: 'xhr', xhrOptions: { labFlag: 'hello', responseType: 'text' } }), 'xhrOptions');
```

#### 130. rawFields 按最终引擎分流

fetch 分流到 fetchOptions，XHR 分流到 xhrOptions

```js
await cmp({ url: apiUrl('json'), rawFields: { labRaw: 1 } }, 'rawFields');
```

#### 131. mode: "cors" / "no-cors" 对照

no-cors 会得到 opaque 响应（status 0）

```js
console.log('cors →', (await api.get(apiUrl('json'), { mode: 'cors' })).status,
  '| no-cors →', (await api.get(apiUrl('json'), { mode: 'no-cors' })).status);
```

#### 132. redirect: "follow" 默认跟随

302 链走到最终 JSON

```js
show(await api.get(apiUrl('redirect', 'n=2')), 'follow');
```

#### 133. redirect: "manual" 拿到 opaqueredirect

浏览器返回 status 0 的 opaque 响应

```js
await grab(api.get(apiUrl('redirect', 'n=1'), { redirect: 'manual' }), 'manual redirect');
```

#### 134. cache / referrerPolicy / keepalive

一等公民能力，直接透传到 RequestInit

```js
show(await api.get(apiUrl('json'), { cache: 'no-store', referrerPolicy: 'no-referrer', keepalive: true }), '一等公民');
```

#### 135. integrity 不匹配会导致请求失败

SRI 校验由浏览器执行

```js
await grab(api.get(apiUrl('json'), { integrity: 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }), 'SRI 不匹配');
```

#### 136. credentials: "omit" / "same-origin" / "include"

三种取值都能跑通

```js
await (async () => {
  for (var c of ['omit', 'same-origin', 'include']) {
    console.log(c, '→', (await api.get(apiUrl('echo'), { credentials: c })).status);
  }
})();
```

#### 137. responseType + charset + resolveStatus 组合

多参数叠加互不干扰

```js
show(await api.get(apiUrl('gbk'), { responseType: 'text', charset: 'gbk', resolveStatus: 200, onlyData: false }), '组合');
```


---

### ⑭ 错误码全景
> 各 code 的可复现触发方式与速查表

#### 138. 错误码速查表

全部 BxfError.code

```js
console.table(BXF_CODES);
```

#### 139. ERR_NETWORK：断网 / 端口不通 / 跨域被拦

causeName=TypeError

```js
await grab(api.get('http://127.0.0.1:1/nope'), 'ERR_NETWORK');
```

#### 140. ETIMEDOUT：超时

可清除定时器触发

```js
await grab(api.get(apiUrl('delay', 'ms=500'), { timeout: 100 }), 'ETIMEDOUT');
```

#### 141. ERR_CANCELED：主动取消

AbortController.abort()

```js
await (async () => { var c = new AbortController(); var p = api.get(apiUrl('delay', 'ms=500'), { signal: c.signal }); c.abort(); await grab(p, 'ERR_CANCELED'); })();
```

#### 142. ERR_HTTP_STATUS：状态码被拒

唯一会带 err.response 的常见错误

```js
await grab(api.get(apiUrl('status', 'code=503'), { resolveStatus: [[200, 300]] }), 'ERR_HTTP_STATUS');
```

#### 143. ERR_UNSUPPORTED：能力不匹配

显式引擎与所需能力冲突

```js
await grab(api.get(apiUrl('sse', 'n=2&ms=20'), { engine: 'xhr', responseType: 'stream' }), 'ERR_UNSUPPORTED');
```

#### 144. ERR_BAD_OPTION_VALUE：配置类型非法

resolveStatus 传字符串

```js
await grab(api.get(apiUrl('json'), { resolveStatus: {} }), 'ERR_BAD_OPTION_VALUE');
```

#### 145. BEFORE_TERMINATE：前置钩子终止

beforeInterceptors 返回 false

```js
await grab(api({ url: apiUrl('json'), beforeInterceptors: function () { return false; } }), 'BEFORE_TERMINATE');
```

#### 146. ERR_INVALID_URL：URL 无法构造 Request

catch 后统一包装

```js
await grab(api({ url: 'http://[' }), 'ERR_INVALID_URL');
```

#### 147. 统一取值写法（有无响应都能安全读）

err.response 存在与否先判断；配置数组串行发起，避免未处理的 Promise

```js
await (async () => {
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
})();
```
<!-- CASES:END -->

---

## FAQ

**Q：为什么 `responseType:'stream'` 用 XHR 会报错，而不是降级成一次性读取？**
A：能力不对等就不做模拟。要么去掉显式引擎让库自动选 fetch，要么改用 `raw` 自己读 `ReadableStream`。

**Q：token 过期了怎么重试？库会自动重放吗？**
A：不会。`err.config` / `res.config` 是扁平可回喂配置，你在业务代码里刷新 token 后自己再调一次 `bxf({ ...config, headers: {...} })`。库没有 `retry()` / `retryCount`，重试次数与时机由你自己的循环 / 计数控制；嵌套的 `headers`、`params` 记得展开，避免浅覆盖丢字段。

**Q：`config` 能跨 context 传吗（postMessage / 存储）？**
A：能。它是纯数据，不含 `signal`、`cleanup`、函数；唯一不可枚举元数据 `engine` 挂在响应对象上，不会混进 `config`。

**Q：Service Worker 里能用 `responseType:'document'` 吗？**
A：没有 `DOMParser` 时会明确降级为字符串并输出一次警告，不会抛异常。字节解码用 `TextDecoder` 而不是 `FileReader`。

**Q：`nativeEngine` 什么时候需要？**
A：MV3 内容脚本里网页可能 hook 了 `window.fetch` / `XMLHttpRequest`。开启后通过 `about:blank` iframe 取一份原生 API；Service Worker 没有 `document`，会直接使用全局引用。

**Q：把 `show(await api.get(apiUrl('json')))` 贴到任意网页控制台，报 `show is not defined`？**
A：`show` / `apiUrl` / `api` / `grab` / `inspect` / `cmp` / `probeAll` 是**实验室页面**加载 `examples/playground/toolkit.js` 后挂到 `window` 的工具，不是 bxf 库自带的全局。必须先按上文「30 秒部署测试环境」构建 + 起服务，并在 `http://127.0.0.1:7788/` 这个页面的控制台里执行。普通项目里直接用 `bxf(...)` 再 `console.log(res)` 即可。

**Q：`api.delete(url, data, config)` 为什么没发出请求体？**
A：`delete` / `head` / `options` 是「无 data 位置」的快捷方法，签名只有 `(url, config)`，第三个参数会被忽略（`data` 被当成 config 合并，容易踩坑）。DELETE 带体请写 `api.delete(url, { data: {...} })`，或用完整形态 `api({ url, method: 'delete', data: {...} })`；只有 `post` / `put` / `patch` 是 `(url, data, config)`。底层 normalizeRequest 本身对所有非 GET/HEAD method 都允许 body。

**Q：GET 传 `data: { q: 1 }` 会怎样？**
A：GET/HEAD 按规范不能有 body，纯对象 `data` 自动降级为 `params`（URL 变成 `?q=1`），字符串等其它类型会被忽略；两种情况都**不会**附带 `content-type: application/json`。想显式控制请用 `params`。

**Q：请求拦截器里忘了 `return config` 会怎样？**
A：会拿到明确的 `ERR_BAD_OPTION_VALUE`（提示「请求拦截器必须返回配置对象」），而不是误导性的 `ERR_NETWORK` / `ERR_INVALID_URL`。另外 `interceptors.response.eject(id)` 之后剩余拦截器仍会正常执行。

**Q：请求拦截器返回一个全新对象时，`res.config` 里有什么？**
A：是**拦截器修改后**的纯数据快照（含新增的 `headers` / `url` 等），已剔除 `signal` / `cleanup` / `abort` 等运行时字段，可直接 `bxf(res.config)` 回喂、也能 `JSON.stringify`。多个并发请求共用同一个配置对象时，每次请求的控制信号彼此独立，不会串扰。

**Q：`data` / `params` 里有循环引用会怎样？**
A：`deepMerge` 递归展开配置时检测到循环会栈溢出，最终以 `BxfError`（`ERR_UNKNOWN`，message 含 `Maximum call stack size exceeded`）**rejected Promise** 返回，不会同步抛错、不会崩进程。这是已知边界：请求数据必须可序列化，传 `FormData` / `Blob` / `ArrayBuffer` 请用原生对象而非自造循环结构。

---

## 版本与破坏性变更

### 本次增量（1.2.0 之后，尚未发版）

- **新增响应字段 `responseURL` / `redirected`**，BxfResponse 由 5 字段变为 **7 字段** `{data, status, statusText, headers, config, responseURL, redirected}`；做 `Object.keys(res)` 深比较 / 全量序列化的调用方需同步。
- `responseURL` 取 `Response.url`（XHR 由 `xhr.responseURL` 透传），为空时回退到绝对化的 `Request.url`；`redirected` 只在有真实 `Response.url` 时可信，其余场景明确为 `false`。
- `res.config.url` 仍是用户原始入参，与 `res.responseURL` 不可混用；回喂请用 `bxf(res.config)`。
- `examples/debug-server.mjs` 的 `/mock` 新增 `redirect=<n>`，调试台可直接实测重定向链。

当前 `package.json` 版本 `1.2.0`。以下是 `1.2.0` 相对 `1.1.x` 的**破坏性变更**（从旧版升级时请逐条对照）：

- **移除对外的原生句柄字段 `Response`**，需要原生 WHATWG `Response` 时改用 `responseType:'raw'`（`data` 即未消费句柄）。
- **移除响应字段 `raw`**，BxfResponse 从 6 字段收敛为 **5 字段** `{data, status, statusText, headers, config}`；`raw` 模式的 body 流改从 `data.body` 取，`stream` 改为帧级：原始帧由 `onStream(frame)` 逐帧给出（无 `onStream` 时 `res.data` 为帧原文数组、有 `onStream` 时 `res.data` 恒为 `[]`），不再解析 `data:` 字段、不再 `JSON.parse`。
- **移除 `responseType:'blobtext'`**，GBK 等乱码修复统一用 `responseType:'text'` + `charset:'gbk'`（引擎边界统一后 `text` 已能按 charset 正确解码，与 `blobtext` 完全等价）。
- **`onStream` 回调签名 `(msg, chunk)` → `(frame)` 单参**：旧的 `msg` 解析值已不存在，回调只给原始帧文本；`res.data` 由「消息数组」变为「帧原文数组（无 `onStream`）/ 空数组（有 `onStream`）」，二选一、不重复累积。
- **移除 `res.retry()` / `err.retry()` 与 `retryCount` 元数据**，重放一律由调用方 `bxf(config)` 发起；唯一保留的不可枚举元数据是 `engine`。
- **`charset` 显式指定优先于响应头**（此前被 `content-type` 覆盖，导致响应头错写 utf-8 的 GBK 页面无法修复乱码）；不传时行为不变。
- XHR 适配器按 `@mswjs/interceptors` 的 `FetchResponse.setUrl()` 方案补齐 `Response.url` / `redirected`（读取 `xhr.responseURL`），raw 模式下双引擎元信息一致。
- `original` / `request` / `rawResponse` 等冗余字段已移除。
- `onlyDataHttpStatus` / `onlyDataStatus` 合并为 `resolveStatus`，且默认语义改为「只要拿到响应就 resolve」。
- `resolveStatus` 区间必须写成嵌套数组 `[[200, 300]]`；顶层 `[200, 300]` 表示两个单一码。

---

## 目录

```
src/
  core/           bxf / normalizeRequest / normalizeResponse / httpMessage / BxfError / abortController / dispatchRequest / createClient
  engines/        fetchEngine / xhrEngine          ← 差异全在这里
  interceptors/   interceptorManager / dispatchWithInterceptors
  utils/          queryEncode / 统一层工具
examples/
  playground/     server.mjs / toolkit.js / cases.mjs / gen-readme.mjs / verify-cases.mjs
                  ← Node 控制台实验室（147 案例 / 跨源 CORS / 公共函数工具库 / 案例自检）
  debug-server.mjs / debug.html   ← 通用 Mock 调试台（/mock 任意 method + 文件上传/流/任意响应 + 案例库）
  response-access.mjs   响应字段对照可运行示例
  bxf-debug.php         旧版单文件 PHP 调试页（备用）
test/
  consistency.test.mjs   双引擎一致性黑盒测试（58 项）
  retry-stream.test.mjs  raw 流中转 / 配置重放（30 项）
  boundary.test.mjs      边界与回归（23 项：配置形态 / 拦截器 / 钩子 / 定时器泄漏）
  stress.test.mjs        并发压力与边界 fuzz（22 项：500 并发 / 资源泄漏 / 真实 HTTP 200 并发 / 畸形配置矩阵）
  large-body.test.mjs    大请求体 / 10MB 上传 / 20MB 下载 / 大帧 SSE（14 项，逐字节 checksum + 内存白盒计数器）
```

## License

Apache-2.0
