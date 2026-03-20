import * as vscode from "vscode";
import { isRequestRunning } from "../../core/client";
import { getFileContent, collections } from "../../core/filesystem/store";
import { ensureRequestPathWithoutExtension } from "../../utils/path";
import { FileTreeNode } from "./fileTreeNode";
import { FolderTreeNode } from "./folderTreeNode";

export class ExplorerProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  // 变量：emitter，用于存储emitter。
  private readonly emitter = new vscode.EventEmitter<void>();
  // 变量：onDidChangeTreeData，用于存储ondidchangetree数据。
  readonly onDidChangeTreeData = this.emitter.event;

  // 1. 建议在构造函数传入 authority，或者写死一个字符串
  constructor(
    private readonly scheme: string,
    private readonly authority: string = "request"
  ) { }

  /**
   * 方法：refresh
   * 说明：执行 refresh 相关处理逻辑。
   * @param 无 无参数。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：refresh(); // undefined
   */
  refresh(): void {
    this.emitter.fire();
  }

  /**
   * 方法：getTreeItem
   * 说明：执行 getTreeItem 相关处理逻辑。
   * @param element 参数 element。
   * @returns 返回 vscode.TreeItem 类型结果。
   * 返回值示例：const result = getTreeItem(targetNode); // { label: 'users' }
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * 方法：getChildren
   * 说明：执行 getChildren 相关处理逻辑。
   * @param element 参数 element。
   * @returns 异步返回 vscode.TreeItem[] 类型结果。
   * 返回值示例：const result = await getChildren(targetNode); // [{ id: 'demo' }]
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // 2. 这里的根路径必须包含 authority
    // 使用 vscode.Uri.from 是最保险的写法
    const parentUri = element?.resourceUri ?? vscode.Uri.from({
      scheme: this.scheme,
      authority: this.authority,
      path: '/'
    });

    try {
      // 变量：entries，用于存储entries。
      const entries = await vscode.workspace.fs.readDirectory(parentUri);

      return entries
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, type]) => {
          // 3. Uri.joinPath 会自动继承 parentUri 的 scheme 和 authority
          const uri = vscode.Uri.joinPath(parentUri, name);
          return type === vscode.FileType.Directory
            ? new FolderTreeNode(uri, name)
            : new FileTreeNode(uri, this.isRunningRequest(uri));
        });
    } catch {
      return [];
    }
  }

  /**
   * 方法：isRunningRequest
   * 说明：执行 isRunningRequest 相关处理逻辑。
   * @param uri 参数 uri。
   * @returns 返回布尔值；true 表示条件成立，false 表示条件不成立。
   * 返回值示例：const ok = isRunningRequest(uri); // true
   */
  private isRunningRequest(uri: vscode.Uri): boolean {
    // 变量：request，用于存储请求。
    const request = getFileContent(collections, ensureRequestPathWithoutExtension(uri.path));
    return Boolean(request?.id && isRequestRunning(request.id));
  }
}
