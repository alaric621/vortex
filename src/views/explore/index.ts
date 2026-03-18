import * as vscode from "vscode";
import { FileTreeNode } from "./fileTreeNode";
import { FolderTreeNode } from "./folderTreeNode";

export class ExplorerProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  // 1. 建议在构造函数传入 authority，或者写死一个字符串
  constructor(
    private readonly scheme: string,
    private readonly authority: string = "request"
  ) { }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // 2. 这里的根路径必须包含 authority
    // 使用 vscode.Uri.from 是最保险的写法
    const parentUri = element?.resourceUri ?? vscode.Uri.from({
      scheme: this.scheme,
      authority: this.authority,
      path: '/'
    });

    try {
      const entries = await vscode.workspace.fs.readDirectory(parentUri);

      return entries
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, type]) => {
          // 3. Uri.joinPath 会自动继承 parentUri 的 scheme 和 authority
          const uri = vscode.Uri.joinPath(parentUri, name);
          return type === vscode.FileType.Directory
            ? new FolderTreeNode(uri, name)
            : new FileTreeNode(uri);
        });
    } catch {
      return [];
    }
  }
} 