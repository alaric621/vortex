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
      enableScripts: true
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

    const entries = buildEntries(this.lines);
    const body = entries.length > 0
      ? entries.map(entry => renderEntry(entry)).join("")
      : `<div class="empty">No request logs yet.</div>`;
    const copyPayload = escapeJsString(this.lines.join("\n"));
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
      --toolbar-bg: var(--vscode-sideBar-background);
      --toolbar-fg: var(--vscode-sideBar-foreground);
      --button-bg: var(--vscode-button-secondaryBackground);
      --button-fg: var(--vscode-button-secondaryForeground);
      --button-hover: var(--vscode-button-secondaryHoverBackground);
      --entry-bg: var(--vscode-editorWidget-background);
      --entry-head-bg: var(--vscode-titleBar-inactiveBackground);
      --accent: var(--vscode-textLink-foreground);
      --ok: var(--vscode-testing-iconPassed);
      --warn: var(--vscode-testing-iconQueued);
      --err: var(--vscode-testing-iconFailed);
      --info: var(--vscode-symbolIconVariableForeground);
    }
    html, body {
      height: 100%;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font: 12px/1.6 var(--vscode-editor-font-family, ui-monospace, monospace);
      overflow: hidden;
    }
    .app {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .toolbar {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      background: var(--toolbar-bg);
      color: var(--toolbar-fg);
    }
    .toolbar-title {
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .toolbar-meta {
      color: var(--muted);
      font-size: 11px;
    }
    .toolbar-actions {
      display: flex;
      gap: 8px;
    }
    button {
      border: 1px solid var(--border);
      background: var(--button-bg);
      color: var(--button-fg);
      border-radius: 8px;
      padding: 5px 10px;
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      background: var(--button-hover);
    }
    .log {
      flex: 1 1 auto;
      overflow: auto;
      padding: 12px 14px 20px;
      display: grid;
      gap: 12px;
      overscroll-behavior: contain;
    }
    .entry {
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      background: var(--entry-bg);
    }
    .entry-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--entry-head-bg);
    }
    .entry-title {
      font-weight: 700;
      color: var(--accent);
    }
    .entry-duration {
      color: var(--muted);
    }
    .entry-body {
      padding: 8px 12px 12px;
    }
    .line {
      white-space: pre-wrap;
      word-break: break-word;
      padding: 2px 0;
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
    .duration {
      color: var(--muted);
      font-weight: 600;
    }
    .plain {
      color: var(--fg);
    }
    .empty {
      color: var(--muted);
      border: 1px dashed var(--border);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="toolbar">
      <div>
        <div class="toolbar-title">Client Log</div>
        <div class="toolbar-meta">${this.lines.length} lines</div>
      </div>
      <div class="toolbar-actions">
        <button type="button" id="copyAll">Copy All</button>
      </div>
    </div>
    <div class="log" id="logRoot">${body}</div>
  </div>
  <script>
    const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;
    const state = vscode?.getState?.() ?? {};
    const logRoot = document.getElementById("logRoot");
    const copyText = "${copyPayload}";
    const button = document.getElementById("copyAll");
    if (logRoot && typeof state.scrollTop === "number") {
      logRoot.scrollTop = state.scrollTop;
    }
    logRoot?.addEventListener("scroll", () => {
      vscode?.setState?.({ scrollTop: logRoot.scrollTop });
    });
    button?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(copyText);
        button.textContent = "Copied";
        setTimeout(() => {
          button.textContent = "Copy All";
        }, 1200);
      } catch {
        button.textContent = "Copy Failed";
        setTimeout(() => {
          button.textContent = "Copy All";
        }, 1200);
      }
    });
  </script>
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

function renderEntry(entry: { title: string; duration?: string; lines: string[] }): string {
  const body = entry.lines.map(line => renderLine(line)).join("");
  return `<section class="entry">
    <div class="entry-head">
      <div class="entry-title">${escapeHtml(entry.title)}</div>
      <div class="entry-duration">${escapeHtml(entry.duration ?? "")}</div>
    </div>
    <div class="entry-body">${body}</div>
  </section>`;
}

function classifyLine(line: string): string {
  if (/^-{20,}$/.test(line)) return "divider";
  if (line.startsWith("[send]")) return "send";
  if (line.startsWith("[done]")) return "done";
  if (line.startsWith("[error]")) return "error";
  if (line.startsWith("[hook-error]")) return "hook-error";
  if (line.startsWith("[stopped]")) return "stopped";
  if (line.startsWith("status:")) return "status";
  if (line.startsWith("duration:")) return "duration";
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

function escapeJsString(input: string): string {
  return input
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("</script>", "<\\/script>");
}

function buildEntries(lines: string[]): Array<{ title: string; duration?: string; lines: string[] }> {
  const entries: Array<{ title: string; duration?: string; lines: string[] }> = [];
  let current: string[] = [];

  const flush = (): void => {
    const trimmed = current.filter(line => line.trim().length > 0);
    if (trimmed.length === 0) {
      current = [];
      return;
    }

    const sendLine = trimmed.find(line => line.startsWith("[send]")) ?? trimmed[0];
    const durationLine = trimmed.find(line => line.startsWith("duration:"));
    entries.push({
      title: sendLine,
      duration: durationLine,
      lines: trimmed.filter(line => line !== sendLine && line !== durationLine)
    });
    current = [];
  };

  for (const line of lines) {
    if (/^-{20,}$/.test(line)) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return entries.reverse();
}
