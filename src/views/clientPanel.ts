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
      ? entries.map((entry, index) => renderEntry(entry, index)).join("")
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
    button {
      border: 1px solid var(--border);
      background: var(--button-bg);
      color: var(--button-fg);
      padding: 4px 8px;
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      background: var(--button-hover);
    }
    .log {
      flex: 1 1 auto;
      overflow: auto;
      padding: 0 0 28px;
      overscroll-behavior: contain;
    }
    .entry {
      border-bottom: 1px solid var(--border);
    }
    .entry-toggle {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 12px;
      width: 100%;
      border: 0;
      border-bottom: 1px solid transparent;
      background: transparent;
      color: inherit;
      text-align: left;
      padding: 8px 12px;
      cursor: pointer;
    }
    .entry-toggle:hover {
      background: var(--button-hover);
    }
    .entry-title {
      color: var(--accent);
      font-weight: 600;
      min-width: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .entry-meta {
      color: var(--muted);
      white-space: nowrap;
    }
    .entry-chevron {
      color: var(--muted);
      width: 14px;
      text-align: center;
    }
    .entry-body {
      display: none;
      padding: 6px 12px 12px;
      border-top: 1px solid var(--border);
    }
    .entry.open .entry-body {
      display: block;
    }
    .line {
      white-space: pre-wrap;
      word-break: break-word;
      padding: 1px 0;
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
      padding: 24px;
      text-align: center;
    }
    .actions {
      position: fixed;
      right: 12px;
      bottom: 12px;
      display: flex;
      gap: 8px;
      opacity: 0.92;
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="log" id="logRoot">${body}</div>
  </div>
  <div class="actions">
    <button type="button" id="copyAll">Copy</button>
  </div>
  <script>
    const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;
    const state = vscode?.getState?.() ?? {};
    const logRoot = document.getElementById("logRoot");
    const expandedId = state.expandedId ?? null;
    const copyText = "${copyPayload}";
    const button = document.getElementById("copyAll");
    const shouldStickBottom = state.atBottom !== false;
    if (logRoot) {
      if (shouldStickBottom) {
        logRoot.scrollTop = logRoot.scrollHeight;
      } else if (typeof state.scrollTop === "number") {
        logRoot.scrollTop = state.scrollTop;
      }
    }
    logRoot?.addEventListener("scroll", () => {
      const atBottom = logRoot.scrollTop + logRoot.clientHeight >= logRoot.scrollHeight - 8;
      const current = vscode?.getState?.() ?? {};
      vscode?.setState?.({ ...current, scrollTop: logRoot.scrollTop, atBottom });
    });
    const applyExpanded = (id) => {
      document.querySelectorAll(".entry").forEach(node => {
        node.classList.toggle("open", node.getAttribute("data-entry-id") === id);
      });
    };
    applyExpanded(expandedId);
    document.querySelectorAll(".entry-toggle").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-entry-id");
        const nextId = id === (vscode?.getState?.()?.expandedId ?? null) ? null : id;
        const current = vscode?.getState?.() ?? {};
        vscode?.setState?.({ ...current, expandedId: nextId });
        applyExpanded(nextId);
      });
    });
    button?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(copyText);
        button.textContent = "Copied";
        setTimeout(() => {
          button.textContent = "Copy";
        }, 1200);
      } catch {
        button.textContent = "Copy Failed";
        setTimeout(() => {
          button.textContent = "Copy";
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

function renderEntry(entry: LogEntry, index: number): string {
  const body = entry.lines.map(line => renderLine(line)).join("");
  const meta = [entry.duration, entry.status].filter(Boolean).join("  ");
  const safeId = `entry-${index}`;
  return `<section class="entry" data-entry-id="${safeId}">
    <button class="entry-toggle" type="button" data-entry-id="${safeId}">
      <span class="entry-title">${escapeHtml(entry.title)}</span>
      <span class="entry-meta">${escapeHtml(meta)}</span>
      <span class="entry-chevron">+</span>
    </button>
    <div class="entry-body">${body || '<div class="line meta">(empty)</div>'}</div>
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

interface LogEntry {
  title: string;
  duration?: string;
  status?: string;
  lines: string[];
}

function buildEntries(lines: string[]): LogEntry[] {
  const entries: LogEntry[] = [];
  let current: string[] = [];

  const flush = (): void => {
    const trimmed = current.filter(line => line.trim().length > 0 && !/^-{20,}$/.test(line));
    if (trimmed.length === 0) {
      current = [];
      return;
    }

    const title = trimmed.find(line => line.startsWith("[send]")) ?? trimmed[0];
    const duration = trimmed.find(line => line.startsWith("duration:"));
    const status = [...trimmed].reverse().find(line =>
      line.startsWith("[done]") || line.startsWith("[error]") || line.startsWith("[stopped]")
    );

    entries.push({
      title,
      duration,
      status,
      lines: trimmed.filter(line => line !== title && line !== duration && line !== status)
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
  return entries;
}
