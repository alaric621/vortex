import * as fs from "node:fs";
import * as path from "node:path";
import type * as vscode from "vscode";

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

export class WorkspaceConfigStore {
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

export function createWorkspaceConfigStore(): WorkspaceConfigStore {
  return new WorkspaceConfigStore(createNodeFileAccess(), createWorkspaceRootResolver());
}

export function resolveConfiguredVariables(
  config: VortexWorkspaceConfig,
  fallback: Record<string, unknown>
): Record<string, unknown> {
  // 变量：baseVariables，用于保存当前流程中的中间状态。
  const baseVariables = config.variables ?? {};
  // 变量：activeVariables，用于保存当前流程中的中间状态。
  const activeVariables = config.activeEnvironment
    ? config.environments?.[config.activeEnvironment]
    : undefined;

  if (activeVariables) {
    return { ...baseVariables, ...activeVariables };
  }

  return Object.keys(baseVariables).length > 0 ? baseVariables : fallback;
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
