import * as vscode from "vscode";

export interface ClientLogView {
  appendLine(value: string): void;
  show(preserveFocus?: boolean): void;
  clear(): void;
}

export const CLIENT_PANEL_CONTAINER_ID = "vortex-panel";
export const CLIENT_PANEL_VIEW_ID = "vortex-client-panel-view";

class ClientPanelViewProvider implements vscode.WebviewViewProvider, ClientLogView, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly lines: string[] = [];

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: false
    };
    webviewView.onDidDispose(() => {
      if (this.view === webviewView) {
        this.view = undefined;
      }
    });
    this.render();
  }

  appendLine(value: string): void {
    this.lines.push(value);
    if (this.lines.length > 1000) {
      this.lines.splice(0, this.lines.length - 1000);
    }
    this.render();
  }

  show(preserveFocus: boolean = true): void {
    void vscode.commands.executeCommand(`workbench.view.extension.${CLIENT_PANEL_CONTAINER_ID}`);
    this.view?.show?.(preserveFocus);
    this.render();
  }

  clear(): void {
    this.lines.length = 0;
    this.render();
  }

  dispose(): void {
    this.view = undefined;
    this.lines.length = 0;
  }

  private render(): void {
    if (!this.view) {
      return;
    }

    const body = this.lines.map(line => renderLine(line)).join("");
    this.view.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --accent: var(--vscode-textLink-foreground);
      --ok: var(--vscode-testing-iconPassed);
      --warn: var(--vscode-testing-iconQueued);
      --err: var(--vscode-testing-iconFailed);
      --info: var(--vscode-symbolIconVariableForeground);
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font: 12px/1.6 var(--vscode-editor-font-family, ui-monospace, monospace);
    }
    .log {
      padding: 12px 14px 20px;
    }
    .line {
      white-space: pre-wrap;
      word-break: break-word;
      padding: 1px 0;
    }
    .divider {
      color: var(--border);
    }
    .send {
      color: var(--accent);
      font-weight: 600;
    }
    .done, .status {
      color: var(--ok);
    }
    .error, .hook-error {
      color: var(--err);
      font-weight: 600;
    }
    .stopped {
      color: var(--warn);
      font-weight: 600;
    }
    .section, .connect, .websocket {
      color: var(--info);
    }
    .event {
      color: var(--warn);
    }
    .meta, .header-entry {
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="log">${body}</div>
</body>
</html>`;
  }
}

let clientPanelViewProvider: ClientPanelViewProvider | undefined;

export function getClientPanel(): ClientLogView {
  if (!clientPanelViewProvider) {
    clientPanelViewProvider = new ClientPanelViewProvider();
  }
  return clientPanelViewProvider;
}

export function getClientPanelViewProvider(): vscode.WebviewViewProvider & vscode.Disposable {
  if (!clientPanelViewProvider) {
    clientPanelViewProvider = new ClientPanelViewProvider();
  }
  return clientPanelViewProvider;
}

function renderLine(line: string): string {
  return `<div class="line ${classifyLine(line)}">${escapeHtml(line)}</div>`;
}

function classifyLine(line: string): string {
  if (/^-{20,}$/.test(line)) return "divider";
  if (line.startsWith("[send]")) return "send";
  if (line.startsWith("[done]")) return "done";
  if (line.startsWith("[error]")) return "error";
  if (line.startsWith("[hook-error]")) return "hook-error";
  if (line.startsWith("[stopped]")) return "stopped";
  if (line.startsWith("status:")) return "status";
  if (line.startsWith("url:")) return "meta";
  if (line === "headers:" || line === "body:" || line === "response headers:" || line === "response body:") return "section";
  if (line.startsWith("  ")) return "header-entry";
  if (line.startsWith("event:")) return "event";
  if (line.startsWith("connect:") || line.startsWith("connect head bytes:")) return "connect";
  if (line.startsWith("websocket")) return "websocket";
  return "plain";
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
