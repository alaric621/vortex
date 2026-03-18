import * as vscode from "vscode";

export class FolderTreeNode extends vscode.TreeItem {
  constructor(
    readonly uri: vscode.Uri,
    readonly folderName: string,
  ) {
    super(folderName, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "vortex.folderNode";
    this.resourceUri = uri;
    this.iconPath = new vscode.ThemeIcon("folder");
  }
}
