# 🛸 Vortex

**Vortex** 是一款专为 VS Code 打造的高性能 HTTP 协作插件。目前核心聚焦于：
- 📂 **Vortex-FS**: 虚拟文件系统与动态请求树视图。
- ⚡ **VHT (Vortex HTTP)**: 极致的编辑体验，包括语法高亮、智能补全、变量感知及实时诊断。

---

## 🌟 Features

* 🧠 **AST 驱动引擎**: 请求行、Header、Body、脚本块、变量节点统一解析与定位。
* ⚡ **实时自动补全**: 请求方法/协议/版本、Header Key/Value、`{{ }}` 变量路径补全。
* ✅ **严格语法诊断**: 覆盖请求行、Header 枚举值、Body 结构、变量表达式与类型访问错误。
* 🎨 **增强语法高亮**: URL 协议/主机/端口/路径、HTTP 版本、Header 与脚本块分层高亮。
* 🔍 **变量装饰器预览**: `{{expr}}` 可显示解析值，光标进入时恢复原表达式便于编辑。
* 🗂️ **Vortex-FS 浏览能力**: 基于虚拟文件系统提供请求树浏览与刷新。

---

## 🛠️ 当前集成状态

* **扩展入口**: `src/extension.ts`
* **核心命令**: 已注册 `vortex.request.refresh` 🔄
* **编辑器赋能 (`vht`)**:
    * 💡 **Completion**: 智能上下文补全
    * 🚫 **Diagnostics**: 实时语法校验
    * 🎨 **Decorators**: 变量值原位预览

> **注意**: `package.json` 中定义的 `create/rename/delete/send/stop` 命令处理器正在 🚧 施工中。

---

## 🏗️ 开发与调试

### 📋 环境要求
* **Runtime**: Node.js 18+
* **Host**: VS Code 1.109+

### 🚀 本地起步
```bash
npm install
npm run compile
```
* **调试**: 按 `F5` 启动 **Extension Development Host**。
* **单元测试**: `npm test -- --run` ✅

---

## 📂 项目结构概览

```text
src/
 ├── 🌐 extension.ts           # 扩展生命周期入口
 ├── 📋 env.ts                 # 变量源 (vhtMockVariables)
 ├── ⚙️ core/
 │    ├── 📂 filesystem/       # 虚拟文件系统 (VFS) 逻辑
 │    └── 📝 vht/              # VHT 引擎 (解析、补全、诊断)
 │         ├── parser.ts       # 核心 AST 解析器
 │         ├── completion.ts   # 补全分发中心
 │         ├── diagnostics.ts  # 诊断服务
 │         └── converter.ts    # AST/JSON 转换器
 ├── 🖥️ views/                 # TreeView 视图层
 └── 🎨 syntaxes/              # TextMate 语法定义
```

---

## 📝 VHT 语法特性

### 🛰️ 请求行 (Request Line)
支持全量方法：`GET`, `POST`, `PUT`, `PATCH`, `DELETE` 等 **15+** 种协议。
```http
GET http://localhost:9501/api HTTP/1.1
```

### 🏷️ 头部 (Headers)
```http
Content-Type: application/json
Authorization: Bearer {{client['token']}}
```

### 🖱️ 脚本块 (Scripts)
```javascript
>>>
console.log('请求前置逻辑')
<<<
console.log('响应后置处理')
```

### 🔍 变量表达式
支持点语法与中括号语法：`{{name}}`、`{{client.api}}`、`{{env['key']}}`。

---

## 🧠 核心引擎能力

### 🌳 AST 解析 (`parser.ts`)
* **Nodes**: 精确识别 `RequestLine`, `Header`, `Body`, `Script`。
* **Variables**: 自动提取所有 `{{...}}` 的位置与表达式。
* **Error Tolerance**: 具备容错解析能力，精准定位“脚本前缺少空行”等异常。

### 💡 智能补全 (`Completion`)
1.  **请求行**: 自动提示 方法 -> 协议 -> URL -> HTTP版本。
2.  **Header**: 
    * 根据协议（HTTP/WS/SSE）动态推荐。
    * 自动去重，支持常见 Value 模板补全。
3.  **变量**: 
    * 基于 `vhtMockVariables` 的深度补全。
    * 智能点语法/路径探测。

### 🚨 语法诊断 (`Diagnostics`)
* **请求校验**: 方法缺失、URL非法、版本错误。
* **Header校验**: 重复定义、空值检查、枚举值校验。
* **变量校验**: 未闭合表达式、非法路径访问、类型不匹配。

### 🎭 变量装饰器
* **静默模式**: 自动将 `{{env}}` 替换为真实值预览。
* **焦点模式**: 鼠标移入时恢复原始表达式，确保顺畅编辑。

---

## 🌐 虚拟文件系统 (VFS)

* ✅ **FileSystemProvider**: 支持虚拟目录读取与节点管理。
* 🚧 **I/O 状态**: `readFile/writeFile` 当前为 Mock 逻辑。
* 🚧 **Client**: 请求发送链路 `core/client` 待对接真实网络层。

---

## ⚠️ 已知限制与规划

* 🔌 **连线状态**: 多数 UI 命令尚未绑定业务逻辑。
* 🌍 **环境切换**: 变量系统尚未接入 `vortex.json` 配置文件。
* 📡 **网络层**: 暂不支持真实的 HTTP/WS 请求外发。

---

## 🗺️ 开发计划（能力扩展）

| 模块 | 功能特性 | 描述 | 状态 |
| --- | --- | --- | --- |
| 🔌 命令与工作流 | 请求生命周期管理 | 实现创建、重命名、删除、发送、停止的一体化交互 | 🚧 施工中 |
| 🔌 命令与工作流 | 树视图联动 | 支持从请求树到编辑器的无缝跳转与状态同步 | ✅ 已接入 |
| 🌐 请求运行时 | 全协议支持 | 接入真实的 HTTP / WebSocket / SSE 网络请求能力 | 📅 待开发 |
| 🌐 请求运行时 | 链路可观测性 | 提供发送前、发送中、响应后的全链路日志输出 | 📅 待开发 |
| 🌐 请求运行时 | 脚本协同执行 | 实现前置/后置脚本与请求上下文的深度绑定 | 🚧 逻辑占位 |
| 🌍 环境与变量 | 多环境管理 | 支持按工作区切换环境配置（vortex.json） | 📅 待开发 |
| 🌍 环境与变量 | 动态变量解析 | 实现变量实时解析、手动刷新及运行时覆盖 | 🚧 Mock 阶段 |
| 🌍 环境与变量 | 一致性增强 | 完善变量表达式在补全、诊断与装饰器中的表现 | ✅ 已接入 |
| ✨ 编辑体验 | 精细化高亮 | 覆盖 URL 片段、版本、端口及表达式子结构的高亮 | 🚧 持续优化 |
| ✨ 编辑体验 | AST 诊断扩展 | 增加结构约束与跨段一致性的语法校验规则 | ✅ 已接入 |
| ✨ 编辑体验 | 性能优化 | 确保在大文件场景下的解析、补全与诊断稳定性 | ⚙️ 持续调优 |
