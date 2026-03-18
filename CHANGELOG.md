# 更新日志

## 2026-03-18（命令交互优化）

### 新增
- 完成 `src/command/explore.ts` 的命令实现：`create`、`rename`、`delete`、`send`、`stop`。
- 新增请求输出通道 `Vortex Console`，发送请求时输出状态码、耗时、响应头和响应体。
- 新增快捷键：
  - `C`：创建（始终从根目录创建）
  - `R`：刷新
  - `Shift+Escape`：停止请求
  - TreeView `Enter`：发送选中请求

### 修复
- 修复创建/重命名时文件名输入 `.vht` 造成双后缀的问题。
- 修复发送请求时未优先使用编辑器未保存内容的问题（现在优先读取当前激活编辑器文本）。
- 修复空目录创建“无效果”问题：新增显式虚拟目录存储，支持展示、重命名、删除。
- `rename/delete` 命令执行前统一调用 `list.select`，提升键盘操作一致性。
- 增加根路径安全保护：禁止删除根目录，禁止将节点重命名到 `/`。

## 2026-03-18

### 修复
- 修复 `vortex-fs://request/status.vht` 保存失败问题：根目录请求在更新时路径拼接错误导致匹配失败。
- `FileSystemProvider.writeFile` 统一去除 `.vht` 后缀后再更新数据，避免扩展名影响定位。
- `FileSystemProvider.readFile` 返回真实 `.vht` 文本内容，不再返回空白占位。

### 新增
- 实现 `src/core/paser/index.ts` 的核心能力：
  - `parseVhtToJson`：严格解析请求行、Header、Body、脚本块（`>>>` / `<<<`）。
  - `parserJsonToVht`：将请求对象序列化为 `.vht` 文本。
  - `transform`：输出结构化 AST。
- 增加 `paserJsonToVht` 兼容别名，兼容旧调用。

### 测试
- 新增 `tests/parser.test.ts`（8 个用例）。
- 扩展 `tests/filesystem.test.ts`，增加根目录文件更新回归用例。
