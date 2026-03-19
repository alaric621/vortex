# 更新日志

本文件记录当前仓库已完成并落地到代码的变化。

## 2026-03-19

### 重点更新（VHT 编辑体验）
- 重构 `.vht` 编辑能力为 AST 驱动的补全与诊断主流程。
- 变量补全、变量诊断、变量装饰器统一围绕 `parser.ts` 产出的 `ast.variables` 进行上下文判断。
- 优化请求行补全：方法、协议、HTTP 版本按位置分段提示。
- 优化 Header 补全：按协议（HTTP / WebSocket / SSE）推荐请求头，且去重已存在 Header。

### 变量相关
- 新增 `src/env.ts`，暴露默认 mock 变量 `vhtMockVariables`：
  - `name`
  - `client.api`
  - `client.token`
  - `env`
- 变量装饰器支持在编辑器中将 `{{expr}}` 显示为解析值，并在光标进入时回显原表达式。
- 修复变量装饰在多行/换行场景下的显示错位问题（跨行变量不做可视替换）。
- 修复 `client['']` 补全插入时可能出现重复 `]` 的问题。

### 诊断增强
- 新增并细化变量诊断分类：
  - `invalid-variable-expression`：变量表达式语法错误（如 `{{env[]}}`）
  - `invalid-variable-type-access`：基础类型非法属性/下标访问（如 `{{env['name']}}`）
  - `unknown-variable-path`：路径不存在（如 `{{client['missing']}}`）
- 保留并强化变量标记配对检查：
  - `unclosed-variable-open`
  - `orphan-variable-close`
- Header 规则补充枚举值校验与特殊值校验（如 `TE`、`Sec-*`）。

### 语法高亮
- 更新 `syntaxes/vht.tmLanguage.json`：
  - 高亮请求方法、协议、主机、端口、路径、HTTP 版本。
  - 支持两种请求行形式：
    - `GET http://host:port/path HTTP/x.x`
    - `GET /path HTTP/x.x`
  - Header Key / Value 分离高亮。
  - `{{ ... }}` 内嵌 `source.js`，脚本块 `>>>/<<<` 内嵌 JS。

### 性能与稳定性
- Completion Provider 增加 AST 缓存，减少重复解析。
- Diagnostics 增加延迟调度与定时器去抖。
- Variable Decorator 增加 AST 缓存与表达式求值缓存。

### 测试
- 诊断规则测试补充变量场景回归用例：
  - `env[]` 应报语法错误而非未定义变量。
  - 基础类型非法下标访问应报类型访问错误。
- 统一 `tests/diagnostics-rules.test.ts` 的测试标题为中文。
- 当前测试结果：`24/24` 通过。

### 文档
- 重写 `README.md`：
  - 删除与现状不一致内容。
  - 以当前代码能力为准，补齐补全、诊断、变量装饰器、语法高亮说明。
- 重写 `CHANGELOG.md` 为当前可追踪版本。

## 2026-03-18

### 基础能力
- 建立 `vortex-fs` 文件系统与树视图基础结构。
- 增加 VHT 解析与转换基础能力（`parser.ts` / `converter.ts`）。
- 增加文件系统与转换层基础测试。
  ================= 节点名称 =================
• TIMESTAMP: 2026-03-19 12:30:05
  REQUEST_ID: req_profile_patch
  NODE: profile/update
  METHOD: PATCH
  URL: https://api.myapp.com/v1/profile
  REQUEST_HEADERS:
    - Authorization: Bearer ****** (masked)
    - User-Agent: VSCode-Extension/1.0
  REQUEST_BODY:
  {"bio":"Exploring AI"}
  STATUS: 403 Forbidden
  DURATION_MS: 88
  RESPONSE_HEADERS:
    - Cache-Control: no-cache
    - X-RateLimit-Remaining: 49
  RESPONSE_BODY:
  {
    "error": "INSUFFICIENT_PERMISSIONS",
    "details": "User does not have 'write' access to this resource."
  }
  OK: false
  ERROR_CODE: INSUFFICIENT_PERMISSIONS
  ERROR_MESSAGE: User does not have 'write' access to this resource.
