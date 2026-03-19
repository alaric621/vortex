# Log Format Preview (Full Cases)

## 1) JSON 成功

```txt
================= 用户资料/JSON ====================
[12:00:00.092] PRE: 注入鉴权头
POST https://api.myapp.com/v1/profile HTTP/1.1
Authorization: Bearer ****** (masked)
content-type: application/json

status: 201 Created
duration: 88ms
content-type: application/json

status: 201 Created
duration: 88ms
content-type: application/json
{
  "id": "u_1001",
  "name": "alaric",
  "bio": "Exploring AI"
}
[12:00:00.184] POST: 写入成功日志
```

## 2) JSON 失败（权限）

```txt
================= 权限校验/JSON ====================
[12:01:10.010] PRE: 设置角色上下文
PATCH https://api.myapp.com/v1/profile HTTP/1.1
Authorization: Bearer ****** (masked)
content-type: application/json

status: 403 Forbidden
duration: 92ms
content-type: application/json

status: 403 Forbidden
duration: 92ms
content-type: application/json
{
  "error": "INSUFFICIENT_PERMISSIONS",
  "details": "User does not have 'write' access to this resource."
}
[12:01:10.122] POST: 记录失败原因
```

## 3) HTML 响应

```txt
================= 页面抓取/HTML ====================
[12:00:00.092] hello world
GET https://example.com HTTP/1.1
status: 200 OK
duration: 92ms
content-type: text/html; charset=utf-8

status: 200 OK
duration: 92ms
content-type: text/html; charset=utf-8
<!doctype html>
<html>
<head><title>Example Domain</title></head>
<body>
  <h1>Example Domain</h1>
</body>
</html>
[12:00:00.184] fsdfsdf
```

## 4) TXT 响应

```txt
================= 健康检查/TXT ====================
[12:02:20.005] PRE: 检查服务可用性
GET https://api.myapp.com/health HTTP/1.1

status: 200 OK
duration: 21ms
content-type: text/plain; charset=utf-8

status: 200 OK
duration: 21ms
content-type: text/plain; charset=utf-8
ok
[12:02:20.031] POST: 健康检查通过
```

## 5) 无响应体（204）

```txt
================= 删除资源/No Content ====================
[12:03:00.201] PRE: 删除前校验
DELETE https://api.myapp.com/v1/profile/u_1001 HTTP/1.1
Authorization: Bearer ****** (masked)

status: 204 No Content
duration: 47ms
content-type: (none)

status: 204 No Content
duration: 47ms
content-type: (none)
[]
[12:03:00.261] POST: 删除成功
```

## 6) HEAD 请求

```txt
================= 资源探测/HEAD ====================
[12:03:40.110] PRE: 仅验证头
HEAD https://api.myapp.com/v1/profile HTTP/1.1

status: 200 OK
duration: 18ms
content-type: application/json

status: 200 OK
duration: 18ms
content-type: application/json
[]
[12:03:40.141] POST: 头检查完成
```

## 7) 长连接（SSE）

```txt
================= 实时流/SSE ====================
[12:04:10.000] PRE: 订阅事件流
SSE https://httpbingo.org/sse?count=3 HTTP/1.1
accept: text/event-stream

status: 200 OK
duration: 3050ms
content-type: text/event-stream

status: 200 OK
duration: 3050ms
content-type: text/event-stream
[12:04:11.920] {"id":1,"msg":"hello"}
[12:04:13.051] {"id":2,"msg":"world"}
[12:04:13.780] [DONE]
[12:04:13.051] POST: 流关闭，统计=3
```

## 8) WebSocket

```txt
================= 聊天通道/WEBSOCKET ====================
[12:05:00.500] PRE: 建立 WS 通道
WEBSOCKET ws://example.test/socket HTTP/1.1

status: 101 Switching Protocols
duration: 1288ms
content-type: (none)

status: 101 Switching Protocols
duration: 1288ms
content-type: (none)
hello
echo:ping
[12:05:01.788] POST: WS 关闭 code=1000
```

## 9) 连接失败（拒绝连接）

```txt
================= 网络错误/ECONNREFUSED ====================
[12:06:30.001] PRE: 准备发送
GET https://127.0.0.1:443/health HTTP/1.1

status: FAILED
duration: 1200ms
content-type: (none)

status: FAILED
duration: 1200ms
content-type: (none)
connect ECONNREFUSED 127.0.0.1:443
[12:06:31.201] POST: 标记为可重试
```

## 10) 超时失败

```txt
================= 网络错误/TIMEOUT ====================
[12:07:10.100] PRE: 启动超时计时
GET https://api.slow-service.com/data HTTP/1.1

status: FAILED
duration: 5000ms
content-type: (none)

status: FAILED
duration: 5000ms
content-type: (none)
request timeout after 5000ms
[12:07:15.101] POST: 执行降级逻辑
```

## 11) 手动停止

```txt
================= 手动停止/ABORT ====================
[12:08:00.000] PRE: 开始下载
GET https://api.myapp.com/v1/large-export HTTP/1.1

status: FAILED
duration: 233ms
content-type: (none)

status: FAILED
duration: 233ms
content-type: (none)
Stopped by user.
[12:08:00.233] POST: 用户已停止请求
```

## 12) 二进制下载（仅摘要）

```txt
================= 文件下载/BINARY ====================
[12:09:00.000] PRE: 准备下载
GET https://api.myapp.com/v1/report.pdf HTTP/1.1

status: 200 OK
duration: 340ms
content-type: application/pdf

status: 200 OK
duration: 340ms
content-type: application/pdf
[binary content omitted, bytes=84213]
[12:09:00.340] POST: 下载完成
```

## 13) 重定向

```txt
================= 跳转响应/REDIRECT ====================
[12:10:10.010] PRE: 发起请求
GET http://example.org HTTP/1.1

status: 301 Moved Permanently
duration: 35ms
content-type: text/html; charset=UTF-8
location: https://example.org/

status: 301 Moved Permanently
duration: 35ms
content-type: text/html; charset=UTF-8
<html>Moved</html>
[12:10:10.046] POST: 记录跳转地址
```

## 14) 空请求体 + 空响应体

```txt
================= 探活/EMPTY ====================
[12:11:11.111] PRE: 空请求
GET https://api.myapp.com/v1/ping HTTP/1.1

status: 200 OK
duration: 9ms
content-type: (none)

status: 200 OK
duration: 9ms
content-type: (none)
[]
[12:11:11.120] POST: 完成
```
