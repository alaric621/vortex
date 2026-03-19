import * as vscode from "vscode";

export class FileTreeNode extends vscode.TreeItem {
  constructor(uri: vscode.Uri, isRunning: boolean = false) {
    const name = uri.path.split("/").filter(Boolean).pop() ?? uri.path;
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
