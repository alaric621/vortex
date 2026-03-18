SSE http://localhost:8080/v1/events
Accept: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Last-Event-ID: {{ a }}

>>>
// 前置拦截器：建立连接前的准备
console.log("准备监听 SSE 事件流...");
request.headers['X-Timestamp'] = Date.now();

<<<
// 后置拦截器：处理持续不断的推送数据
// 由于 contentName 映射为 source.js，这里可以使用 JS 处理逻辑
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("收到推送数据:", data);
    
    // 如果收到特定的结束信号，可以关闭连接
    if (data.status === 'finished') {
        eventSource.close();
    }
};

eventSource.onerror = (err) => {
    console.error("SSE 连接异常:", err);
};