
# bxf(browser xhr and fetch)

bxf 是一款针对浏览器封装的多功能请求库，封装了 XHR 和 Fetch，以实现对 HTTP 请求的无缝处理。它能智能适应不同的环境，自动识别并支持各种请求类型。除了常规的网页请求外，它还特别设计以与使用 manifest_version: 3 的浏览器扩展无缝集成。这确保在现代 Web 开发环境中实现完美兼容性和最佳性能

## 安装

Use npm:
```bash
npm i bxf -S
```

Use yarn:

```bash
yarn add bxf
```

Use unpkg CDN:

```html
<script src="https://unpkg.com/bxf"></script>
```

## Examples
Use es6 module:

```javascript
import bxf from 'bxf';
bxf('/url').then(res => console.log(res));
```

Use commonJs:

```javascript
const bxf = require('bxf');
bxf('/url').then(res => console.log(res));
```
Use link:

```html
<script src="https://unpkg.com/bxf"></script>

<script>
  bxf('/url').then(res => console.log(res));
</script>
```
## Create Instance

```javascript
const http = bxf.create({
  baseUrl: 'https://www.xxx.com', // 如果url是完整地址(http|https开头)的则会忽略baseUrl
  method: 'post', // 默认请求 get
  requestType: 'query',// 默认query 可选参数有['query', 'json', 'form', 'formdata']
  responseType: null, // 默认null走text但如果返回的文本是json字符串会自动转成json对象，可选参数有 ['arrayBuffer', 'blob', 'blobText', 'formData', 'text', 'json'], 注意如果指定了text则不会自动判断转换json
  charset: false, // 是否为content-type 加上编码，可选值{true: 'utf-8', false: '不添加', ...其他任意编码字符串}
  engine: null, // 引擎可选值['xhr', 'fetch', 以及其他自定义的全局函数]不符合可选值则进入自动判断选择
  beforeSend: null, // 发送前的函数回调，只有是函数才会调用其他参数会被忽略，并且如果在beforeSend返回false则不会再进行请求了
  //contentType: undefined,
  // xhr: (request, config) => {}, // 只有engine是xhr请求才会在请求过程中调用该函数，可用于添加未定义到的xhr事件(如：获取上传进度)
  // xhr或fetch的原生字段
  rawFields: {

  }
});
```
create创建出来的实例用法与bxf相同，只是对未传参数使用了创建实例时传进去的参数。

## Request Methods

```javascript
// bxf 也是一个函数，可以直接进行请求
bxf({
  url: '/',
  method: 'post',
  data: {id: 1},
  params: {
    title: 'tom',
  },
  headers: {}
});
// 除了直接请求，还可以传入第二个参数printConfig 打印请求配置值为boolean，默认false只执行请求，为true则不进行真实请求只打印处理后的配置
bxf({
  url: '/',
  method: 'post',
  data: {id: 1},
  params: {
    title: 'tom',
  },
  headers: {}
}, true);
```

### get

```javascript
// 如果提供了params，则会被解析为拼接到请求url上的URLSearchParams，就像GET方式传递参数一样。
bxf.get('/');
bxf.get('http://api', {params: {id: 5}}); // expect url: http://api?id=5 
bxf.get('/', {params: {id: 5}, timeout: 3000});
```

### post

```js
// 如果data是对象或者数组，或者字符串，不设置的话Content-Type会设置为application/x-www-form-urlencoded，并且data会转为urlencoded类型，其他Content-Type则由进行requestType 参数和data类型自动判断
bxf.post('/');
bxf.post('/', {id: 5});
bxf.post('/', null, {timeout: 3000}); // the request body will be empty
```
### delete
```js
// 参照get
bxf.delete('/', {responseType: 'json'});
```


### options

```js
// 参照get
bxf.options('/', {});
```

### head

```js
// 参照get
HttpFetch.head('/', {});
```

### patch

```js
// 参数post
bxf.patch('/', {}, {});
```

### put

```js
// 参数post
bxf.put('/', {}, {});
```

## config & 请求参数可选字段
### baseUrl
将自动加在 `url` 前面，除非 `url` 是一个绝对 URL。它可以通过设置一个 `baseURL` 便于为 bxf 实例的方法传递相对 URL

### url
用于请求的服务器 URL

### method
`method` 是创建请求时使用的方法

### headers
`headers` 是即将被发送的自定义请求头

### params
get参数，会自动转换处理成query的get参数
```js
// 字符串类型 => 最终请求地址 https://www.xxx.com/?id=1&page=1
bxf({
  url: 'https://www.xxx.com',
  params: 'id=1&page=1',
})
// 对象类型 => 最终请求地址 https://www.xxx.com/?id=1&page=1
bxf({
  url: 'https://www.xxx.com',
  params: {
    id: 1,
    page: 1,
  } 
})

// 数组类型 => 最终请求地址 https://www.xxx.com?a=1&b=2&c=3&d=4&e=5&f%5B%5D=1&f%5B%5D=2&f%5B%5D=3&g%5Ba%5D=1&g%5Bb%5D=2
bxf({
  url: 'https://www.xxx.com',
  params: [
      ['a', 1],
      {b: 2},
      {c: 3, d: 4},
      'e=5',
      ['f', [1,2,3]],
      ['g', {a: 1, b: 2}],
  ] 
})
```
注意如果method是['get', 'delete', 'head', 'options']时params未定义而data有值则data会被等价于params处于到url上

### data
data参数除了支持params的几种传参类型外还支持formData和json字符串，但最终以什么方式提交则是配合requestType参数判断的

### requestType
指定请求类型

### responseType 
指定响应类型，一般放空或null即可，放空则会自动判断。如果指定了具体类型但最终返回类型不一致那么会取不到值。支持参数值['arrayBuffer', 'blob', 'blobText', 'formData', 'text', 'json']

### charset
是否在content-type类型后添加返回指定编码一般可忽略

### xhr
可选函数，仅在请求引擎为xhr时有效，一般用于补充未定义的事件，如上传文件进度，注意如果函数有返回值，并且返回false,则会中断请求

### beforeSend
可选函数，在发送请求前调用，并且如果该函数返回false,则会中止请求

### timeout
设置超时，！！！注意该字段我作了判断处理，如果值小于100会被当作秒被乘以1000，如果需要设置100以内的毫秒需要自行除以1000，而大于等于100单位则是毫秒

### rawFields
补充原生字段，如fetch请求时设置是否使用缓存
```js
bxf({
  url: 'https://www.xxx.com',
  rawFields: {
    cache: "no-store"
  }
})
```



## 拦截器
拦截器简介
在请求或响应被 then 或 catch 处理前拦截它们。
### 添加拦截器
```javascript
// 添加请求拦截器
bxf.interceptors.request.use(function (config) {
    // 在发送请求之前做些什么
    return config;
  }, function (error) {
    // 对请求错误做些什么
    return Promise.reject(error);
  });

// 添加响应拦截器
bxf.interceptors.response.use(function (response) {
    // 对响应数据做点什么
    return response;
  }, function (error) {
    // 对响应错误做点什么
    return Promise.reject(error);
  });
```

- 请求拦截器：它的作用是在请求发送前统一执行某些操作，比如在请求头中添加 token 字段。
- 响应拦截器：它的作用是在接收到服务器响应后统一执行某些操作，比如发现响应状态码为 401 时，自动跳转到登录页。
### 此外我们还可以删除某个拦截器

```javascript
const myInterceptor = bxf.interceptors.request.use(function () {/*...*/});
bxf.interceptors.request.eject(myInterceptor);
```

## 取消功能
取消请求需求分析
使用 cancel token 取消请求，可以使用 CancelToken.source 工厂方法创建 cancel token，像这样：

```javascript
const CancelToken = bxf.CancelToken;
const source = CancelToken.source();

bxf.get('/user/12345', {
  cancelToken: source.token
}).catch(function(thrown) {
  if (bxf.isCancel(thrown)) {
    console.log('Request canceled', thrown.message);
  } else {
     // 处理错误
  }
});

bxf.post('/user/12345', {
  name: 'new name'
}, {
  cancelToken: source.token
})

// 取消请求（message 参数是可选的）
source.cancel('Operation canceled by the user.');
```
### 还可以通过传递一个 executor 函数到 CancelToken 的构造函数来创建 cancel token

```javascript
const CancelToken = bxf.CancelToken;
let cancel;

bxf.get('/user/12345', {
  cancelToken: new CancelToken(function executor(c) {
    // executor 函数接收一个 cancel 函数作为参数
    cancel = c;
  })
});

// cancel the request
cancel();

```

## 其他一些使用案例
### 上传文件
- fetch上传文件
```js
var fd = new FormData()
fd.append('img', '文件句柄')
bxf({
  url: 'https://www.xxx.com/uploads',
  method: 'post',
  data: fd,
  contentType: false, // 上传文件需要禁止contentType请求头
  engine: 'fetch'
})
```
- xhr上传并监听上传进度
```js
var fd = new FormData()
fd.append('img', '文件句柄')
bxf({
  url: 'https://www.xxx.com/uploads',
  method: 'post',
  data: fd,
  contentType: false, // 上传文件需要禁止contentType请求头
  engine: 'xhr',
  xhr: (xhr, config) => {
    xhr.upload.onprogress=function(eve){
          if (eve.lengthComputable){
              console.log(eve.loaded/eve.total);
          }
      }
  }
})
```

# 版本升级备注
- 修复默认参数 responseType ,原本默认设置了text会导致无法自动判断json,需要自动判断json需要设置为非可选参数
- 增加了 beforeSend 对于网页请求可能需求不大，添加这个主要是本人在开发浏览器扩展mv3时做动态请求头修改时需要获取最终请求的url，而补充的
- 增加了打印配置的选项直接在bxf(requestConfig, true),则不会进行真实请求，只返回处理的配置

# 懒得写文档，其他未列出的请前往github看源码。。。