/**
 * 由 cases.mjs 生成 README 的「控制台案例」章节。
 *
 *   node examples/playground/gen-readme.mjs
 *
 * 只替换 README.md 里 <!-- CASES:START --> 与 <!-- CASES:END --> 之间的内容，
 * 其余手写部分保持不变，可反复运行（幂等）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, GROUPS } from './cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const README = path.resolve(HERE, '../../README.md');
const START = '<!-- CASES:START -->';
const END = '<!-- CASES:END -->';

const counts = {};
CASES.forEach((c) => { counts[c.group] = (counts[c.group] || 0) + 1; });

const lines = [];
lines.push(`共 **${CASES.length}** 条案例，分 **${GROUPS.length}** 组。所有代码都只依赖实验室挂载的全局工具，可反复粘贴执行。`);
lines.push('');
lines.push('| 组 | 条数 | 覆盖 |');
lines.push('| --- | --- | --- |');
for (const g of GROUPS) {
    lines.push(`| ${g.title} | ${counts[g.id] || 0} | ${g.desc || ''} |`);
}

let n = 0;
for (const g of GROUPS) {
    const list = CASES.filter((c) => c.group === g.id);
    if (!list.length) continue;
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`### ${g.title}`);
    if (g.desc) lines.push(`> ${g.desc}`);
    lines.push('');
    for (const c of list) {
        n++;
        lines.push(`#### ${n}. ${c.title}`);
        lines.push('');
        if (c.desc) { lines.push(c.desc); lines.push(''); }
        lines.push('```js');
        lines.push(c.code.trimEnd());
        lines.push('```');
        lines.push('');
    }
}

const body = lines.join('\n').trimEnd();
const md = fs.readFileSync(README, 'utf8');
const i = md.indexOf(START);
const j = md.indexOf(END);
if (i < 0 || j < 0 || j < i) {
    console.error('README.md 缺少 CASES:START / CASES:END 标记，未修改文件。');
    process.exit(1);
}
const next = md.slice(0, i) + START + '\n' + body + '\n' + END + md.slice(j + END.length);
if (next === md) {
    console.log(`README 案例章节已是最新（${CASES.length} 条 / ${GROUPS.length} 组），无需改动。`);
} else {
    fs.writeFileSync(README, next);
    console.log(`已生成 README 案例章节：${CASES.length} 条 / ${GROUPS.length} 组 → ${README}`);
}
