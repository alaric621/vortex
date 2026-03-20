import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vscodeState = vi.hoisted(() => ({
  workspaceFolders: [] as Array<{ uri: { fsPath: string } }>
}));

vi.mock("vscode", () => {
  class Uri {
    constructor(
      public readonly fsPath: string,
      public readonly path: string = fsPath,
      public readonly scheme: string = "file",
      public readonly authority: string = ""
    ) {}

    static file(input: string): Uri {
      return new Uri(input, input, "file", "");
    }
  }

  class Range {
    public readonly start: { line: number; character: number };
    public readonly end: { line: number; character: number };
    constructor(
      startLine: number,
      startCharacter: number,
      endLine: number,
      endCharacter: number
    ) {
      this.start = { line: startLine, character: startCharacter };
      this.end = { line: endLine, character: endCharacter };
    }
  }

  class Position {
    constructor(
      public readonly line: number,
      public readonly character: number
    ) {}
  }

  class CompletionItem {
    public insertText?: string;
    public detail?: string;
    public range?: Range;
    constructor(
      public readonly label: string,
      public readonly kind: number
    ) {}
  }

  return {
    Uri,
    Range,
    Position,
    CompletionItem,
    CompletionItemKind: {
      Property: 10
    },
    workspace: {
      get workspaceFolders() {
        return vscodeState.workspaceFolders;
      },
      getWorkspaceFolder(uri: { fsPath: string }) {
        return vscodeState.workspaceFolders.find(folder => uri.fsPath.startsWith(folder.uri.fsPath));
      }
    },
    window: {
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        show: vi.fn(),
        clear: vi.fn()
      }))
    }
  };
});

import * as vscode from "vscode";
import {
  clearRuntimeVhtVariables,
  createMutableVhtVariables,
  getVhtVariables,
  refreshBaseVhtVariables,
  setRuntimeVhtVariables
} from "../src/context";
import { prepareRuntimeVariables } from "../src/core/runtimeVariables";
import { VhtParser } from "../src/core/vht/parser";
import { getVariableCompletions } from "../src/core/vht/completion/variable";
import { collectDiagnosticIssues } from "../src/core/vht/diagnosticsRules";

describe("workspace environment variables", () => {
  let workspaceRoot: string;

  beforeEach(() => {
    (globalThis as { __vscode?: typeof vscode }).__vscode = vscode;
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-env-"));
    vscodeState.workspaceFolders = [{ uri: { fsPath: workspaceRoot } }];
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
    vscodeState.workspaceFolders = [];
    clearRuntimeVhtVariables();
    delete (globalThis as { __vscode?: typeof vscode }).__vscode;
  });

  it("loads active environment variables from vortex.json", () => {
    fs.writeFileSync(
      path.join(workspaceRoot, "vortex.json"),
      JSON.stringify({
        activeEnvironment: "prod",
        variables: {
          shared: "global"
        },
        environments: {
          prod: {
            env: "prod",
            service: {
              token: "secret"
            }
          }
        }
      }),
      "utf8"
    );

    const variables = getVhtVariables(vscode.Uri.file(path.join(workspaceRoot, "request.vht")));

    expect(variables).toEqual({
      shared: "global",
      env: "prod",
      service: {
        token: "secret"
      }
    });
  });

  it("uses workspace variables for completion suggestions", () => {
    fs.writeFileSync(
      path.join(workspaceRoot, "vortex.json"),
      JSON.stringify({
        activeEnvironment: "dev",
        environments: {
          dev: {
            apiBase: "https://dev.local",
            client: {
              token: "dev-token"
            }
          }
        }
      }),
      "utf8"
    );

    const parser = new VhtParser();
    const text = "GET http://localhost\nAuthorization: Bearer {{a}}";
    const ast = parser.parse(text);
    const document = {
      uri: vscode.Uri.file(path.join(workspaceRoot, "request.vht")),
      lineAt(line: number) {
        return { text: text.split("\n")[line] };
      }
    } as any;

    const completions = getVariableCompletions(document, new vscode.Position(1, 25), ast);

    expect(completions.some(item => item.label === "apiBase")).toBe(true);
  });

  it("uses workspace variables for diagnostics", () => {
    fs.writeFileSync(
      path.join(workspaceRoot, "vortex.json"),
      JSON.stringify({
        activeEnvironment: "dev",
        environments: {
          dev: {
            service: {
              token: "dev-token"
            }
          }
        }
      }),
      "utf8"
    );

    const parser = new VhtParser();
    const text = "GET http://localhost\nAuthorization: Bearer {{service.token}}";
    const ast = parser.parse(text);

    const issues = collectDiagnosticIssues(
      ast,
      text,
      getVhtVariables(vscode.Uri.file(path.join(workspaceRoot, "request.vht")))
    );

    expect(issues.some(issue => issue.code === "unknown-variable-path")).toBe(false);
  });

  it("prefers runtime variables when present", () => {
    fs.writeFileSync(
      path.join(workspaceRoot, "vortex.json"),
      JSON.stringify({
        variables: {
          client: {
            name: "from-config"
          }
        }
      }),
      "utf8"
    );

    const documentUri = vscode.Uri.file(path.join(workspaceRoot, "request.vht"));
    const runtimeVariables = createMutableVhtVariables(documentUri);
    (runtimeVariables.client as Record<string, unknown>).name = "hello";
    setRuntimeVhtVariables(documentUri, runtimeVariables);

    expect(getVhtVariables(documentUri)).toEqual({
      client: {
        name: "hello"
      }
    });
  });

  it("applies pre hook variables into runtime state", async () => {
    const documentUri = vscode.Uri.file(path.join(workspaceRoot, "request.vht"));

    const variables = await prepareRuntimeVariables(documentUri, {
      id: "req_preview",
      type: "GET",
      name: "preview",
      folder: "/",
      url: "https://example.com",
      headers: {},
      body: "",
      scripts: {
        pre: "client.name = 'hello'; client.client = { token: 'preview-token' };"
      }
    });

    expect(variables).toEqual({
      name: "hello",
      client: {
        token: "preview-token"
      },
      env: "dev"
    });
    expect(getVhtVariables(documentUri)).toEqual(variables);
  });

  it("isolates request mutations inside pre hooks", async () => {
    const documentUri = vscode.Uri.file(path.join(workspaceRoot, "request.vht"));
    const request = {
      id: "req_preview",
      type: "GET",
      name: "preview",
      folder: "/",
      url: "https://example.com",
      headers: {
        Authorization: "Bearer old"
      },
      body: "",
      scripts: {
        pre: "request.headers.Authorization = 'Bearer new'; request.name = 'changed';"
      }
    };

    await prepareRuntimeVariables(documentUri, request);

    expect(request).toEqual({
      id: "req_preview",
      type: "GET",
      name: "preview",
      folder: "/",
      url: "https://example.com",
      headers: {
        Authorization: "Bearer old"
      },
      body: "",
      scripts: {
        pre: "request.headers.Authorization = 'Bearer new'; request.name = 'changed';"
      }
    });
  });

  it("caches workspace config reads until the cache is refreshed", () => {
    const documentUri = vscode.Uri.file(path.join(workspaceRoot, "request.vht"));
    const configPath = path.join(workspaceRoot, "vortex.json");

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        variables: {
          token: "first"
        }
      }),
      "utf8"
    );

    expect(getVhtVariables(documentUri)).toEqual({ token: "first" });
    expect(getVhtVariables(documentUri)).toEqual({ token: "first" });

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        variables: {
          token: "second"
        }
      }),
      "utf8"
    );

    expect(getVhtVariables(documentUri)).toEqual({ token: "first" });

    refreshBaseVhtVariables(documentUri);

    expect(getVhtVariables(documentUri)).toEqual({ token: "second" });
  });
});
