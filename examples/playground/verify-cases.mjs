/**
 * 案例自检：语法编译 + 在 Node 里用真实 fetch 逐条执行。
 *
 *   node examples/playground/verify-cases.mjs           # 需要先启动 server.mjs
 *   node examples/playground/verify-cases.mjs --syntax  # 只做语法校验，不需要服务
 *
 * 说明：Node 没有 XMLHttpRequest / DOMParser / location / document.cookie 等浏览器能力，
 *       因此少数案例（XHR 引擎、进度回调、document、CORS mode）会被标注为「环境差异」。
 *       其余案例必须在 Node 下无未捕获异常地跑完——这就是「可复制到控制台直接执行」的底线。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { CASES } from './cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PORT = Number(process.argv.find((a) => /^\d{4,5}$/.test(a)) || 7788);
const SYNTAX_ONLY = process.argv.includes('--syntax');

/* ---------- 1. 语法校验 ---------- */
let syntaxBad = [];
for (const c of CASES) {
    try { new Function('return (async () => {\n' + c.code + '\n})()'); }
    catch (e) { syntaxBad.push(`${c.title} → ${e.message}`); }
}
console.log(`语法校验：${CASES.length - syntaxBad.length}/${CASES.length} 通过`);
if (syntaxBad.length) { console.log(syntaxBad.join('\n')); process.exit(1); }
if (SYNTAX_ONLY) process.exit(0);

/* ---------- 2. 模拟最小浏览器全局 ---------- */
globalThis.window = globalThis;
globalThis.location = {
    origin: `http://127.0.0.1:${PORT}`,
    pathname: '/',
    href: `http://127.0.0.1:${PORT}/`,
};
globalThis.document = { cookie: '' };
globalThis.__LAB__ = { port: PORT, crossPort: PORT + 1, hasLib: true };

const libFile = path.join(ROOT, 'dist', 'bxf.umd.js');
const toolkitFile = path.join(HERE, 'toolkit.js');
if (!fs.existsSync(libFile)) {
    console.error('缺少 dist/bxf.umd.js，请先执行 pnpm run build');
    process.exit(1);
}
vm.runInThisContext(fs.readFileSync(libFile, 'utf8'), { filename: 'bxf.umd.js' });
vm.runInThisContext(fs.readFileSync(toolkitFile, 'utf8'), { filename: 'toolkit.js' });

/* ---------- 3. 逐条执行，静默收集 console ---------- */
const realConsole = {};
['log', 'warn', 'error', 'info', 'table', 'group', 'groupEnd'].forEach((k) => { realConsole[k] = console[k]; });
function silence() {
    ['log', 'warn', 'error', 'info', 'table', 'group', 'groupEnd'].forEach((k) => { console[k] = function () {}; });
}
function restore() {
    Object.keys(realConsole).forEach((k) => { console[k] = realConsole[k]; });
}

// Node 环境天然缺失的能力，标记为环境差异而不是案例错误
// 注意用小写匹配：库抛的是 engine="xhr" 在当前环境不可用
const ENV_PATTERNS = [
    /engine="(xhr|fetch)" 在当前环境不可用/,
    /XMLHttpRequest/, /DOMParser/, /no-cors/, /not implemented/i,
];

// 案例里若有「提前创建却没接住」的 Promise，Node 默认会直接终止进程；
// 这里改成收集起来统一报告，一次跑完全部案例。
const unhandled = [];
process.on('unhandledRejection', (reason) => {
    unhandled.push(String((reason && reason.message) || reason));
});

silence();
const failures = [];
const envSkips = [];
let passed = 0;

for (const c of CASES) {
    try {
        const fn = new Function('return (async () => {\n' + c.code + '\n})()');
        await fn();
        passed++;
    } catch (e) {
        const msg = String((e && e.message) || e);
        const item = `${c.title} → ${msg}`;
        if (ENV_PATTERNS.some((re) => re.test(msg))) envSkips.push(item);
        else failures.push(item);
    }
}
restore();

console.log(`运行校验：${passed}/${CASES.length} 无未捕获异常`);
if (envSkips.length) {
    console.log(`环境差异（Node 无浏览器能力，非案例错误）：${envSkips.length} 条`);
    envSkips.forEach((s) => console.log('  · ' + s));
}
if (unhandled.length) {
    console.log(`\n未处理的 Promise rejection（案例提前创建了 promise 却没接住）：${unhandled.length} 条`);
    unhandled.forEach((s) => console.log('  ⚠ ' + s));
}
if (failures.length || unhandled.length) {
    console.log(`\n需要修复：${failures.length} 条运行时异常 / ${unhandled.length} 条未处理 rejection`);
    failures.forEach((s) => console.log('  ✗ ' + s));
    process.exit(1);
} else {
    console.log('全部案例在可用能力范围内均可执行。');
}
