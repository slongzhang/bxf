const packageJson = require('./package.json')
const path = require('path')
const os = require('os')
const webpack = require('webpack')
const TerserPlugin = require("terser-webpack-plugin");

// 获取版权声明
function banner_format(obj) {
    const result = []
    for (let [key, item] of Object.entries(obj)) {
        result.push(`* ${key}: ${item}`)
    }
    result.unshift('/*!')
    result.push('*/')
    return result.join(os.EOL)
}

module.exports = (env, config) => {
    let mode = config.mode;
    const result = {
        entry: './src/index.js',  // 打包入口文件
        output: {
            clean: true, // 每次输出清除上次打包
            filename: 'index.js', // 输出的文件名
            path: path.resolve(__dirname, 'dist'), // 输出的绝对路径
            library: 'httpRequest', // 类库的命名空间，如果通过网页的方式引入，则可以通过window.axios访问它
            globalObject: 'this', // 定义全局变量,兼容node和浏览器运行，避免出现"window is not defined"的情况
            libraryTarget: "umd", // 定义打包方式Universal Module Definition,同时支持在CommonJS、AMD和全局变量使用
            libraryExport: 'default' // 对外暴露default属性，就可以直接调用default里的属性
        },
        optimization: {
            // 生产环境才需要压缩代码，开发环境不压缩
            minimize: mode != 'development',
            minimizer: [
                //压缩js代码
                new TerserPlugin({
                    extractComments: false, // 不将注释提取到单独的文件中
                })
            ]
        },
        plugins: [
            new webpack.BannerPlugin({
                banner: banner_format({
                    name: packageJson.name,
                    version: packageJson.version,
                    author: packageJson.author,
                    date: (new Date()).toLocaleString(),
                    description: packageJson.description,
                }),
                raw: true,
                entryOnly: true
            })
        ],
        module: {
            rules: [
                // {
                //   test: /\.js$/,
                //   include: path.resolve(__dirname, 'src'),
                //   loader: 'babel-loader',
                //   options: {
                //     //设置编译的规则
                //     presets: [
                //       [
                //         '@babel/preset-env'
                //         , {
                //           "targets": {
                //             "chrome": "103"
                //           }
                //         }
                //       ]
                //     ],
                //   }
                // },
            ]
        }
    }
    return result
}