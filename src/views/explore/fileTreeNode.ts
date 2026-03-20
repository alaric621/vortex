import * as vscode from "vscode";

export class FileTreeNode extends vscode.TreeItem {
  constructor(uri: vscode.Uri, isRunning: boolean = false) {
    // 变量：name，用于存储名称。
    const name = uri.path.split("/").filter(Boolean).pop() ?? uri.path;
    // 变量：requestUri，用于存储请求资源标识。
    const requestUri = uri.with({
      path: `${uri.path}.vht`
    });
    super(name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = isRunning ? "vortex.requestNode.running" : "vortex.requestNode.idle";
    this.resourceUri = requestUri;
    this.command = {
      command: "vscode.open",
      title: "Open Request",
      arguments: [requestUri],
    };
    this.tooltip = uri.path;
  }
}
