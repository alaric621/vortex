WEBSOCKET localhost:9501
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: {{wsKey}}
Authorization: Bearer {{token}}

{
  "action": "subscribe",
  "topic": "chat_room_01",
  "user_id": "{{userId}}"
}

>>>
// 前置拦截器：在连接建立前执行
// 可以在这里动态生成 Sec-WebSocket-Key 或处理鉴权逻辑
const timestamp = Date.now();
console.log(`Connecting to WS at ${timestamp}`);
console.log("dsfds");


<<<
// 后置拦截器：在收到服务器消息或连接状态改变时执行
// 模拟处理收到的消息流
if (response.active) {
    console.log("WebSocket 连接已建立，开始监听消息...");
}

// 示例：自动处理服务端推送的 Ping 消息
function onMessage(data) {
    const msg = JSON.parse(data);
    if (msg.type === 'ping') {
        return JSON.stringify({ type: 'pong' });
    }
}