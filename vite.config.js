import { defineConfig } from 'vite';
import pkg from './package.json';

const globalName = 'bxf';
const banner = `/*!
* name: ${globalName}
* version: ${pkg.version}
* author: ${pkg.author}
* date: ${(new Date()).toLocaleString()}
* license: ${pkg.license}
* description: ${pkg.description}
*/
`;


export default defineConfig(({ mode }) => {
  // 判断是否为开发模式
  const isDev = mode === 'development';

  return {
    build: {
      emptyOutDir: isDev ? true: false,
      // 开发模式不压缩，生产模式压缩
      minify: isDev ? false : 'terser',
      // 开发模式生成 sourcemap
      // sourcemap: isDev ? 'inline' : false,
      terserOptions: {
        compress: {
          drop_console: !isDev, // 开发模式保留 console
          drop_debugger: !isDev, // 开发模式保留 debugger
        },
        format: {
          comments: false,
          beautify: isDev, // 开发模式美化代码
        },
      },
      lib: {
        entry: 'src/index.js',
        name: globalName,
        fileName: (format) => `${globalName}.${format}${isDev ? '' : '.min'}.js`,
        formats: ["umd", "iife"],
      },
      rollupOptions: {
        output: [
          // 配置 UMD 格式
          {
            format: 'umd',
            name: globalName,
            exports: 'default',
            sourcemap: false, // 不生成 sourcemap
          },
          // 配置 IIFE 格式 (仅这里生成 sourcemap)
          {
            format: 'iife',
            name: globalName,
            exports: 'default',
            sourcemap: isDev ? 'inline' : false, // 开发环境内联，生产环境外部文件
          },
        ],
      },
    },
    define: {
      global: 'globalThis',
    },
    optimizeDeps: {
      include: ['buffer'],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    plugins: [
      {
        name: 'assets-rewrite',
        enforce: 'post',
        apply: 'build',
        // // 修改 HTML 中的路径
        // transformIndexHtml(html, { path }) {
        //   return html.replace(
        //     /"\/assets\//g,
        //     `"${relative(dirname(path), '/assets')}/`
        //   );
        // },
        generateBundle(_, bundle) {
          for (const fileName in bundle) {
            const chunk = bundle[fileName];
            if (chunk.type === 'chunk' && fileName.endsWith('.js')) {
              chunk.code = banner + chunk.code;
            }
          }
        },
      },
    ],
  };
});