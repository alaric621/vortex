# Vortex 扩展开发需求说明书

## 1. 产品定义
Vortex 是一款基于 **声明式存储** 的接口调试插件。所有接口定义、执行逻辑通过项目根目录的 `vortex.json` 持久化，通过虚拟文件系统 (VFS) 映射为编辑器窗口，实现“数据即文件”的操作流。

---

## 2. 目录结构

### 2.1 物理目录 (Physical)
磁盘实际存储的文件结构：

```text
├── vortex.json            <-- 核心配置文件 (唯一物理真理源)
└── sample/                <-- 测试文件目录 (物理磁盘文件)
    ├── get.vht            <-- 测试示例，不受 vortex.json 管理
    ├── sse.vht            <-- 测试示例
    └── ws.vht             <-- 测试示例
```

### 2.2 虚拟目录 (Virtual)
插件侧边栏通过 VFS 映射生成的视图：

```text
└── Collections/
    ├── 订阅接口.vht        <-- 映射自 vortex.json
    └── 用户管理/
        └── 用户列表/
            ├── 查询列表.vht
            └── 新增用户.vht
```

### 2.3 代码结构 (Source)


```

### 2.4 分层约束

- `src/core/**` 只放纯逻辑，不允许依赖 `vscode`。
- 与请求、解析、存储规则相关的逻辑统一沉淀到 `core`。
- `src/storage`、`src/views`、`src/commands`、`src/completion` 负责 VS Code 宿主适配、UI 交互和调用 `core` 返回状态。

---

## 3. 核心功能描述

### 3.1 变量驱动系统
- **变量格式**：使用 `{{变量名}}` 语法进行占位。
- **表达式能力**：`{{ }}` 内部按 JavaScript 表达式片段处理，支持属性访问、可选链、索引访问等语法；当前解析阶段会保留原始文本，运行阶段再做变量替换。
- **环境解析**：根据 `vortex.json` 中的 `activeEnvironment`，读取对应 `variables` 并替换请求内容。
- **覆盖范围**：变量支持在 URL、请求头 (Headers) 和请求体 (Body) 中使用。

### 3.2 发送请求 (Send Request)
- **一键执行**：支持编辑器标题栏运行按钮、快捷键（`Ctrl/Cmd + Enter`）和侧边栏右键发送。
- **上下文识别**：支持 Collections（`vortex-fs` 虚拟文件）和 Sample（磁盘 `.vht` 文件）。
- **协议适配**：支持 HTTP、WebSocket、SSE。
- **运行时要求**：请求执行依赖 Node.js 全局 `fetch`。
- **客户端封装**：`core/client` 提供可直接 `try/catch` 的请求客户端封装，执行顺序为“查询请求 -> 插值替换 -> 前置 hook -> 发送 -> 后置 hook”。
- **示例**：

```ts
try {
  const obj = await store.query(id);
  if (!obj) {
    throw new Error(`请求不存在: ${id}`);
  }

  await client({
    request: obj,
    variables: await store.getActiveVariables(),
  });
} catch (error) {
  console.error(error);
}
```

- **职责拆分**：
  - `core/client/requestRuntime.ts` 负责变量解析、请求校验、传输调用和结果状态整理。
  - `core/client/requestClient.ts` 负责 `client(...)` / `createRequestClient(...)` 这层可复用客户端封装。
  - `commands/requestExecution.ts` 负责读取 VS Code 当前上下文并把核心返回状态输出到 UI。

### 3.3 语法解析与词法检查
- **文档 AST**：`core/parse/parseVhtDocument.ts` 负责把 `.vht` 文档解析为带位置信息的 AST。
- **统一入口**：`core/parse/index.ts` 提供解析相关能力的统一导出入口。
- **词法检查**：`core/parse/lexicalCheck.ts` 会检查未闭合的 `{{`、孤立的 `}}`、异常的 `>>>/<<<` 标记。
- **编辑器能力复用**：Header 补全等编辑器能力通过解析层的 AST 和光标上下文判断复用同一套结果。

### 3.4 创建节点 (Create Node)
- **交互流程**：通过侧边栏标题栏 `+` 或右键目录触发，只输入一次路径字符串后创建。
- **输入格式**：
  - `/example/测试`：在 `/example` 目录创建名为 `测试` 的请求
  - `测试`：在根目录 `/` 创建名为 `测试` 的请求
- **存储同步**：自动生成唯一 ID，并插入到 `vortex.json` 的 `collections`。
- **自动开启**：创建完成后自动使用 `vscode.open` 打开虚拟文件。

### 3.5 删除节点 (Delete Node)
- **安全保护**：删除前二次确认。
- **数据清理**：从 `vortex.json` 物理移除对应节点并刷新侧边栏。
- **联动关闭**：若该请求对应编辑器已打开，会自动关闭相关 Tab。
- **空目录保留**：`vortex.json` 通过 `folders` 字段持久化虚拟空目录，删除目录中的最后一个节点后目录不会消失。
- **目录删除**：支持删除目录，删除时会级联删除该目录及其子目录中的请求，并同步关闭对应打开标签。
- **快捷删除**：在侧边栏选中请求或目录后，按 `Delete`（macOS 为 `Backspace`）可直接触发删除。
- **快捷键上下文**：TreeView 键盘映射基于 `focusedView == vortex-explorer && listFocus`，与原生 Explorer 一致。

### 3.6 CRUD 统一命令
- 为减少命令碎片化，增删改查统一为 4 个命令（请求/目录共用）：
  - `vortex.request.create`
  - `vortex.request.rename`
  - `vortex.request.delete`
  - `vortex.request.send`
- 侧边栏快捷键：
  - `A`：更新（重命名/移动）
  - `D`：删除
  - `C`：创建（始终从根目录开始，不依赖选中节点）
  - `R`：刷新
  - `Enter`（TreeView）：发送选中请求
  - `Ctrl/Cmd + Enter`（编辑器）：发送当前 `.vht` 请求
  - `Shift + Escape`：停止当前请求

### 3.6.1 命令行为约束（当前实现）
- **Create**：无论从标题栏、右键还是快捷键触发，统一从根目录创建。
- **Rename/Delete**：必须作用于已选中节点；命令执行前会尝试执行 `list.select`，确保焦点节点可被操作。
- **Send**：优先读取当前激活编辑器中的最新文本（含未保存修改），无激活编辑器时回退读取虚拟文件内容。
- **安全限制**：禁止删除根目录 `/`，禁止将节点重命名为根路径 `/`。

### 3.7 新建输入规则
- `aaa/`：新建目录 `aaa`
- `aaa/a`：在 `aaa` 目录下新建请求 `a`
- `aaa/aaa/a`：在 `aaa/aaa` 目录下新建请求 `a`

### 3.8 Header 去重补全
- 在 `.vht` Header 区域提供常见 Header 名自动补全。
- 已存在的 Header（大小写不敏感）不会重复出现在候选列表中，确保同一 Header 只补全一次。

### 3.9 响应输出 (Output Channel)
- **专用通道**：所有请求结果输出到 `Vortex Console`。
- **自动聚焦**：发送请求时自动显示输出面板。
- **内容回显**：包含变量替换后的最终 URL、状态码、耗时、响应体（JSON 自动美化）。

---

## 4. 交互矩阵

| 动作 | 触发源 | 影响对象 | 预期结果 |
| :--- | :--- | :--- | :--- |
| **发送请求** | 编辑器标题栏/快捷键/右键 | 网络 IO | 输出面板弹出并显示结果 |
| **创建节点** | 侧边栏 "+" / 右键 | `vortex.json` | 侧边栏出现新文件并自动打开 |
| **删除节点** | 侧边栏右键 | `vortex.json` | 侧边栏节点消失，编辑器同步关闭 |

---

## 5. `src/core/client` 使用说明

### 5.1 初始化统一客户端

```ts
import { UnifiedClient, type StreamAdapter } from "./src/core/client";

const streamAdapter: StreamAdapter = {
  async connect(url) {
    // 这里接入真实 WS/SSE 实现，返回符合 StreamEndpoint 的对象
    throw new Error(`Not implemented: ${url}`);
  },
};

const client = new UnifiedClient({
  streamAdapter,
  config: {
    commonHeaders: {
      "x-app-id": "vortex",
    },
  },
});
```

### 5.2 HTTP 请求方法示例（全方法）

说明：`client.send(...)` 的 `id` 为必填，且每次请求必须唯一。

```ts
// GET
await client.send({
  id: "req-get-users-001",
  method: "GET",
  url: "https://api.example.com/users",
  query: { page: 1 },
});

// POST
await client.send({
  id: "req-create-user-001",
  method: "POST",
  url: "https://api.example.com/users",
  body: { name: "Alice" },
});

// PUT
await client.send({
  id: "req-replace-user-001",
  method: "PUT",
  url: "https://api.example.com/users/1",
  body: { name: "Alice-Updated" },
});

// PATCH
await client.send({
  id: "req-patch-user-001",
  method: "PATCH",
  url: "https://api.example.com/users/1",
  body: { nickname: "A" },
});

// DELETE
await client.send({
  id: "req-delete-user-001",
  method: "DELETE",
  url: "https://api.example.com/users/1",
});

// HEAD
await client.send({
  id: "req-head-user-001",
  method: "HEAD",
  url: "https://api.example.com/users/1",
});

// OPTIONS
await client.send({
  id: "req-options-users-001",
  method: "OPTIONS",
  url: "https://api.example.com/users",
});

// TRACE
await client.send({
  id: "req-trace-debug-001",
  method: "TRACE",
  url: "https://api.example.com/debug/trace",
});

// CONNECT（通常用于代理隧道场景）
await client.send({
  id: "req-connect-tunnel-001",
  method: "CONNECT",
  url: "https://proxy.example.com/tunnel",
});
```

### 5.3 响应与错误结构

`client.send(...)` 返回统一结构：

```ts
type StandardResponse<T> = {
  ok: boolean;
  status: number;
  traceId: string;
  headers: Record<string, string>;
  data?: T;
  error?: {
    code:
      | "NETWORK_ERROR"
      | "TIMEOUT"
      | "UNAUTHORIZED"
      | "SCHEMA_VALIDATION_ERROR"
      | "CIRCUIT_OPEN"
      | "DUPLICATE_TIMEOUT_POST"
      | "UNKNOWN";
    message: string;
  };
};
```

### 5.4 长连接（WS/SSE）与生命周期

```ts
await client.connect("wss://stream.example.com/events");

client.stream.on("state", (state) => {
  // INITIALIZING -> CONNECTED -> HEARTBEATING -> CLOSING/CLOSED
  console.log("state:", state);
});

client.stream.on("message", (payload) => {
  console.log("message:", payload);
});

client.stream.on("error", (error) => {
  console.error("transport error:", error);
});
```

说明：
- 连接异常时会进入 `PENDING/RECONNECTING` 并自动静默重连。
- 内置保活包 `KEEP_ALIVE`，由 `keepAliveMs` 周期触发。

### 5.5 订阅/取消订阅（引用计数）

```ts
const unsubscribeA = client.subscribe("topic://orders", (payload) => {
  console.log("A got:", payload);
});

const unsubscribeB = client.subscribe("topic://orders", (payload) => {
  console.log("B got:", payload);
});

// 同一 topic 只建立一条物理订阅，内部 refCount=2
unsubscribeA();
// 还有一个订阅者，不会发 UNSUBSCRIBE
unsubscribeB();
// refCount=0，发送 UNSUBSCRIBE 并释放资源
```

### 5.6 中间件（日志脱敏/认证）

```ts
import {
  UnifiedClient,
  createAuthMiddleware,
  createLogMiddleware,
} from "./src/core/client";

const client2 = new UnifiedClient({
  streamAdapter,
  middlewares: [
    createAuthMiddleware(() => process.env.TOKEN),
    createLogMiddleware((message, payload) => {
      console.log(message, payload); // 自动脱敏 authorization/password/token 等字段
    }),
  ],
});
```

### 5.7 弹性策略（重试/熔断/幂等防重）

- 重试：默认对幂等方法（GET/HEAD/OPTIONS/TRACE/PUT/DELETE）在网络错误或 5xx/429 自动重试。
- 熔断：同 host 连续失败达到阈值后打开熔断，短时间内直接返回 `CIRCUIT_OPEN`。
- 幂等防重：POST 超时后记录请求指纹，在 TTL 内再次提交同指纹请求会返回 `DUPLICATE_TIMEOUT_POST`，防止重复提交。

### 5.8 取消请求

```ts
const p = client.send({
  id: "req-export-001",
  method: "GET",
  url: "https://api.example.com/export",
});

client.cancelRequest("req-export-001"); // true 表示取消成功
// 或批量取消
client.cancelAllRequests();

const result = await p;
// result.error?.code === "CANCELLED"
```
