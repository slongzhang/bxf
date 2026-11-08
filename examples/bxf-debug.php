<?php
/**
 * bxf 控制台调试页 —— 单文件 PHP
 * ------------------------------------------------------------------
 * 用法：
 *   1) 把本文件丢进任意站点目录（例如 D:/www/bxf-debug.php）
 *   2) 浏览器打开该地址，按 F12 进控制台
 *   3) 控制台里已暴露：bxf / api / apiUrl / inspect / probeAll
 *
 * 库文件来源（按优先级）：
 *   a. 本文件同目录或上层的 bxf.umd.js / dist/bxf.umd.js（自动探测，直接内联）
 *   b. 页面顶部 define('BXF_LIB_URL', 'https://.../bxf.umd.js')（用 script src 引入）
 *   c. 访问时带 ?lib=https://.../bxf.umd.js
 *   都找不到时页面会给出提示，其它调试功能仍可用。
 *
 * API 端点统一为「本页面 + ?api=xxx」，见页面底部表格。
 * 代码保持 PHP 7.4 兼容（不使用 match / str_contains / 命名参数 / nullsafe）。
 */

/* ================= 可按需修改的配置 ================= */

// 库文件绝对路径（留空则自动探测）。例：define('BXF_LIB_PATH', 'D:/www/lib/bxf.umd.js');
define('BXF_LIB_PATH', '');

// 库文件 URL（留空则不远程引入）。例：define('BXF_LIB_URL', 'https://cdn.example.com/bxf.umd.js');
define('BXF_LIB_URL', '');

/* ================= 工具函数 ================= */

/**
 * 定位本地库文件，返回绝对路径或 null。
 */
function bxf_locate_lib()
{
    if (BXF_LIB_PATH !== '' && is_file(BXF_LIB_PATH)) {
        return BXF_LIB_PATH;
    }
    $candidates = array(
        __DIR__ . '/bxf.umd.js',
        __DIR__ . '/dist/bxf.umd.js',
        __DIR__ . '/../dist/bxf.umd.js',
        __DIR__ . '/../../dist/bxf.umd.js',
    );
    foreach ($candidates as $path) {
        if (is_file($path)) {
            return $path;
        }
    }
    return null;
}

/**
 * 输出 JSON 并结束。$status 为 0 表示沿用当前状态码。
 */
function bxf_json($data, $status = 0)
{
    if (!headers_sent()) {
        if ($status > 0) {
            http_response_code($status);
        }
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
}

/**
 * 关闭所有输出缓冲，保证分块/流式逐条到达客户端。
 * nginx 还需要 X-Accel-Buffering: no 才不缓冲。
 */
function bxf_flush_ready()
{
    @ini_set('zlib.output_compression', '0');
    @ini_set('implicit_flush', '1');
    header('X-Accel-Buffering: no');
    header('Cache-Control: no-store');
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    @ob_implicit_flush(true);
}

/**
 * 读取全部请求头。
 */
function bxf_request_headers()
{
    $headers = array();
    foreach ($_SERVER as $key => $value) {
        if (strpos($key, 'HTTP_') === 0) {
            $name = strtolower(str_replace('_', '-', substr($key, 5)));
            $headers[$name] = $value;
        }
    }
    if (isset($_SERVER['CONTENT_TYPE'])) {
        $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
    }
    if (isset($_SERVER['CONTENT_LENGTH'])) {
        $headers['content-length'] = $_SERVER['CONTENT_LENGTH'];
    }
    return $headers;
}

/* ================= API 分发 ================= */

$bxf_api = isset($_GET['api']) ? (string) $_GET['api'] : '';

if ($bxf_api !== '') {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS');
        $reqHeaders = isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])
            ? $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] : '*';
        header('Access-Control-Allow-Headers: ' . $reqHeaders);
        header('Access-Control-Expose-Headers: *');
    }
    header('X-Bxf-Api: ' . $bxf_api);

    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
    $rawBody = file_get_contents('php://input');
    $selfUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
        . '://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost')
        . strtok($_SERVER['REQUEST_URI'], '?');

    switch ($bxf_api) {

        /* ---------- 请求回显 ---------- */
        case 'echo':
            $query = $_GET;
            unset($query['api']);
            bxf_json(array(
                'method' => $method,
                'path' => strtok($_SERVER['REQUEST_URI'], '?'),
                'query' => $query,
                'headers' => bxf_request_headers(),
                'body' => $rawBody,
                'bodyLength' => strlen($rawBody),
                'bodyMd5' => md5($rawBody),
                'serverTime' => date('c'),
            ));
            break;

        /* ---------- 标准 JSON ---------- */
        case 'json':
            bxf_json(array(
                'ok' => true,
                'text' => '中文正常',
                'n' => 1,
                'list' => array(1, 2, 3),
                'nested' => array('a' => array('b' => true)),
                'nullValue' => null,
            ));
            break;

        /* ---------- 纯文本 ---------- */
        case 'text':
            header('Content-Type: text/plain; charset=utf-8');
            echo "纯文本响应\n第二行：中文";
            break;

        /* ---------- 声明 json 但内容非法 ---------- */
        case 'badjson':
            header('Content-Type: application/json; charset=utf-8');
            echo 'this is { not valid json';
            break;

        /* ---------- HTML ---------- */
        case 'html':
            header('Content-Type: text/html; charset=utf-8');
            echo '<!DOCTYPE html><html><head><title>T</title></head>'
                . '<body><div id="app" class="box">HTML 响应</div></body></html>';
            break;

        /* ---------- XML ---------- */
        case 'xml':
            header('Content-Type: application/xml; charset=utf-8');
            echo '<?xml version="1.0" encoding="utf-8"?><root><item id="1">中文</item></root>';
            break;

        /* ---------- 二进制 ---------- */
        case 'binary':
            header('Content-Type: application/octet-stream');
            // 1x1 透明 PNG
            echo base64_decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
            );
            break;

        /* ---------- UTF-8 中文 ---------- */
        case 'utf8':
            header('Content-Type: text/plain; charset=utf-8');
            echo 'UTF-8 编码：你好，世界 —— 测试 charset 提取';
            break;

        /* ---------- GBK 中文（验证 charset 只在 content-type 里） ---------- */
        case 'gbk':
            $text = 'GBK 编码：你好，世界 —— charset 来自 content-type';
            $encoded = null;
            if (function_exists('iconv')) {
                $encoded = @iconv('UTF-8', 'GBK//IGNORE', $text);
            } elseif (function_exists('mb_convert_encoding')) {
                $encoded = @mb_convert_encoding($text, 'GBK', 'UTF-8');
            }
            if ($encoded === null || $encoded === false) {
                bxf_json(array('error' => '当前 PHP 未启用 iconv / mbstring，无法生成 GBK 响应'), 501);
                break;
            }
            header('Content-Type: text/plain; charset=gbk');
            echo $encoded;
            break;

        /* ---------- 200 但空响应体 ---------- */
        case 'empty':
            header('Content-Type: application/json; charset=utf-8');
            echo '';
            break;

        /* ---------- 204 无响应体 ---------- */
        case '204':
            http_response_code(204);
            break;

        /* ---------- 任意状态码 + 业务体 ---------- */
        case 'status':
            $code = isset($_GET['code']) ? (int) $_GET['code'] : 429;
            if ($code < 100 || $code > 599) {
                $code = 429;
            }
            http_response_code($code);
            if ($code === 204 || $code === 304) {
                break;   // 这两个状态码不允许带响应体
            }
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array(
                'status' => $code,
                'ok' => false,
                'message' => 'forced status ' . $code,
            ), JSON_UNESCAPED_UNICODE);
            break;

        /* ---------- 重复响应头 ---------- */
        case 'multiheader':
            header('X-Multi: alpha', false);
            header('X-Multi: beta', false);
            header('Set-Cookie: mc_one=1; Path=/', false);
            header('Set-Cookie: mc_two=2; Path=/', false);
            bxf_json(array('multiHeader' => true, 'expect' => 'X-Multi 应合并为 "alpha, beta"'));
            break;

        /* ---------- Set-Cookie（测 credentials） ---------- */
        case 'cookie':
            header('Set-Cookie: bxf_token=abc123; Path=/; SameSite=Lax', false);
            header('Set-Cookie: bxf_theme=dark; Path=/; SameSite=Lax', false);
            bxf_json(array('cookie' => '已下发 bxf_token / bxf_theme'));
            break;

        /* ---------- 延迟响应（测 timeout） ---------- */
        case 'delay':
            $ms = isset($_GET['ms']) ? (int) $_GET['ms'] : 3000;
            if ($ms < 0) {
                $ms = 0;
            }
            if ($ms > 60000) {
                $ms = 60000;
            }
            usleep($ms * 1000);
            bxf_json(array('delayedMs' => $ms, 'done' => true));
            break;

        /* ---------- SSE 流 ---------- */
        case 'sse':
            $count = isset($_GET['n']) ? (int) $_GET['n'] : 5;
            $interval = isset($_GET['ms']) ? (int) $_GET['ms'] : 300;
            $count = max(1, min(50, $count));
            header('Content-Type: text/event-stream; charset=utf-8');
            bxf_flush_ready();
            for ($i = 0; $i < $count; $i++) {
                echo 'data: ' . json_encode(
                    array('n' => $i, 'text' => '第' . $i . '条消息'),
                    JSON_UNESCAPED_UNICODE
                ) . "\n\n";
                flush();
                usleep($interval * 1000);
            }
            echo "data: [DONE]\n\n";
            flush();
            break;

        /* ---------- 慢速分块（测 raw 长流不被 timeout 掐断） ---------- */
        case 'slowchunks':
            $count = isset($_GET['n']) ? (int) $_GET['n'] : 10;
            $interval = isset($_GET['ms']) ? (int) $_GET['ms'] : 200;
            $count = max(1, min(100, $count));
            header('Content-Type: text/plain; charset=utf-8');
            bxf_flush_ready();
            for ($i = 0; $i < $count; $i++) {
                echo 'chunk-' . $i . '-' . str_pad('', 64, '.') . "\n";
                flush();
                usleep($interval * 1000);
            }
            break;

        /* ---------- 大响应（测 blob / arraybuffer / 下载进度） ---------- */
        case 'large':
            $kb = isset($_GET['kb']) ? (int) $_GET['kb'] : 256;
            $kb = max(1, min(20480, $kb));
            $total = $kb * 1024;
            header('Content-Type: application/octet-stream');
            header('Content-Length: ' . $total);
            $block = str_repeat('A', 8192);
            $sent = 0;
            while ($sent < $total) {
                $size = ($total - $sent) > 8192 ? 8192 : ($total - $sent);
                echo $size === 8192 ? $block : substr($block, 0, $size);
                $sent += $size;
                flush();
            }
            break;

        /* ---------- 中途断开（声明长度远大于实际输出） ---------- */
        case 'broken':
            header('Content-Type: application/octet-stream');
            header('Content-Length: 1048576');   // 声明 1MB
            bxf_flush_ready();
            echo str_repeat('x', 1024);          // 实际只给 1KB 就结束
            flush();
            break;

        /* ---------- 302 重定向 ---------- */
        case 'redirect':
            http_response_code(302);
            header('Location: ' . $selfUrl . '?api=json');
            break;

        default:
            bxf_json(array(
                'error' => '未知端点: ' . $bxf_api,
                'hint' => '可用端点见页面表格',
            ), 404);
            break;
    }
    exit;
}

/* ================= 页面 ================= */

$libPath = bxf_locate_lib();
$libUrl = '';
if (isset($_GET['lib']) && $_GET['lib'] !== '') {
    $libUrl = (string) $_GET['lib'];
} elseif (BXF_LIB_URL !== '') {
    $libUrl = BXF_LIB_URL;
}

$libCode = '';
$libVersion = '';
if ($libPath !== null) {
    $libCode = (string) file_get_contents($libPath);
    if (preg_match('/version:\s*([\w.\-]+)/', substr($libCode, 0, 500), $m)) {
        $libVersion = $m[1];
    }
    // 防止库代码里出现 </script 提前闭合标签
    $libCode = str_replace('</script', '<\/script', $libCode);
}

$selfUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
    . '://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost')
    . $_SERVER['REQUEST_URI'];
$phpVersion = PHP_VERSION;

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>bxf 控制台调试页</title>
<style>
    :root {
        --bg: #f6f7f9;
        --panel: #ffffff;
        --border: #e3e6eb;
        --text: #1f2328;
        --muted: #6b7280;
        --brand: #2563eb;
        --ok: #15803d;
        --warn: #b45309;
        --err: #b91c1c;
        --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    }
    * { box-sizing: border-box; }
    body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 28px 20px 80px; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    h2 { font-size: 15px; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
    h2::before { content: ""; width: 3px; height: 14px; background: var(--brand); border-radius: 2px; }
    .sub { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
    .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 18px 20px;
        margin-bottom: 16px;
    }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .chip {
        font: 12px/1 var(--mono);
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: #fff;
        color: var(--muted);
    }
    .chip b { color: var(--text); font-weight: 600; }
    .chip.ok { border-color: #bbf7d0; background: #f0fdf4; color: var(--ok); }
    .chip.bad { border-color: #fecaca; background: #fef2f2; color: var(--err); }
    .row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .row-label { width: 100px; color: var(--muted); font-size: 12px; padding-top: 6px; }
    button {
        font: 13px var(--mono);
        padding: 7px 12px;
        border-radius: 7px;
        border: 1px solid var(--border);
        background: #fff;
        color: var(--text);
        cursor: pointer;
        transition: .12s;
    }
    button:hover { border-color: var(--brand); color: var(--brand); }
    button:active { transform: translateY(1px); }
    button.primary { background: var(--brand); border-color: var(--brand); color: #fff; }
    button.primary:hover { background: #1d4ed8; color: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 500; font-size: 12px; }
    td code, code.inline {
        font: 12px var(--mono);
        background: #f1f3f6;
        padding: 2px 6px;
        border-radius: 4px;
        color: #0f172a;
    }
    pre {
        margin: 0;
        padding: 14px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 8px;
        overflow: auto;
        font: 12px/1.65 var(--mono);
    }
    pre .c { color: #7c8ba1; }
    .hint { color: var(--muted); font-size: 12px; margin-top: 8px; }
    .errbox {
        border: 1px solid #fecaca;
        background: #fef2f2;
        color: #991b1b;
        border-radius: 8px;
        padding: 14px 16px;
        font-size: 13px;
    }
    .errbox code { background: #fee2e2; padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
<div class="wrap">
    <h1>bxf 控制台调试页</h1>
    <div class="sub">
        按 <code class="inline">F12</code> 打开控制台，已注入
        <code class="inline">bxf</code> / <code class="inline">api</code> /
        <code class="inline">apiUrl</code> / <code class="inline">inspect</code> /
        <code class="inline">probeAll</code>。点下面的按钮会把完整对象打到控制台，方便展开查看。
    </div>

    <div class="meta" id="meta"></div>

<?php if ($libCode === '' && $libUrl === ''): ?>
    <div class="card">
        <div class="errbox">
            <b>没找到 bxf 库文件</b><br>
            已尝试：本文件同目录的 <code>bxf.umd.js</code>、<code>dist/bxf.umd.js</code>、上一层与上两层的
            <code>dist/bxf.umd.js</code>。<br>
            三种解决方式任选：
            <ol style="margin:8px 0 0;padding-left:20px;line-height:1.9">
                <li>把 <code>dist/bxf.umd.js</code> 拷到本文件同目录；</li>
                <li>打开本文件，修改顶部 <code>define('BXF_LIB_PATH', '绝对路径')</code>；</li>
                <li>访问时带上 <code>?lib=https://你的地址/bxf.umd.js</code>，或用
                    <code>define('BXF_LIB_URL', '...')</code>。</li>
            </ol>
        </div>
    </div>
<?php endif; ?>

    <div class="card">
        <h2>快速测试（结果打到控制台）</h2>
        <div class="row">
            <div class="row-label">基础</div>
            <button data-api="json">json</button>
            <button data-api="text">text</button>
            <button data-api="badjson">badjson</button>
            <button data-api="html">html</button>
            <button data-api="xml">xml</button>
            <button data-api="binary">binary</button>
            <button data-api="utf8">utf8</button>
            <button data-api="gbk">gbk</button>
            <button data-api="empty">empty</button>
            <button data-api="204">204</button>
        </div>
        <div class="row">
            <div class="row-label">状态码</div>
            <button data-api="status" data-extra="code=429">429</button>
            <button data-api="status" data-extra="code=500">500</button>
            <button data-api="status" data-extra="code=502">502</button>
            <button data-api="multiheader">重复响应头</button>
            <button data-api="cookie">Set-Cookie</button>
            <button data-api="redirect">302 重定向</button>
        </div>
        <div class="row">
            <div class="row-label">流 / 大响应</div>
            <button data-api="sse">SSE 流</button>
            <button data-api="slowchunks">慢速分块</button>
            <button data-api="large" data-extra="kb=512">512KB</button>
            <button data-api="broken">中途断开</button>
        </div>
        <div class="row">
            <div class="row-label">错误 / 超时</div>
            <button data-action="timeout">timeout(超时)</button>
            <button data-action="cancel">cancel(主动取消)</button>
            <button data-action="network">network(网络错误)</button>
            <button data-action="resolveStatus">resolveStatus 拒绝</button>
        </div>
        <div class="row">
            <div class="row-label">对照</div>
            <button class="primary" data-action="compare">成功 vs err.response 三项对照</button>
            <button class="primary" data-action="probeAll">跑一遍全部端点</button>
        </div>
        <div class="hint">按钮只负责把对象<strong>原样</strong>输出，不要在页面里看结果，去控制台展开。</div>
    </div>

    <div class="card">
        <h2>控制台速查</h2>
        <pre id="snippet"></pre>
        <div class="hint">上面的代码已可通过 <code class="inline">window.api</code> 直接执行，无需复制。</div>
    </div>

    <div class="card">
        <h2>端点一览</h2>
        <table>
            <thead>
                <tr><th style="width:240px">端点</th><th>说明</th><th style="width:180px">验证点</th></tr>
            </thead>
            <tbody>
                <tr><td><code>?api=echo</code></td><td>回显 method / query / headers / body / md5</td><td>请求编码、headers 合并</td></tr>
                <tr><td><code>?api=json</code></td><td>标准 JSON</td><td>auto / json 解析</td></tr>
                <tr><td><code>?api=text</code></td><td>纯文本</td><td>text</td></tr>
                <tr><td><code>?api=badjson</code></td><td>声明 json 但内容非法</td><td>JSON 保底为字符串</td></tr>
                <tr><td><code>?api=html</code> / <code>?api=xml</code></td><td>HTML / XML</td><td>document</td></tr>
                <tr><td><code>?api=binary</code></td><td>1x1 PNG</td><td>blob / arraybuffer</td></tr>
                <tr><td><code>?api=utf8</code> / <code>?api=gbk</code></td><td>UTF-8 / GBK 中文</td><td>charset 从 content-type 提取</td></tr>
                <tr><td><code>?api=empty</code> / <code>?api=204</code></td><td>空体 200 / 204 无体</td><td>空响应处理</td></tr>
                <tr><td><code>?api=status&amp;code=429</code></td><td>任意状态码 + 业务体</td><td>resolveStatus / err.response</td></tr>
                <tr><td><code>?api=multiheader</code></td><td>重复响应头</td><td>两引擎合并规则</td></tr>
                <tr><td><code>?api=cookie</code></td><td>下发 Cookie</td><td>credentials</td></tr>
                <tr><td><code>?api=delay&amp;ms=3000</code></td><td>延迟响应</td><td>timeout</td></tr>
                <tr><td><code>?api=sse&amp;n=5&amp;ms=300</code></td><td>SSE 流</td><td>responseType:'stream' + onStream</td></tr>
                <tr><td><code>?api=slowchunks&amp;n=10&amp;ms=200</code></td><td>慢速分块</td><td>raw 长流不被 timeout 掐断</td></tr>
                <tr><td><code>?api=large&amp;kb=512</code></td><td>大二进制（带 Content-Length）</td><td>下载进度 / arraybuffer</td></tr>
                <tr><td><code>?api=broken</code></td><td>声明 1MB 只给 1KB 就断开</td><td>响应截断错误</td></tr>
                <tr><td><code>?api=redirect</code></td><td>302</td><td>redirect 跟随</td></tr>
            </tbody>
        </table>
    </div>
</div>

<?php if ($libCode !== ''): ?>
<script><?php echo $libCode; ?></script>
<?php elseif ($libUrl !== ''): ?>
<script src="<?php echo htmlspecialchars($libUrl, ENT_QUOTES, 'UTF-8'); ?>"></script>
<?php endif; ?>

<script>
(function () {
    'use strict';

    var SELF = location.origin + location.pathname;
    var PHP_VERSION = <?php echo json_encode($phpVersion); ?>;
    var LIB_VERSION = <?php echo json_encode($libVersion); ?>;

    /* ---------- 端点 URL ---------- */
    function apiUrl(name, extra) {
        return SELF + '?api=' + name + (extra ? '&' + extra : '');
    }

    /* ---------- 对象检查器：把可枚举 / 不可枚举一起列出来 ---------- */
    function inspect(obj, label) {
        if (label) console.group(label);
        if (obj === null || typeof obj !== 'object') {
            console.log('非对象：', obj);
            if (label) console.groupEnd();
            return obj;
        }
        var names = Object.getOwnPropertyNames(obj);
        console.log('类型：', Object.prototype.toString.call(obj),
            '| 构造器：', obj.constructor && obj.constructor.name);
        console.log('全部自有属性：', names.map(function (k) {
            var d = Object.getOwnPropertyDescriptor(obj, k);
            return k + (d && d.enumerable ? '' : '(不可枚举)');
        }));
        names.forEach(function (k) {
            var d = Object.getOwnPropertyDescriptor(obj, k);
            if (d && 'value' in d) {
                console.log('  .' + k + ' =', d.value);
            }
        });
        console.log('对象本身（可直接展开）：', obj);
        if (label) console.groupEnd();
        return obj;
    }

    /* ---------- 响应 / 错误输出 ---------- */
    function dumpResponse(res) {
        console.log('%c成功响应', 'color:#15803d;font-weight:bold');
        console.log('可枚举字段：', Object.keys(res));
        console.log('不可枚举元数据：', Object.getOwnPropertyNames(res).filter(function (k) {
            return !Object.prototype.propertyIsEnumerable.call(res, k);
        }));
        console.log('res.data       =', res.data);
        console.log('res.status     =', res.status);
        console.log('res.statusText =', res.statusText);
        console.log('res.headers    =', res.headers);
        console.log('res.config     =', res.config);
        console.log('res 字段       =', Object.keys(res));
        console.log('原生句柄       = 不对外暴露；需要时用 responseType: "raw"');
        if (res.data instanceof Response) {
            console.log('  raw 模式 data.bodyUsed =', res.data.bodyUsed,
                '| .url =', res.data.url, '| .redirected =', res.data.redirected);
        }
        console.log('res.engine     =', res.engine, '（唯一不可枚举元数据）');
        console.log('完整响应对象：', res);
        return res;
    }

    function dumpError(err) {
        console.log('%c失败响应', 'color:#b91c1c;font-weight:bold');
        if (!err || !err.isBxfError) {
            console.log('不是 BxfError（可能是库未加载或调用写错）：', err);
            return err;
        }
        console.log('err.code     =', err.code);
        console.log('err.message  =', err.message);
        console.log('err.status   =', err.status);
        console.log('err.config   =', err.config);
        console.log('err.response =', err.response);
        if (err.response) {
            console.log('  —— 拿到了 HTTP 响应，err.response 是完整 BxfResponse');
            console.log('  instanceof Response =', err.response instanceof Response);
            console.log('  .status =', err.response.status, '| .data =', err.response.data);
            console.log('  err.config === err.response.config =', err.config === err.response.config);
            console.log('  err.response 字段 =', Object.keys(err.response));
            console.log('  是否暴露原生句柄 =', 'Response' in err.response, '（与成功 res 同形）');
        } else {
            console.log('  —— err.response 为 undefined：网络层失败，没有 HTTP 响应');
        }
        console.log('err.cause    =', err.cause);
        console.log('完整错误对象：', err);
        return err;
    }

    /* ---------- 请求执行 ---------- */
    async function call(name, extra, options) {
        var url = apiUrl(name, extra);
        var started = performance.now();
        try {
            var res = await api.get(url, options || {});
            console.log('耗时(ms)：', Math.round(performance.now() - started));
            return dumpResponse(res);
        } catch (err) {
            console.log('耗时(ms)：', Math.round(performance.now() - started));
            return dumpError(err);
        }
    }

    /* 开一个折叠分组，任务结束后再关闭，避免分组层层嵌套 */
    function group(title, color, task) {
        console.group('%c' + title, 'color:' + color + ';font-weight:bold');
        return Promise.resolve()
            .then(task)
            .catch(function (err) { console.error(err); })
            .then(function () { console.groupEnd(); });
    }

    /* ---------- 页面按钮 ---------- */
    document.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!btn) return;

        var apiName = btn.getAttribute('data-api');
        var action = btn.getAttribute('data-action');

        if (apiName) {
            var extra = btn.getAttribute('data-extra') || '';
            group('▶ ' + apiName, '#2563eb', function () {
                return call(apiName, extra);
            });
            return;
        }

        if (!action) return;

        if (action === 'timeout') {
            group('▶ timeout（服务端 5s，客户端 500ms）', '#2563eb', function () {
                return call('delay', 'ms=5000', { timeout: 500 });
            });
        }

        if (action === 'cancel') {
            group('▶ cancel（300ms 后主动取消）', '#2563eb', function () {
                var ac = new AbortController();
                var p = call('delay', 'ms=5000', { signal: ac.signal });
                setTimeout(function () { ac.abort(); }, 300);
                return p;
            });
        }

        if (action === 'network') {
            group('▶ network（连不上的地址，测 ERR_NETWORK）', '#2563eb', async function () {
                console.log('目标：http://127.0.0.1:1/unreachable');
                await api.get('http://127.0.0.1:1/unreachable').catch(dumpError);
            });
        }

        if (action === 'resolveStatus') {
            group('▶ resolveStatus 拒绝（429 不在 [200,300) 内）', '#2563eb', function () {
                console.log('请求配置：', { resolveStatus: [[200, 300]] });
                return call('status', 'code=429', { resolveStatus: [[200, 300]] });
            });
        }

        if (action === 'compare') {
            group('▶ 成功 / 状态拒绝 / 网络失败 三项对照', '#7c3aed', async function () {
                console.group('① 成功：BxfResponse 固定 7 字段（含 responseURL / redirected），不暴露原生句柄');
                await dumpResponse(await api.get(apiUrl('json')));
                console.groupEnd();

                console.group('② 429 被 resolveStatus 拒绝：err.response 是完整 BxfResponse');
                await api.get(apiUrl('status', 'code=429'), { resolveStatus: [[200, 300]] })
                    .catch(dumpError);
                console.groupEnd();

                console.group('③ 网络层失败：没有 err.response，但 config 在');
                await api.get('http://127.0.0.1:1/unreachable').catch(dumpError);
                console.groupEnd();
            });
        }

        if (action === 'probeAll') {
            group('▶ 全部端点', '#7c3aed', async function () {
                var endpoints = [
                    ['json', ''], ['text', ''], ['badjson', ''], ['html', ''], ['xml', ''],
                    ['binary', ''], ['utf8', ''], ['gbk', ''], ['empty', ''], ['204', ''],
                    ['status', 'code=429'], ['status', 'code=502'], ['multiheader', ''],
                    ['cookie', ''], ['echo', 'x=1&y=中文'],
                    ['large', 'kb=32'], ['sse', 'n=2&ms=50'], ['slowchunks', 'n=2&ms=50']
                ];
                var rows = [];
                for (var i = 0; i < endpoints.length; i++) {
                    var name = endpoints[i][0];
                    var extra = endpoints[i][1];
                    var t0 = performance.now();
                    try {
                        var res = await api.get(apiUrl(name, extra));
                        rows.push({
                            '端点': name + (extra ? '?' + extra : ''),
                            '状态': res.status,
                            'data 类型': Object.prototype.toString.call(res.data),
                            'data 摘要': String(JSON.stringify(res.data)).slice(0, 60),
                            '耗时ms': Math.round(performance.now() - t0)
                        });
                    } catch (err) {
                        rows.push({
                            '端点': name + (extra ? '?' + extra : ''),
                            '状态': 'ERR ' + (err && err.code),
                            'data 类型': '-',
                            'data 摘要': err && err.message,
                            '耗时ms': Math.round(performance.now() - t0)
                        });
                    }
                }
                console.table(rows);
            });
        }
    });

    /* ---------- 暴露到 window ---------- */
    window.apiUrl = apiUrl;
    window.api = window.bxf ? window.bxf.create({ timeout: 20000 }) : null;
    window.inspect = inspect;
    window.SELF = SELF;

    /* ---------- 顶部信息 ---------- */
    (function renderMeta() {
        var hasLib = typeof window.bxf === 'function';
        var chips = [
            { cls: hasLib ? 'ok' : 'bad', html: '库：' + (hasLib ? ('bxf ' + (LIB_VERSION || '')) : '未加载') },
            { cls: '', html: 'PHP：<b>' + PHP_VERSION + '</b>' },
            { cls: '', html: '页面：<b>' + SELF + '</b>' },
            { cls: '', html: '引擎默认：<b>' + (hasLib ? '按能力自动' : '-') + '</b>' },
            { cls: '', html: 'ReadableStream：<b>' + (typeof ReadableStream !== 'undefined' ? '有' : '无') + '</b>' },
            { cls: '', html: 'DOMParser：<b>' + (typeof DOMParser !== 'undefined' ? '有' : '无') + '</b>' },
        ];
        var host = document.getElementById('meta');
        host.innerHTML = chips.map(function (c) {
            return '<span class="chip ' + c.cls + '">' + c.html + '</span>';
        }).join('');
    })();

    /* ---------- 速查片段 ---------- */
    document.getElementById('snippet').textContent = [
        '// 库与实例已就绪',
        'bxf                    // 全局库（函数，bxf.request === bxf）',
        'api                    // bxf.create({ timeout: 20000 })',
        'apiUrl("json")         // 拼出端点地址',
        'inspect(obj)           // 连不可枚举属性一起列出',
        '',
        '// ① 成功：固定 7 字段（含 responseURL / redirected），不暴露原生 Response / raw',
        'const r = await api.get(apiUrl("json"));',
        'Object.keys(r)                   // data,status,statusText,headers,config,responseURL,redirected',
        'r.responseURL                    // 最终实际请求地址；r.redirected 标记是否重定向',
        '"Response" in r                  // false',
        '"raw" in r                       // false',
        '',
        '// ② 429 被 resolveStatus 拒绝：看 err.response 是完整对象',
        'const e = await api.get(apiUrl("status","code=429"), { resolveStatus: [[200,300]] })',
        '  .catch(e => e);',
        'e.code                           // ERR_HTTP_STATUS',
        'e.response.status                // 429',
        'e.response.data                  // 业务体还在',
        'e.config === e.response.config   // true，可直接回喂',
        '',
        '// ③ 网络失败：err.response 为 undefined',
        'const n = await api.get("http://127.0.0.1:1/x").catch(e => e);',
        'n.code                           // ERR_NETWORK',
        'n.response                       // undefined',
        '',
        '// ④ raw 模式：data 就是未消费的原生 Response（唯一入口）',
        'const raw = await api.get(apiUrl("slowchunks","n=5&ms=200"), { responseType: "raw" });',
        'raw.data instanceof Response     // true',
        'raw.data.bodyUsed                // false',
        'raw.data.body.getReader          // ReadableStream，可直接读或做流中转',
        'raw.data.url                     // 重定向后的最终地址',
        '',
        '// ⑤ SSE 流',
        'await api.get(apiUrl("sse","n=3&ms=100"), {',
        '  responseType: "stream",',
        '  onStream(frame) { console.log("frame:", frame); }',
        '});',
        '',
        '// ⑥ 换引擎对比同一端点',
        'await api.get(apiUrl("json"), { engine: "xhr" });',
    ].join('\n');
})();
</script>
</body>
</html>
