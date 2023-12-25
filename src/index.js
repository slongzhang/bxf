// 入口文件
import HttpRequest from "./core/HttpRequest";
import { extend, merge } from "./helpers/util";
import CancelToken from "./cancel/cancelToken";
import { Cancel, isCancel } from "./cancel/cancel";


function createInstance(initConfig) {
  const context = new HttpRequest(initConfig);

  const instance = HttpRequest.prototype.request.bind(context);

  extend(instance, HttpRequest.prototype, context);

  return instance;
}

// 默认配置
const defaultConfig = {
  baseUrl: '', // 根域名
  url: '', // 实际请求地址，如果不是http|https等完整开头的会自动拼接上baseUrl
  method: "get", // 请求方法
  params: null, // url后面的get参数
  data: null, // get或post的参数会自动处理
  requestType: 'query',
  responseType: null,
  timeout: 60, // 超时60秒
  charset: false, // 是否为content-type 加上编码，可选值{true: 'utf-8', false: '不添加', ...其他任意编码字符串}
  engine: null, // 引擎可选值['xhr', 'fetch', 以及自定义函数]不符合可选值如auto则进入自动判断选择
  beforeSend: null, // 发送前的函数回调，只有是函数才会调用其他参数会被忽略
  toDataOnly: false, // 仅返回数据, 默认返回详细数据
  //contentType: undefined,
  // xhr或fetch的原生字段
  rawFields: {
  }
};

const bxf = createInstance(defaultConfig);

bxf.CancelToken = CancelToken;
bxf.Cancel = Cancel;
bxf.isCancel = isCancel;

bxf.create = function (config) {
  return createInstance(merge(defaultConfig, config));
}

export default bxf;