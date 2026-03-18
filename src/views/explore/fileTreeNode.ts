import * as vscode from "vscode";

export class FileTreeNode extends vscode.TreeItem {
  constructor(uri: vscode.Uri) {
    const name = uri.path.split("/").filter(Boolean).pop() ?? uri.path;
    super(name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "vortex.requestNode";
    this.resourceUri =  uri.with({
           path:`${uri.path}.vht`
        });
    this.command = {
      command: "vscode.open",
      title: "Open Request",
      arguments: [
        uri.with({
           path:`${uri.path}.vht`
        })
      ],
    };
    this.tooltip = uri.path;
  }
}
