GET http://localhost:{{port}}/api/v1/status
Authorization: Bearer {{token}}
X-Request-Id: {{ $guid }}
Accept: */*

<<<
// 后置拦截器：处理返回结果
if (response.status === 200) {
    // 将返回的某个字段存入全局变量，供下一个请求使用
    context.lastStatus = response.json().status;
    console.log("状态获取成功");
} else {
    console.error("服务器响应异常");
}