import * as vscode from "vscode";
import { VhtParser } from "./parser";
import { VhtAST } from "./types";

interface AstCacheEntry {
  version: number;
  ast: VhtAST;
}

export class DocumentAstCache implements vscode.Disposable {
  private readonly parser = new VhtParser();
  private readonly entries = new Map<string, AstCacheEntry>();

  get(document: vscode.TextDocument): VhtAST {
    const key = document.uri.toString();
    const cached = this.entries.get(key);
    if (cached && cached.version === document.version) {
      return cached.ast;
    }

    const ast = this.parser.parse(document.getText());
    this.entries.set(key, { version: document.version, ast });

    if (this.entries.size > 128) {
      this.entries.clear();
      this.entries.set(key, { version: document.version, ast });
    }

    return ast;
  }

  delete(document: vscode.TextDocument | vscode.Uri): void {
    const key = document instanceof vscode.Uri ? document.toString() : document.uri.toString();
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  dispose(): void {
    this.clear();
  }
}
