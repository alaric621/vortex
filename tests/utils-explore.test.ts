import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMocks = vi.hoisted(() => ({
  showWarningMessage: vi.fn(),
  executeCommand: vi.fn()
}));

vi.mock("vscode", () => {
  class Uri {
    constructor(
      public readonly scheme: string,
      public readonly authority: string,
      public readonly path: string
    ) {}

    static from(parts: { scheme: string; authority?: string; path: string }): Uri {
      return new Uri(parts.scheme, parts.authority ?? "", parts.path);
    }

    with(parts: { path?: string }): Uri {
      return new Uri(this.scheme, this.authority, parts.path ?? this.path);
    }

    toString(): string {
      return `${this.scheme}://${this.authority}${this.path}`;
    }
  }

  return {
    Uri,
    commands: {
      executeCommand: vscodeMocks.executeCommand
    },
    window: {
      showWarningMessage: vscodeMocks.showWarningMessage,
      activeTextEditor: undefined,
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        show: vi.fn(),
        clear: vi.fn()
      }))
    }
  };
});

import { globContext } from "../src/context";
import {
  buildCreationTarget,
  canRenameToPath,
  getRequestByUri,
  getRequiredRequest,
  openRequest,
  saveActiveRequestIfDirty
} from "../src/utils/explore";
import * as vscode from "vscode";
import { ensureRequestPathWithoutExtension } from "../src/utils/path";

const seedCollections = [
  {
    id: "req_root_status",
    type: "GET",
    name: "status",
    folder: "/",
    url: "https://example.com/status",
    ctime: 1,
    mtime: 2,
    headers: {},
    body: "",
    scripts: { pre: "", post: "" }
  },
  {
    id: "req_user_list",
    type: "GET",
    name: "users",
    folder: "/team",
    url: "https://example.com/team/users",
    ctime: 3,
    mtime: 4,
    headers: {},
    body: "",
    scripts: { pre: "", post: "" }
  }
];

function createUri(path: string): vscode.Uri {
  return vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path });
}

describe("utils/explore", () => {
  beforeEach(() => {
    globContext.collections.length = 0;
    globContext.collections.push(...seedCollections.map(item => ({
      ...item,
      headers: { ...item.headers },
      scripts: { ...item.scripts }
    })));
    vscodeMocks.showWarningMessage.mockReset();
    vscodeMocks.executeCommand.mockReset();
    (vscode.window as any).activeTextEditor = undefined;
  });

  it("resolves creation target for both files and directories", () => {
    expect(buildCreationTarget("/", "demo")).toEqual({ path: "/demo", isDir: false });
    expect(buildCreationTarget("/team", "archive/")).toEqual({ path: "/team/archive", isDir: true });
    expect(buildCreationTarget("/", "")).toBeUndefined();
  });

  it("prevents renaming when target already exists but allows identity moves", () => {
    expect(canRenameToPath("/status", "/status")).toBe(true);
    expect(canRenameToPath("/status", "/team/users")).toBe(false);
    expect(canRenameToPath("/status", "/new-request")).toBe(true);
  });

  it("reads requests by URI and shows warning when missing", () => {
    const uri = createUri("/status.vht");
    expect(getRequestByUri(uri)).toEqual(expect.objectContaining({ id: "req_root_status" }));
    expect(getRequiredRequest(uri)).toEqual(expect.objectContaining({ id: "req_root_status" }));

    const missing = createUri("/missing.vht");
    expect(getRequestByUri(missing)).toBeUndefined();
    expect(getRequiredRequest(missing)).toBeUndefined();
    expect(vscodeMocks.showWarningMessage).toHaveBeenCalledWith(
      `未找到请求: ${ensureRequestPathWithoutExtension(missing.path)}`
    );
  });

  it("opens requests through VS Code command", async () => {
    await openRequest("vortex-fs", "request", "/status");
    expect(vscodeMocks.executeCommand).toHaveBeenCalledWith(
      "vscode.open",
      expect.objectContaining({ path: "/status.vht" })
    );
  });

  it("saves dirty editors before sending requests", async () => {
    const uri = createUri("/status.vht");
    const saveMock = vi.fn(() => Promise.resolve(true));
    (vscode.window as any).activeTextEditor = {
      document: { uri, isDirty: true, save: saveMock }
    };

    const result = await saveActiveRequestIfDirty(uri);
    expect(result).toBe(true);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it("skips saving when the active document is clean or unrelated", async () => {
    const uri = createUri("/status.vht");
    const otherUri = createUri("/users.vht");
    const saveMock = vi.fn(() => Promise.resolve(true));
    (vscode.window as any).activeTextEditor = {
      document: { uri: otherUri, isDirty: true, save: saveMock }
    };

    expect(await saveActiveRequestIfDirty(uri)).toBe(true);
    expect(saveMock).not.toHaveBeenCalled();
  });
});
