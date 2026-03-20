import * as vscode from "vscode";
import { registerExploreCommands } from "../command/explore";
import { FileSystemProvider } from "../core/filesystem/FileSystemProvider";
import { ExplorerProvider } from "../views/explore";

/**
 * 方法：registerExplorer
 * 说明：执行 registerExplorer 相关处理逻辑。
 * @param context 参数 context。
 * @param scheme 参数 scheme。
 * @param authority 参数 authority。
 * @returns 返回 ExplorerProvider 类型结果。
 * 返回值示例：const result = registerExplorer({ ... }, 'demo-value', 'demo-value'); // { ok: true }
 */
export function registerExplorer(
  context: vscode.ExtensionContext,
  scheme: string,
  authority: string
): ExplorerProvider {
  // 变量：fsProvider，用于存储fsprovider。
  const fsProvider = new FileSystemProvider();
  // 变量：explorer，用于存储explorer。
  const explorer = new ExplorerProvider(scheme, authority);
  // 变量：treeView，用于存储treeview。
  const treeView = vscode.window.createTreeView("vortex-explorer", {
    treeDataProvider: explorer
  });
  // 变量：refresh，用于存储refresh。
  const refresh = () => {
    fsProvider.refresh();
    explorer.refresh();
  };

  context.subscriptions.push(
    treeView,
    vscode.workspace.registerFileSystemProvider(scheme, fsProvider),
    ...registerExploreCommands(scheme, authority, fsProvider, explorer),
    vscode.commands.registerCommand("vortex.request.refresh", refresh)
  );

  return explorer;
}
