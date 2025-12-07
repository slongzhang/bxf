# 📦 bxf

**bxf** 是一个基于 `Promise` 的轻量级网络请求库，兼容 **浏览器网页 / 浏览器扩展（Manifest V3）**，支持：

* ✔ 自动选择 `fetch` 或 `XMLHttpRequest`
* ✔ 可选使用浏览器原生 API（突破被网页环境 Hook 的风险）
* ✔ 完全可配置请求与响应拦截器
* ✔ 支持取消请求 / 超时
* ✔ 支持上传与下载进度监听
* ✔ 支持 `beforeInterceptors` 请求前终止机制
* ✔ 支持 `onlyData` 模式：自动返回 data
* ✔ 支持 params 序列化、JSON/FORM 编码
* ✔ 支持 blobText、arraybuffer、document 等多种响应类型
* ✔ 更适配 **MV3 扩展 Service Worker** 的特殊环境

---

# 📥 安装

```bash
npm install bxf
# 或
pnpm add bxf
# 或
yarn add bxf
```

浏览器直接引入（IIFE）：

```html
<script src="https://unpkg.com/bxf"></script>
<script>
  bxf.get("/api/demo");
</script>
```

---

# 🚀 快速开始

```js
import bxf from "bxf";

bxf.get("/api/user").then(res => {
  console.log(res.data);
});
```

POST 示例：

```js
bxf.post("/api/login", { username: "test", password: "123456" })
  .then(res => console.log(res.data));
```

---

# ⚙ 创建实例

```js
const api = bxf.create({
  baseURL: "https://api.example.com",
  timeout: 8000,
  headers: {
    "X-App": "bxf-demo"
  }
});

api.get("user/info");
```

实例不共享默认配置（类似 Axios）。

---

# 🧭 配置说明（Config）

| 字段                 | 类型           | 说明                        |           |            |                |      |
| ------------------ | ------------ | ------------------------- | --------- | ---------- | -------------- | ---- |
| url                | string       | 请求地址                      |           |            |                |      |
| method             | string       | GET/POST/PUT...           |           |            |                |      |
| baseURL            | string       | 基础 URL                    |           |            |                |      |
| params             | object       | URL 查询参数                  |           |            |                |      |
| data               | any          | 请求体                       |           |            |                |      |
| requestType        | "json"      | "query"                  | 自动编码 data |            |                |      |
| responseType       | "json"      | "text"                    | "blob"    | "blobtext" | "arraybuffer"` | 返回类型 |
| headers            | object       | 自定义请求头                    |           |            |                |      |
| timeout            | number       | 超时(ms)，基于 abortController |           |            |                |      |
| beforeInterceptors | function     | 请求前钩子，可终止请求               |           |            |                |      |
| onlyData           | boolean      | 返回 data                   |           |            |                |      |
| onlyDataStatus     | string/array | 成功状态范围，默认 `"200,300"`     |           |            |                |      |
| nativeEngine       | boolean      | 强制使用浏览器原生 fetch/XHR       |           |            |                |      |
| onUploadProgress   | function     | 上传进度回调                    |           |            |                |      |
| onDownloadProgress | function     | 下载进度回调                    |           |            |                |      |

---

# 📌 请求方法

```js
bxf.get(url, config)
bxf.post(url, data, config)
bxf.put(url, data, config)
bxf.patch(url, data, config)
bxf.delete(url, config)
bxf.head(url, config)
bxf.options(url, config)
bxf.request(config)
```

---

# 📚 使用示例

---

## 1️⃣ GET + params

```js
bxf.get("/search", {
  params: {
    q: "test",
    page: 1
  }
});
```

请求 URL：

```
/search?q=test&page=1
```

---

## 2️⃣ POST JSON

```js
bxf.post("/user/create", {
  name: "Tom",
  age: 20
});
```

Content-Type: `application/json`

---

## 3️⃣ POST 表单编码（x-www-form-urlencoded）

```js
bxf.post("/login", {
  user: "aaa",
  pass: "bbb"
}, {
  requestType: "query"
});
```

---

## 4️⃣ 自定义 params 序列化

```js
bxf.get("/filter", {
  params: { tag: ["a", "b"] },
  paramsSerializer: p => new URLSearchParams(p).toString()
});
```

---

## 5️⃣ 响应类型示例

### JSON 自动解析

```js
bxf.get("/json", { responseType: "json" });
```

### text

```js
bxf.get("/html", { responseType: "text" });
```

### blob 下载

```js
bxf.get("/file", { responseType: "blob" })
  .then(res => saveAs(res.data, "file.bin"));
```

### blob 转 text（自动处理编码）

```js
bxf.get("/log", { responseType: "blobtext" });
```

---

# 🧩 拦截器（Interceptors）

## 请求拦截器

```js
bxf.interceptors.request.use(config => {
  config.headers["X-Token"] = "123";
  return config;
});
```

## 响应拦截器

```js
bxf.interceptors.response.use(
  res => res, 
  err => {
    console.error("请求失败：", err);
    return Promise.reject(err);
  }
);
```

## 移除拦截器

```js
const id = bxf.interceptors.request.use(fn);
bxf.interceptors.request.eject(id);
```

---

# 🛑 beforeInterceptors —— 请求前终止

```js
bxf("/api/test", {
  beforeInterceptors(config) {
    if (!config.headers.token) return false;
  }
}).catch(err => {
  console.log(err.code === "BEFORE_TERMINATE"); // true
});
```

---

# ⏳ 取消请求 / 超时控制

bxf 内置 abortController。

## 主动取消

```js
const controller = new AbortController();

bxf.get("/slow", { signal: controller.signal });

controller.abort("User canceled");
```

## 设置超时（ms）

```js
bxf.get("/slow", { timeout: 3000 })
  .catch(err => console.log(err.code)); // ECONNABORTED
```

---

# 📤 上传与 📥 下载进度 (必须使用 XHR)

```js
bxf.post("/upload", formData, {
  onUploadProgress(e) {
    console.log("上传:", e.loaded / e.total);
  }
});
```

```js
bxf.get("/bigfile", {
  onDownloadProgress(e) {
    console.log("下载:", e.loaded);
  }
});
```

---

# 🛡 浏览器扩展 MV3 支持

Manifest V3（Service Worker）环境：

* 没有 window/document
* fetch/XHR 可能被网页 hook 覆盖
* bxf 支持使用 **原生引擎**

## 强制使用浏览器原生 fetch / xhr

```js
bxf.get(url, {
  nativeEngine: true
});
```

适用场景：

* 网页 hook 了 fetch()
* 网页劫持 XMLHttpRequest
* 内容脚本需要隔离请求环境

在 Service Worker 中（无 document）也能正常运行。

---

# 🎯 onlyData 模式

只返回 data，不返回其他字段：

```js
bxf.get("/user/info", { onlyData: true });
```

## 自定义成功状态

```js
bxf.get("/user/info", {
  onlyData: true,
  onlyDataStatus: ["200,300", 304]
});
```

---

# 🎛 自定义原始 fetch/xhr 字段（rawFields）

```js
bxf.get("/test", {
  rawFields: {
    withCredentials: true
  }
});
```

---

# 📦 并发工具

```js
bxf.all([
  bxf.get("/a"),
  bxf.get("/b")
]).then(bxf.spread((resA, resB) => {
  console.log(resA.data, resB.data);
}));
```

---

# ❓ FAQ

### ❓ 为什么在 MV3 扩展里 fetch 跨域失败？

请在 manifest 中声明：

```json
"host_permissions": ["https://*/*"]
```

---

### ❓ responseType: "json" 会抛异常吗？

不会，如果服务端返回文本但 JSON 解析失败，会保持为字符串。

---

### ❓ 如何避免被网页覆盖的 fetch/XHR？

使用：

```js
nativeEngine: true
```

---

# 参考项目
感谢以下开源项目为本项目提供的思路和代码参考
- [developit/redaxios](https://github.com/developit/redaxios)
- [axios/axios](https://github.com/axios/axios)
- [jquery/jquery](https://github.com/jquery/jquery)

---

# 📝 License

Apache-2.0
Copyright © **slongzhang**

---
