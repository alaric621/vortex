import type * as vscode from "vscode";
import type { Collections } from "../typings/filesystem";
import { virtualFolders } from "./core/filesystem/virtualFolders";
import { createWorkspaceConfigStore, resolveConfiguredVariables } from "./contextStore";
import { createRuntimeContext } from "./runtimeContext";

const createClientScript = (tag: string) => ({
  pre: `console.log('${tag} pre hook', client);`,
  post: `console.log('${tag} post hook', client);`
});

const defaultCollections: Collections[] = [
  {
    id: "req_get_health",
    type: "GET",
    name: "GET-健康检查",
    folder: "/",
    url: "https://postman-echo.com/get?source=vortex",
    ctime: 1711000000000,
    mtime: 1711000000000,
    headers: {
      Accept: "application/json"
    },
    body: "",
    scripts: createClientScript("GET-健康检查")
  },
  {
    id: "req_post_create_user",
    type: "POST",
    name: "POST-创建用户",
    folder: "/",
    url: "https://postman-echo.com/post",
    ctime: 1711000100000,
    mtime: 1711000100000,
    headers: {
      "Content-Type": "application/json"
    },
    body: "{\n  \"name\": \"{{name}}\"\n}",
    scripts: createClientScript("POST-创建用户")
  },
  {
    id: "req_put_replace_user",
    type: "PUT",
    name: "PUT-更新用户",
    folder: "/",
    url: "https://postman-echo.com/put",
    ctime: 1711000200000,
    mtime: 1711000200000,
    headers: {
      "Content-Type": "application/json"
    },
    body: "{\n  \"name\": \"updated-user\"\n}",
    scripts: createClientScript("PUT-更新用户")
  },
  {
    id: "req_delete_user",
    type: "DELETE",
    name: "DELETE-删除用户",
    folder: "/",
    url: "https://postman-echo.com/delete",
    ctime: 1711000300000,
    mtime: 1711000300000,
    headers: {},
    body: "",
    scripts: createClientScript("DELETE-删除用户")
  },
  {
    id: "req_patch_user_status",
    type: "PATCH",
    name: "PATCH-修改状态",
    folder: "/",
    url: "https://postman-echo.com/patch",
    ctime: 1711000400000,
    mtime: 1711000400000,
    headers: {
      "Content-Type": "application/json"
    },
    body: "{\n  \"enabled\": true\n}",
    scripts: createClientScript("PATCH-修改状态")
  },
  {
    id: "req_head_status",
    type: "HEAD",
    name: "HEAD-仅头信息",
    folder: "/",
    url: "https://postman-echo.com/get",
    ctime: 1711000500000,
    mtime: 1711000500000,
    headers: {},
    body: "",
    scripts: createClientScript("HEAD-仅头信息")
  },
  {
    id: "req_options_api",
    type: "OPTIONS",
    name: "OPTIONS-预检请求",
    folder: "/",
    url: "https://postman-echo.com/get",
    ctime: 1711000600000,
    mtime: 1711000600000,
    headers: {
      Origin: "http://localhost:3000"
    },
    body: "",
    scripts: createClientScript("OPTIONS-预检请求")
  },
  {
    id: "req_connect_tunnel",
    type: "CONNECT",
    name: "CONNECT-隧道测试",
    folder: "/",
    url: "http://httpbingo.org/anything/vortex",
    ctime: 1711000700000,
    mtime: 1711000700000,
    headers: {},
    body: "",
    scripts: createClientScript("CONNECT-隧道测试")
  },
  {
    id: "req_trace_echo",
    type: "TRACE",
    name: "TRACE-回显测试",
    folder: "/",
    url: "https://httpbingo.org/anything/vortex",
    ctime: 1711000800000,
    mtime: 1711000800000,
    headers: {
      "Max-Forwards": "5"
    },
    body: "",
    scripts: createClientScript("TRACE-回显测试")
  },
  {
    id: "req_websocket_feed",
    type: "WEBSOCKET",
    name: "WEBSOCKET-实时通道",
    folder: "/",
    url: "wss://ws.postman-echo.com/raw",
    ctime: 1711000900000,
    mtime: 1711000900000,
    headers: {},
    body: "{\"action\":\"subscribe\",\"channel\":\"prices\"}",
    scripts: createClientScript("WEBSOCKET-实时通道")
  },
  {
    id: "req_sse_events",
    type: "SSE",
    name: "SSE-事件流",
    folder: "/",
    url: "https://httpbingo.org/sse?count=5&duration=20s&delay=1s",
    ctime: 1711001000000,
    mtime: 1711001000000,
    headers: {
      Accept: "text/event-stream"
    },
    body: "",
    scripts: createClientScript("SSE-事件流")
  },
  {
    id: "req_eventsource_notifications",
    type: "EVENTSOURCE",
    name: "EVENTSOURCE-通知流",
    folder: "/",
    url: "https://httpbingo.org/sse?count=5&duration=20s&delay=1s",
    ctime: 1711001100000,
    mtime: 1711001100000,
    headers: {
      Accept: "text/event-stream"
    },
    body: "",
    scripts: createClientScript("EVENTSOURCE-通知流")
  },
  {
    id: "req_subscribe_topic",
    type: "SUBSCRIBE",
    name: "SUBSCRIBE-订阅主题",
    folder: "/",
    url: "https://httpbingo.org/anything/vortex",
    ctime: 1711001200000,
    mtime: 1711001200000,
    headers: {
      Prefer: "wait=30"
    },
    body: "",
    scripts: createClientScript("SUBSCRIBE-订阅主题")
  },
  {
    id: "req_unsubscribe_topic",
    type: "UNSUBSCRIBE",
    name: "UNSUBSCRIBE-取消订阅",
    folder: "/",
    url: "https://httpbingo.org/anything/vortex",
    ctime: 1711001300000,
    mtime: 1711001300000,
    headers: {},
    body: "",
    scripts: createClientScript("UNSUBSCRIBE-取消订阅")
  }
];

export interface GlobContext {
  [key: string]: unknown;
  name: string;
  client: {
    api: string;
    token: string;
  };
  env: {};
  collections: Collections[];
  virtualFolders: Set<string>;
}

// 变量：globContext，全局上下文对象，汇总默认变量与请求集合。
export const globContext: GlobContext = {
  name: "demo-user",
  client: {
    api: "demo-api-key-123",
    token: "demo-token"
  },
  env: {
     host:"",
  },
  collections: defaultCollections,
  virtualFolders
};

// 变量：vhtMockVariables，默认变量快照，作为运行时变量的基础模板。
export const vhtMockVariables: Record<string, unknown> = {
  name: globContext.name,
  client: cloneValue(globContext.client),
  env: globContext.env
};

const workspaceConfigStore = createWorkspaceConfigStore();

const runtimeContext = createRuntimeContext({
  cloneValue,
  getBaseVariables: getBaseVhtVariables,
  invalidateBaseVariables: documentUri => workspaceConfigStore.invalidate(documentUri)
});

export const {
  getVhtVariables,
  createMutableVhtVariables,
  createMutableBaseVhtVariables,
  setRuntimeVhtVariables,
  clearRuntimeVhtVariables,
  refreshBaseVhtVariables,
  onDidChangeVhtVariables
} = runtimeContext;

/**
 * 方法：cloneValue
 * 说明：深拷贝对象和数组，防止引用污染。
 * @param value 参数 value。
 * @returns 返回 T 类型结果。
 * 返回值示例：const result = cloneValue({ ... }); // { ok: true }
 */
function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneValue(item)])
    ) as T;
  }

  return value;
}

/**
 * 方法：getBaseVhtVariables
 * 说明：获取基础变量（配置优先，缺失回退默认值）。
 * @param documentUri 参数 documentUri。
 * @returns 返回 Record<string, unknown> 类型结果。
 * 返回值示例：const result = getBaseVhtVariables(uri); // { token: 'demo-token', env: 'dev' }
 */
function getBaseVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
  // 变量：config，用于保存当前流程中的中间状态。
  const config = workspaceConfigStore.get(documentUri);
  return config ? resolveConfiguredVariables(config, vhtMockVariables) : vhtMockVariables;
}
