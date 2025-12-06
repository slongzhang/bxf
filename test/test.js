/**
 * 生成指定大小的文本文件
 * @param {string} filename - 文件名
 * @param {string} size - 文件大小，格式如 '1kb', '2mb', '3gb'
 */
function generateTextFile(filename, size, isDown = false) {
    // 解析文件大小
    const sizeRegex = /^(\d+)(kb|mb|gb)$/i;
    const match = size.toLowerCase().match(sizeRegex);

    if (!match) {
        throw new Error('请使用正确的格式，如 "1kb", "2mb", "3gb"');
    }

    const amount = parseInt(match[1]);
    const unit = match[2];

    // 计算要生成的字节数
    let bytes;
    switch (unit) {
        case 'kb':
            bytes = amount * 1024;
            break;
        case 'mb':
            bytes = amount * 1024 * 1024;
            break;
        case 'gb':
            bytes = amount * 1024 * 1024 * 1024;
            break;
        default:
            throw new Error('不支持的单位');
    }

    // 创建用于填充文件的内容
    const filler = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let content = '';

    // 生成内容（每次生成1MB，防止内存溢出）
    const chunkSize = 1024 * 1024; // 1MB
    let remainingBytes = bytes;

    while (remainingBytes > 0) {
        const currentChunkSize = Math.min(chunkSize, remainingBytes);
        let chunk = '';

        // 生成当前块的内容
        while (chunk.length < currentChunkSize) {
            const needed = currentChunkSize - chunk.length;
            chunk += filler.repeat(Math.ceil(needed / filler.length)).slice(0, needed);
        }

        content += chunk;
        remainingBytes -= currentChunkSize;
    }

    // 创建Blob对象
    const blob = new Blob([content], { type: 'text/plain' });

    if (isDown) {
        // 创建下载链接并触发下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    return blob;
}


/**
 * 获取表单
 * @param {function} callback 
 * @returns 
 */
function getFm(callback) {
    const fm = new FormData();
    fm.append('phone', '13812345678')
    fm.append('pwd', '123456')
    fm.append('__token__', Date.now())
    if (typeof callback == 'function') {
        callback.call(fm, fm);
    }
    return fm;
}


// 测试函数
async function bxfTest(url, engine = 'fetch', onlyData = false) {
    let idx = 0;
    const resultProxy = new Proxy({}, {
        get: function (target, proKey, receiver) {
            if (proKey == '__RAW') {
                return target;
            }
            return Reflect.get(target, propKey, receiver);
        },
        set: function (target, propKey, value, receiver) {
            if (!Object.hasOwn(target, propKey)) {
                idx++;
            }
            return Reflect.set(target, propKey, value, receiver)
        }
    })
    // get请求
    resultProxy[idx + '.get配置请求'] = await bxf({
        url,
        params: {
            idx,
            page: 1,
            page_num: 100,
        },
        engine,
        onlyData
    }).catch(err => {
        return ['error', err];
    })

    resultProxy[idx + '.get快捷请求'] = await bxf.get(url, {
        params: {
            idx,
            page: 1,
            page_num: 100,
        },
        engine,
        onlyData
    }).catch(err => {
        return ['error', err];
    })

    // get指定429 onlyData 异常
    resultProxy[idx + '.get指定429 err'] = await bxf({
        url,
        params: {
            idx,
            page: 1,
            page_num: 100,
            status: 429,
        },
        engine,
        onlyData
    }).catch(err => {
        return ['error', err];
    })

    // get指定429 onlyData 捕获仅数据
    resultProxy[idx + '.get指定429 success'] = await bxf({
        url,
        params: {
            idx,
            page: 1,
            page_num: 100,
            status: 429,
        },
        engine,
        onlyData: true,
        onlyDataStatus: '*'
    }).catch(err => {
        return ['error', err];
    })

    // 手动中断
    await new Promise(async resolve => {
        const ac = new AbortController();
        const signal = ac.signal;
        let temp = bxf.get(url, {
            params: {
                idx,
                delay: 10000,
            },
            engine,
            onlyData,
            signal,
        }).catch(err => {
            return ['error', err];
        })

        setTimeout(function () {
            ac.abort();
        }, 3000)
        await temp.then(res => {
            resultProxy[idx + '.手动中断请求'] = res
        }).finally(resolve)
    })


    resultProxy[idx + '.请求超时'] = await bxf.get(url, {
        params: {
            idx,
            delay: 10000,
        },
        engine,
        onlyData,
        timeout: 5000,
    }).catch(err => {
        return ['error', err];
    })

    resultProxy[idx + '.get请求无params自动处理data'] = await bxf({
        url: (function () {
            let _url = new URL(url, location);
            _url.searchParams.append('idx', idx);
            return _url.toString();
        })(),
        engine,
        onlyData,
        data: {
            page: 1
        },
    })

    resultProxy[idx + '.get请求无params自动处理data-忽略非普通对象'] = await bxf({
        url: (function () {
            let _url = new URL(url, location);
            _url.searchParams.append('idx', idx);
            return _url.toString();
        })(),
        engine,
        onlyData,
        data: getFm(),
    })

    resultProxy[idx + '.post请求'] = await bxf.post(url, {
        'title': '文章标题',
        'categoryId': 1,
        'content': `<div>hello world</div>`,
        'uid': 123,
    }, {
        params: {
            idx,
            engine
        },
        engine,
        onlyData,
    }).catch(err => {
        return ['error', err];
    })

    resultProxy[idx + '.post 指定响应类型blobText'] = await bxf.post({
        url,
        data: {
            'title': '文章标题',
            'categoryId': 1,
            'content': `<div>hello world</div>`,
            'uid': 123,
        },
        params: {
            idx,
            engine,
            responseType: 'blobText'
        },
        engine,
        onlyData,
        responseType: 'blobText'
    }).catch(err => {
        return ['error', err];
    })


    resultProxy[idx + '.post 指定响应类型document'] = await bxf.post({
        url,
        data: {
            'title': '文章标题',
            'categoryId': 1,
            'content': `<div>hello world</div>`,
            'uid': 123,
        },
        params: {
            idx,
            engine,
            responseType: 'document'
        },
        engine,
        onlyData,
        responseType: 'document'
    }).catch(err => {
        return ['error', err];
    })

    resultProxy[idx + '.post 指定响应类型为blob'] = await bxf.post({
        url,
        data: {
            'title': '文章标题',
            'categoryId': 1,
            'content': `<div>hello world</div>`,
            'uid': 123,
        },
        params: {
            idx,
            type: 'fetch',
            responseType: 'blob'
        },
        engine,
        onlyData,
        responseType: 'blob'
    }).catch(err => {
        return ['error', err];
    })


    resultProxy[idx + '.post 指定请求类型query'] = await bxf.post({
        url,
        data: {
            'title': '文章标题',
            'categoryId': 1,
            'content': `<div>hello world</div>`,
            'uid': 123,
        },
        params: {
            idx,
            engine,
            requestType: 'query'
        },
        engine,
        onlyData,
        requestType: 'query'
    }).catch(err => {
        return ['error', err];
    })

    resultProxy[idx + '.post 表单文件上传'] = await bxf({
        url,
        method: 'post',
        params: {
            idx,
            engine: 'xhr',
            requestType: 'formData'
        },
        engine,
        onlyData,
        data: getFm(function () {
            let fileName = 'myText.txt';
            this.append('file', generateTextFile(fileName, '1mb'), fileName);
        }),
        onUploadProgress: function (eve) {
            if (eve.lengthComputable) {
                console.log('当前进度', eve.loaded / eve.total);
            }
        }
    }).catch(err => {
        return ['error', err];
    })

    // 其他方法测试
    resultProxy[idx + '.delete'] = await bxf.delete(url, {
        engine,
        onlyData,
        params: {
            idx,
            engine,
            method: 'delete',
        },
    }).catch(err => {
        return ['error', err];
    })

    resultProxy[idx + '.head'] = await bxf.head(url, {
        engine,
        onlyData,
        params: {
            idx,
            engine,
            method: 'head',
        },
    }).catch(err => {
        return ['error', err];
    })

    resultProxy[idx + '.options'] = await bxf.options(url, {
        engine,
        onlyData,
        params: {
            idx,
            engine,
            method: 'options',
        },
    }).catch(err => {
        return ['error', err];
    })

    resultProxy[idx + '.put'] = await bxf.put(url, {
        id: 1
    }, {
        engine,
        onlyData,
        params: {
            idx,
            engine,
            method: 'put',
        },
    }).catch(err => {
        return ['error', err];
    })

    resultProxy[idx + '.patch'] = await bxf.patch(url, {
        id: 1
    }, {
        engine,
        onlyData,
        params: {
            idx,
            engine,
            method: 'patch',
        },
    }).catch(err => {
        return ['error', err];
    })

    return resultProxy.__RAW;
}

async function testMain(url) {
    console.log('开始xhr请求测试')
    await bxfTest(url, 'xhr', false).then(result => console.log('xhr', result))

    console.log('开始fetch请求测试')
    bxfTest(url, 'fetch', false).then(result => console.log('fetch', result))
}
