import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeState = vi.hoisted(() => {
  const panel = {
    webview: {
      html: ""
    },
    reveal: vi.fn(),
    onDidDispose: vi.fn()
  };

  return {
    panel,
    createWebviewPanel: vi.fn(() => panel)
  };
});

vi.mock("vscode", () => ({
  window: {
    createWebviewPanel: vscodeState.createWebviewPanel
  },
  ViewColumn: {
    Active: 1
  }
}));

describe("client panel", () => {
  beforeEach(() => {
    vscodeState.panel.webview.html = "";
    vscodeState.panel.reveal.mockReset();
    vscodeState.panel.onDidDispose.mockReset();
    vscodeState.createWebviewPanel.mockClear();
    vi.resetModules();
  });

  it("renders highlighted log lines in a dedicated webview panel", async () => {
    const { getClientPanel } = await import("../src/views/clientPanel");
    const panel = getClientPanel();

    panel.appendLine("[send] GET hello");
    panel.appendLine("status: 200 OK");
    panel.appendLine("[error] GET hello: failed");
    panel.show();

    expect(vscodeState.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(vscodeState.panel.webview.html).toContain('class="line send"');
    expect(vscodeState.panel.webview.html).toContain('class="line status"');
    expect(vscodeState.panel.webview.html).toContain('class="line error"');
    expect(vscodeState.panel.reveal).toHaveBeenCalled();
  });
});
