import * as fs from "node:fs";
import * as path from "node:path";
import type * as vscode from "vscode";
import type { Collections } from "../typings/filesystem";
import { virtualFolders } from "./core/filesystem/virtualFolders";

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

export interface VortexWorkspaceConfig {
  activeEnvironment?: string;
  variables?: Record<string, unknown>;
  environments?: Record<string, Record<string, unknown>>;
}

interface FileAccess {
  existsSync(filePath: string): boolean;
  readFileSync(filePath: string, encoding: BufferEncoding): string;
}

interface WorkspaceRootResolver {
  getRoots(documentUri?: vscode.Uri): string[];
}

type VariableListener = (documentUri?: vscode.Uri) => void;

class WorkspaceConfigStore {
  // 变量：cache，用于保存当前流程中的中间状态。
  private readonly cache = new Map<string, VortexWorkspaceConfig | null>();

  constructor(
    private readonly fileAccess: FileAccess,
    private readonly rootResolver: WorkspaceRootResolver
  ) {}

  /**
   * 方法：get
   * 说明：按文档所在工作区读取配置缓存。
   * @param documentUri 参数 documentUri。
   * @returns 命中时返回 VortexWorkspaceConfig，未命中返回 undefined。
   * 返回值示例：const result = get(uri); // { ok: true } 或 undefined
   */
  get(documentUri?: vscode.Uri): VortexWorkspaceConfig | undefined {
    for (const root of this.rootResolver.getRoots(documentUri)) {
      // 变量：cached，用于保存当前流程中的中间状态。
      const cached = this.readCachedConfig(root);
      if (cached) {
        return cached;
      }
    }

    return undefined;
  }

  /**
   * 方法：invalidate
   * 说明：按工作区或全局清理配置缓存。
   * @param documentUri 参数 documentUri。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：invalidate(uri); // undefined
   */
  invalidate(documentUri?: vscode.Uri): void {
    // 变量：roots，用于保存当前流程中的中间状态。
    const roots = this.rootResolver.getRoots(documentUri);
    if (roots.length === 0) {
      this.cache.clear();
      return;
    }

    for (const root of roots) {
      this.cache.delete(root);
    }
  }

  /**
   * 方法：readCachedConfig
   * 说明：读取缓存配置，不存在时触发加载并写入缓存。
   * @param root 参数 root。
   * @returns 命中时返回 VortexWorkspaceConfig，未命中返回 undefined。
   * 返回值示例：const result = readCachedConfig('demo-value'); // { ok: true } 或 undefined
   */
  private readCachedConfig(root: string): VortexWorkspaceConfig | undefined {
    if (!this.cache.has(root)) {
      this.cache.set(root, this.load(root) ?? null);
    }

    // 变量：cached，用于保存当前流程中的中间状态。
    const cached = this.cache.get(root);
    return cached ?? undefined;
  }

  /**
   * 方法：load
   * 说明：从 vortex.json 读取并解析工作区配置。
   * @param root 参数 root。
   * @returns 命中时返回 VortexWorkspaceConfig，未命中返回 undefined。
   * 返回值示例：const result = load('demo-value'); // { ok: true } 或 undefined
   */
  private load(root: string): VortexWorkspaceConfig | undefined {
    // 变量：configPath，用于保存当前流程中的中间状态。
    const configPath = path.join(root, "vortex.json");
    if (!this.fileAccess.existsSync(configPath)) {
      return undefined;
    }

    try {
      return JSON.parse(this.fileAccess.readFileSync(configPath, "utf8")) as VortexWorkspaceConfig;
    } catch {
      return undefined;
    }
  }
}

// 变量：runtimeVariableOverrides，运行时变量覆写表，按文档 URI 隔离。
const runtimeVariableOverrides = new Map<string, Record<string, unknown>>();
// 变量：runtimeVariableListeners，运行时变量变更监听器集合。
const runtimeVariableListeners = new Set<VariableListener>();
// 变量：workspaceConfigStore，工作区配置缓存实例。
const workspaceConfigStore = new WorkspaceConfigStore(createNodeFileAccess(), createWorkspaceRootResolver());

/**
 * 方法：getVhtVariables
 * 说明：获取当前文档生效变量，优先运行时覆写。
 * @param documentUri 参数 documentUri。
 * @returns 返回 Record<string, unknown> 类型结果。
 * 返回值示例：const result = getVhtVariables(uri); // { token: 'demo-token', env: 'dev' }
 */
export function getVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
  // 变量：runtimeVariables，用于保存当前流程中的中间状态。
  const runtimeVariables = getRuntimeVariables(documentUri);
  return runtimeVariables ?? getBaseVhtVariables(documentUri);
}

/**
 * 方法：createMutableVhtVariables
 * 说明：返回当前变量的可变深拷贝。
 * @param documentUri 参数 documentUri。
 * @returns 返回 Record<string, unknown> 类型结果。
 * 返回值示例：const result = createMutableVhtVariables(uri); // { token: 'demo-token', env: 'dev' }
 */
export function createMutableVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
  return cloneValue(getVhtVariables(documentUri));
}

/**
 * 方法：createMutableBaseVhtVariables
 * 说明：返回基础变量（不含运行时覆写）的深拷贝。
 * @param documentUri 参数 documentUri。
 * @returns 返回 Record<string, unknown> 类型结果。
 * 返回值示例：const result = createMutableBaseVhtVariables(uri); // { token: 'demo-token', env: 'dev' }
 */
export function createMutableBaseVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
  return cloneValue(getBaseVhtVariables(documentUri));
}

/**
 * 方法：setRuntimeVhtVariables
 * 说明：设置文档级运行时变量覆写。
 * @param documentUri 参数 documentUri。
 * @param variables 参数 variables。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：setRuntimeVhtVariables(uri, { token: 'abc' }); // undefined
 */
export function setRuntimeVhtVariables(documentUri: vscode.Uri, variables: Record<string, unknown>): void {
  runtimeVariableOverrides.set(documentUri.toString(), cloneValue(variables));
  emitRuntimeVariableChange(documentUri);
}

/**
 * 方法：clearRuntimeVhtVariables
 * 说明：清理指定文档或全局运行时变量覆写。
 * @param documentUri 参数 documentUri。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：clearRuntimeVhtVariables(uri); // undefined
 */
export function clearRuntimeVhtVariables(documentUri?: vscode.Uri): void {
  // 变量：key，用于保存当前流程中的中间状态。
  const key = toRuntimeKey(documentUri);
  if (!key) {
    runtimeVariableOverrides.clear();
    emitRuntimeVariableChange();
    return;
  }

  if (runtimeVariableOverrides.delete(key)) {
    emitRuntimeVariableChange(documentUri);
  }
}

/**
 * 方法：refreshBaseVhtVariables
 * 说明：刷新基础变量缓存并广播变更。
 * @param documentUri 参数 documentUri。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：refreshBaseVhtVariables(uri); // undefined
 */
export function refreshBaseVhtVariables(documentUri?: vscode.Uri): void {
  workspaceConfigStore.invalidate(documentUri);
  emitRuntimeVariableChange();
}

/**
 * 方法：onDidChangeVhtVariables
 * 说明：注册变量变更监听并返回取消订阅句柄。
 * @param listener 参数 listener。
 * @returns 返回 { dispose(): void } 类型结果。
 * 返回值示例：const result = onDidChangeVhtVariables(() => {}); // { dispose: () => {} }
 */
export function onDidChangeVhtVariables(listener: VariableListener): { dispose(): void } {
  runtimeVariableListeners.add(listener);
  return {
    /**
     * 方法：dispose
     * 说明：取消当前监听，释放订阅关系。
     * @param 无 本方法无入参。
     * @returns 无返回值，通过副作用完成处理。
     * 返回值示例：dispose(); // undefined
     */
    dispose(): void {
      runtimeVariableListeners.delete(listener);
    }
  };
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
  return config ? resolveConfiguredVariables(config) : vhtMockVariables;
}

/**
 * 方法：getRuntimeVariables
 * 说明：读取文档对应的运行时变量覆写。
 * @param documentUri 参数 documentUri。
 * @returns 命中时返回 Record<string, unknown>，未命中返回 undefined。
 * 返回值示例：const result = getRuntimeVariables(uri); // { token: 'demo-token', env: 'dev' } 或 undefined
 */
function getRuntimeVariables(documentUri?: vscode.Uri): Record<string, unknown> | undefined {
  // 变量：key，用于保存当前流程中的中间状态。
  const key = toRuntimeKey(documentUri);
  return key ? runtimeVariableOverrides.get(key) : undefined;
}

/**
 * 方法：toRuntimeKey
 * 说明：将文档 URI 规范化为覆写映射键。
 * @param documentUri 参数 documentUri。
 * @returns 命中时返回 string，未命中返回 undefined。
 * 返回值示例：const result = toRuntimeKey(uri); // 'demo-value' 或 undefined
 */
function toRuntimeKey(documentUri?: vscode.Uri): string | undefined {
  return documentUri?.toString();
}

/**
 * 方法：emitRuntimeVariableChange
 * 说明：向所有监听器广播变量变更。
 * @param documentUri 参数 documentUri。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：emitRuntimeVariableChange(uri); // undefined
 */
function emitRuntimeVariableChange(documentUri?: vscode.Uri): void {
  for (const listener of runtimeVariableListeners) {
    listener(documentUri);
  }
}

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
 * 方法：createNodeFileAccess
 * 说明：创建 Node.js 文件访问适配器。
 * @param 无 本方法无入参。
 * @returns 返回 FileAccess 类型结果。
 * 返回值示例：const result = createNodeFileAccess(); // { ok: true }
 */
function createNodeFileAccess(): FileAccess {
  return {
    existsSync: filePath => fs.existsSync(filePath),
    readFileSync: (filePath, encoding) => fs.readFileSync(filePath, encoding)
  };
}

/**
 * 方法：createWorkspaceRootResolver
 * 说明：创建工作区根目录解析器。
 * @param 无 本方法无入参。
 * @returns 返回 WorkspaceRootResolver 类型结果。
 * 返回值示例：const result = createWorkspaceRootResolver(); // { ok: true }
 */
function createWorkspaceRootResolver(): WorkspaceRootResolver {
  return {
    /**
     * 方法：getRoots
     * 说明：解析文档关联的全部工作区根目录。
     * @param documentUri 参数 documentUri。
     * @returns 返回 string[] 列表。
     * 返回值示例：const list = getRoots(uri); // [{ id: 'demo' }]
     */
    getRoots(documentUri?: vscode.Uri): string[] {
      // 变量：vscodeModule，用于保存当前流程中的中间状态。
      const vscodeModule = getVSCodeModule();
      if (!vscodeModule) {
        return [];
      }

      // 变量：roots，用于保存当前流程中的中间状态。
      const roots = new Set<string>();
      // 变量：activeRoot，用于存储active根节点。
      const activeRoot = documentUri
        ? vscodeModule.workspace.getWorkspaceFolder(documentUri)?.uri.fsPath
        : undefined;

      addWorkspaceRoot(roots, activeRoot);
      for (const workspaceFolder of vscodeModule.workspace.workspaceFolders ?? []) {
        addWorkspaceRoot(roots, workspaceFolder.uri.fsPath);
      }

      return Array.from(roots);
    }
  };
}

/**
 * 方法：getGlobalVSCodeModule
 * 说明：从全局注入对象读取 vscode 模块。
 * @param 无 本方法无入参。
 * @returns 命中时返回 typeof vscode，未命中返回 undefined。
 * 返回值示例：const result = getGlobalVSCodeModule(); // { ok: true } 或 undefined
 */
function getGlobalVSCodeModule(): typeof vscode | undefined {
  return (globalThis as { __vscode?: typeof vscode }).__vscode;
}

/**
 * 方法：getVSCodeModule
 * 说明：优先读取全局注入，失败时回退 require。
 * @param 无 本方法无入参。
 * @returns 命中时返回 typeof vscode，未命中返回 undefined。
 * 返回值示例：const result = getVSCodeModule(); // { ok: true } 或 undefined
 */
function getVSCodeModule(): typeof vscode | undefined {
  // 变量：globalModule，用于保存当前流程中的中间状态。
  const globalModule = getGlobalVSCodeModule();
  if (globalModule) {
    return globalModule;
  }

  try {
    return require("vscode") as typeof vscode;
  } catch {
    return undefined;
  }
}

/**
 * 方法：addWorkspaceRoot
 * 说明：将有效路径加入工作区根目录集合。
 * @param roots 参数 roots。
 * @param fsPath 参数 fsPath。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：addWorkspaceRoot(new Set(), 'demo-value'); // undefined
 */
function addWorkspaceRoot(roots: Set<string>, fsPath?: string): void {
  if (fsPath) {
    roots.add(fsPath);
  }
}

/**
 * 方法：resolveConfiguredVariables
 * 说明：合并基础变量与活动环境变量。
 * @param config 参数 config。
 * @returns 返回 Record<string, unknown> 类型结果。
 * 返回值示例：const result = resolveConfiguredVariables(config); // { token: 'demo-token', env: 'dev' }
 */
function resolveConfiguredVariables(config: VortexWorkspaceConfig): Record<string, unknown> {
  // 变量：baseVariables，用于保存当前流程中的中间状态。
  const baseVariables = config.variables ?? {};
  // 变量：activeVariables，用于保存当前流程中的中间状态。
  const activeVariables = config.activeEnvironment
    ? config.environments?.[config.activeEnvironment]
    : undefined;

  if (activeVariables) {
    return { ...baseVariables, ...activeVariables };
  }

  return Object.keys(baseVariables).length > 0 ? baseVariables : vhtMockVariables;
}
