import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMocks = vi.hoisted(() => ({
  registerCommandMock: vi.fn(),
  executeCommandMock: vi.fn(),
  showInputBoxMock: vi.fn(),
  showWarningMessageMock: vi.fn(),
  createOutputChannelMock: vi.fn(() => ({
    appendLine: vi.fn(),
    show: vi.fn()
  }))
}));

vi.mock("vscode", () => {
  class Disposable {
    constructor(private readonly fn: () => void = () => undefined) {}
    dispose(): void {
      this.fn();
    }
  }

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
  }

  return {
    Disposable,
    Uri,
    commands: {
      registerCommand: vscodeMocks.registerCommandMock,
      executeCommand: vscodeMocks.executeCommandMock
    },
    window: {
      showInputBox: vscodeMocks.showInputBoxMock,
      showWarningMessage: vscodeMocks.showWarningMessageMock,
      createOutputChannel: vscodeMocks.createOutputChannelMock,
      activeTextEditor: undefined
    }
  };
});

const clientMocks = vi.hoisted(() => ({
  sendMock: vi.fn(),
  stopMock: vi.fn(),
  isRequestRunningMock: vi.fn(() => false),
  getActiveRequestIdMock: vi.fn<() => string | undefined>(() => undefined),
  getClientOutputChannelMock: vi.fn(() => ({
    appendLine: vi.fn(),
    show: vi.fn()
  }))
}));
const hookMocks = vi.hoisted(() => ({
  resolveHookRequestMock: vi.fn((request: unknown) => request),
  runHookMock: vi.fn(() => Promise.resolve())
}));

vi.mock("../src/core/client", () => ({
  send: clientMocks.sendMock,
  stop: clientMocks.stopMock,
  isRequestRunning: clientMocks.isRequestRunningMock,
  getActiveRequestId: clientMocks.getActiveRequestIdMock,
  getClientOutputChannel: clientMocks.getClientOutputChannelMock
}));

vi.mock("../src/core/runHook", () => ({
  resolveHookRequest: hookMocks.resolveHookRequestMock,
  runHook: hookMocks.runHookMock
}));

import * as vscode from "vscode";
import { registerExploreCommands } from "../src/command/explore";
import { collections, virtualFolders } from "../src/core/filesystem/context";

const seedCollections = [
  {
    id: "req_root_status",
    type: "GET",
    name: "status",
    folder: "/",
    url: "http://localhost:9501/status",
    ctime: 1710100000000,
    mtime: 1710107200000,
    headers: {},
    body: "",
    scripts: { pre: "", post: "" }
  },
  {
    id: "req_team_users",
    type: "GET",
    name: "users",
    folder: "/team",
    url: "http://localhost:9501/team/users",
    ctime: 1710300000000,
    mtime: 1710305400000,
    headers: {},
    body: "",
    scripts: { pre: "", post: "" }
  }
];

describe("registerExploreCommands", () => {
  const fsProvider = {
    rename: vi.fn(),
    delete: vi.fn()
  };
  const explorerProvider = {
    refresh: vi.fn()
  };

  beforeEach(() => {
    vscodeMocks.registerCommandMock.mockReset();
    vscodeMocks.executeCommandMock.mockReset();
    vscodeMocks.showInputBoxMock.mockReset();
    vscodeMocks.showWarningMessageMock.mockReset();
    vscodeMocks.createOutputChannelMock.mockClear();
    clientMocks.sendMock.mockReset();
    clientMocks.stopMock.mockReset();
    clientMocks.isRequestRunningMock.mockReset();
    clientMocks.isRequestRunningMock.mockReturnValue(false);
    clientMocks.getActiveRequestIdMock.mockReset();
    clientMocks.getActiveRequestIdMock.mockReturnValue(undefined);
    clientMocks.getClientOutputChannelMock.mockReset();
    clientMocks.getClientOutputChannelMock.mockReturnValue({
      appendLine: vi.fn(),
      show: vi.fn()
    });
    hookMocks.resolveHookRequestMock.mockReset();
    hookMocks.resolveHookRequestMock.mockImplementation((request: unknown) => request);
    hookMocks.runHookMock.mockReset();
    hookMocks.runHookMock.mockResolvedValue(undefined);
    fsProvider.rename.mockReset();
    fsProvider.delete.mockReset();
    explorerProvider.refresh.mockReset();
    (vscode.window as any).activeTextEditor = undefined;
    collections.length = 0;
    collections.push(...seedCollections.map(item => ({
      ...item,
      headers: { ...item.headers },
      scripts: { ...item.scripts }
    })));
    virtualFolders.clear();
  });

  function getHandler(commandId: string): (...args: unknown[]) => Promise<void> {
    registerExploreCommands("vortex-fs", "request", fsProvider, explorerProvider);
    const call = vscodeMocks.registerCommandMock.mock.calls.find(([id]) => id === commandId);
    if (!call) {
      throw new Error(`Missing command registration: ${commandId}`);
    }
    return call[1];
  }

  it("registers all request workflow commands", () => {
    registerExploreCommands("vortex-fs", "request", fsProvider, explorerProvider);

    expect(vscodeMocks.registerCommandMock.mock.calls.map(([id]) => id)).toEqual([
      "vortex.request.create",
      "vortex.request.rename",
      "vortex.request.delete",
      "vortex.request.send",
      "vortex.request.stop"
    ]);
  });

  it("creates a request file and opens it", async () => {
    vscodeMocks.showInputBoxMock.mockResolvedValue("new-request");
    const create = getHandler("vortex.request.create");

    await create();

    expect(collections.some(item => item.name === "new-request" && item.folder === "/")).toBe(true);
    expect(explorerProvider.refresh).toHaveBeenCalledTimes(1);
    expect(vscodeMocks.executeCommandMock).toHaveBeenCalledWith(
      "vscode.open",
      expect.objectContaining({ path: "/new-request.vht" })
    );
  });

  it("creates a folder when the input ends with a slash", async () => {
    vscodeMocks.showInputBoxMock.mockResolvedValue("archive/");
    const create = getHandler("vortex.request.create");

    await create();

    expect(virtualFolders.has("/archive")).toBe(true);
    expect(vscodeMocks.executeCommandMock).not.toHaveBeenCalled();
  });

  it("renames a request node via the filesystem provider", async () => {
    vscodeMocks.showInputBoxMock.mockResolvedValue("members");
    fsProvider.rename.mockImplementation((oldUri, newUri) => {
      const item = collections.find(entry => entry.name === "users" && entry.folder === "/team");
      if (item) {
        item.name = "members";
        item.folder = "/team";
      }
      return { oldUri, newUri };
    });
    const rename = getHandler("vortex.request.rename");

    await rename({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team/users.vht" })
    });

    expect(fsProvider.rename).toHaveBeenCalled();
    expect(collections.some(item => item.name === "members" && item.folder === "/team")).toBe(true);
    expect(vscodeMocks.executeCommandMock).toHaveBeenCalledWith(
      "vscode.open",
      expect.objectContaining({ path: "/team/members.vht" })
    );
  });

  it("deletes a node after confirmation", async () => {
    vscodeMocks.showWarningMessageMock.mockResolvedValue("Delete");
    const remove = getHandler("vortex.request.delete");

    await remove({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team" })
    });

    expect(fsProvider.delete).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/team" }),
      { recursive: true }
    );
  });

  it("sends the selected request payload", async () => {
    (vscode.window as any).activeTextEditor = {
      document: {
        uri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team/users.vht" }),
        isDirty: true,
        save: vi.fn().mockResolvedValue(true)
      }
    };
    clientMocks.sendMock.mockResolvedValue({
      status: 200,
      events: []
    });
    const sendCommand = getHandler("vortex.request.send");

    await sendCommand({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team/users.vht" })
    });

    expect(hookMocks.resolveHookRequestMock).toHaveBeenCalled();
    expect(hookMocks.runHookMock).toHaveBeenNthCalledWith(
      1,
      "",
      expect.objectContaining({
        request: expect.objectContaining({ id: "req_team_users" }),
        response: expect.objectContaining({ events: [] })
      })
    );
    expect(clientMocks.sendMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "req_team_users",
      name: "users"
    }));
    expect(clientMocks.getClientOutputChannelMock).toHaveBeenCalledTimes(1);
    expect(hookMocks.runHookMock).toHaveBeenNthCalledWith(
      2,
      "",
      expect.objectContaining({
        response: expect.objectContaining({ status: 200 })
      })
    );
  });

  it("blocks send when the same request id is already running", async () => {
    clientMocks.isRequestRunningMock.mockReturnValue(true);
    const sendCommand = getHandler("vortex.request.send");

    await sendCommand({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team/users.vht" })
    });

    expect(clientMocks.sendMock).not.toHaveBeenCalled();
    expect(vscodeMocks.showWarningMessageMock).toHaveBeenCalledWith(
      "Request is already running: req_team_users"
    );
  });

  it("stops the selected request by id", async () => {
    clientMocks.isRequestRunningMock.mockReturnValue(true);
    const stopCommand = getHandler("vortex.request.stop");

    await stopCommand({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team/users.vht" })
    });

    expect(clientMocks.stopMock).toHaveBeenCalledWith("req_team_users");
  });

  it("stops the active request when no resource is selected", async () => {
    clientMocks.getActiveRequestIdMock.mockImplementation(() => "req_team_users");
    const stopCommand = getHandler("vortex.request.stop");

    await stopCommand();

    expect(clientMocks.stopMock).toHaveBeenCalledWith("req_team_users");
  });

  it("falls back to the active request when the selected request is not running", async () => {
    clientMocks.getActiveRequestIdMock.mockReturnValue("req_running");
    clientMocks.isRequestRunningMock.mockReturnValue(false);
    const stopCommand = getHandler("vortex.request.stop");

    await stopCommand({
      resourceUri: vscode.Uri.from({ scheme: "vortex-fs", authority: "request", path: "/team/users.vht" })
    });

    expect(clientMocks.stopMock).toHaveBeenCalledWith("req_running");
  });
});
