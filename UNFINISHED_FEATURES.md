# Unfinished Features

## 当前未完成的功能

### 1. 命令工作流未接完
- `package.json` 已声明 `vortex.request.create`、`vortex.request.rename`、`vortex.request.delete`、`vortex.request.send`、`vortex.request.stop`
- `src/extension.ts` 当前只注册了 `vortex.request.refresh`
- 影响：相关命令虽然出现在 UI、菜单和快捷键中，但运行时没有处理器

### 2. 请求发送与停止仍为占位实现
- `src/core/client/index.ts` 中：
  - `send()` 为空实现
  - `stop()` 为空实现
- 影响：无法发起真实 HTTP、WS、SSE 请求，也没有请求生命周期管理

### 3. 虚拟文件系统读写链路未完成
- `src/core/filesystem/FileSystemProvider.ts` 中：
  - `readFile()` 返回空内容
  - `writeFile()` 为空实现
  - `createDirectory()` 明确不支持
- 影响：请求节点虽然可以显示，但打开内容、编辑回写、目录创建都不完整

### 4. 文件系统底层能力已存在，但未接入扩展工作流
- `src/core/filesystem/context.ts` 已实现：
  - `createItem`
  - `renameNode`
  - `deleteNode`
  - `updateFile`
  - `getFileContent`
- 影响：数据层已有基础能力，但没有通过命令注册和 VFS 完整接线到 VS Code 扩展层

### 5. 环境变量仍是 Mock
- 当前变量来源仍是 `src/env.ts`
- `src/core/vht/variableDecorator.ts` 中存在 TODO，后续需切换到 `vortex.json activeEnvironment variables`
- 影响：不支持工作区级环境配置、多环境切换和真实运行时变量解析

### 6. 命令模块尚未形成
- `src/command/explore.ts` 当前为空文件
- 影响：命令层逻辑尚未抽离，后续扩展 create、send、delete 等流程缺少承载位置

## 当前状态判断
- 已基本完成：VHT 解析、补全、诊断、变量装饰，以及对应单元测试
- 未完成重点：从请求树管理到文件编辑、请求发送、环境解析的完整闭环

## 建议下一步
1. 优先完成 VFS `readFile()` / `writeFile()`，先打通请求文件编辑闭环
2. 补齐 `create` / `rename` / `delete` 命令注册，接上现有文件系统数据层
3. 实现 HTTP 的最小可用 `send()` / `stop()`，先不扩展到 WS / SSE
4. 最后再接 `vortex.json` 和多环境变量管理
