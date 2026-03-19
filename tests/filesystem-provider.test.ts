import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => {
  class Disposable {
    constructor(private readonly fn: () => void = () => undefined) {}
    dispose(): void {
      this.fn();
    }
  }

  class EventEmitter<T> {
    public event = vi.fn();
    public fire = vi.fn<(value: T) => void>();
    dispose(): void {}
  }

  class Uri {
    constructor(
      public readonly scheme: string,
      public readonly authority: string,
      public readonly path: string
    ) {}

    static parse(value: string): Uri {
      const match = value.match(/^([^:]+):\/\/?([^/]*)(\/.*)?$/);
      if (!match) {
        return new Uri("file", "", value);
      }
      return new Uri(match[1], match[2] ?? "", match[3] ?? "/");
    }

    toString(): string {
      return `${this.scheme}://${this.authority}${this.path}`;
    }
  }

  class FileSystemError extends Error {
    static FileNotFound(uri: Uri): FileSystemError {
      return new FileSystemError(`FileNotFound:${uri.path}`);
    }
    static FileExists(uri: Uri): FileSystemError {
      return new FileSystemError(`FileExists:${uri.path}`);
    }
    static FileIsADirectory(uri: Uri): FileSystemError {
      return new FileSystemError(`FileIsADirectory:${uri.path}`);
    }
    static Unavailable(message: string): FileSystemError {
      return new FileSystemError(message);
    }
  }

  return {
    Disposable,
    EventEmitter,
    Uri,
    FileSystemError,
    FileType: {
      File: 1,
      Directory: 2
    },
    FileChangeType: {
      Changed: 1,
      Created: 2,
      Deleted: 3
    }
  };
});

import * as vscode from "vscode";
import { FileSystemProvider } from "../src/core/filesystem/FileSystemProvider";
import { collections, virtualFolders } from "../src/core/filesystem/context";

const seedCollections = [
  {
    id: "req_mmtjmybx_fnqqjz",
    type: "GET",
    name: "hello",
    folder: "/fsa",
    url: "http://baidu.com",
    ctime: 1710000000000,
    mtime: 1710003600000,
    headers: {},
    body: "",
    scripts: { pre: "", post: "" }
  },
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
  }
];

describe("FileSystemProvider", () => {
  beforeEach(() => {
    collections.length = 0;
    collections.push(...seedCollections.map(item => ({
      ...item,
      headers: { ...item.headers },
      scripts: { ...item.scripts }
    })));
    virtualFolders.clear();
  });

  it("reads request files as VHT text", () => {
    const provider = new FileSystemProvider();
    const uri = vscode.Uri.parse("vortex-fs://request/fsa/hello.vht");

    const text = Buffer.from(provider.readFile(uri)).toString("utf8");

    expect(text).toContain("GET http://baidu.com");
  });

  it("writes VHT text back into the request collection", () => {
    const provider = new FileSystemProvider();
    const uri = vscode.Uri.parse("vortex-fs://request/fsa/hello.vht");
    const updated = [
      "POST https://example.com/api",
      "Content-Type: application/json",
      "",
      "{\"ok\":true}",
      "",
      ">>>",
      "console.log(\"pre\")",
      "",
      "<<<",
      "console.log(\"post\")",
      ""
    ].join("\n");

    provider.writeFile(uri, Buffer.from(updated, "utf8"), { create: false, overwrite: true });

    const request = collections.find(item => item.name === "hello" && item.folder === "/fsa");
    expect(request?.type).toBe("POST");
    expect(request?.url).toBe("https://example.com/api");
    expect(request?.headers).toEqual({ "Content-Type": "application/json" });
    expect(request?.body).toBe("{\"ok\":true}");
    expect(request?.scripts).toEqual({
      pre: "console.log(\"pre\")",
      post: "console.log(\"post\")"
    });
  });

  it("rejects writes with parser errors and keeps the existing request intact", () => {
    const provider = new FileSystemProvider();
    const uri = vscode.Uri.parse("vortex-fs://request/fsa/hello.vht");
    const original = collections.find(item => item.name === "hello" && item.folder === "/fsa");

    expect(() => provider.writeFile(
      uri,
      Buffer.from("GET https://example.com\n>>>\nconsole.log('broken')\n", "utf8"),
      { create: false, overwrite: true }
    )).toThrow("Failed to save request");

    expect(collections.find(item => item.name === "hello" && item.folder === "/fsa")).toEqual(original);
  });

  it("rejects writes without a request line", () => {
    const provider = new FileSystemProvider();
    const uri = vscode.Uri.parse("vortex-fs://request/fsa/hello.vht");

    expect(() => provider.writeFile(
      uri,
      Buffer.from("{\"bodyOnly\":true}\n", "utf8"),
      { create: false, overwrite: true }
    )).toThrow("missing request line");
  });

  it("creates virtual directories", () => {
    const provider = new FileSystemProvider();
    const uri = vscode.Uri.parse("vortex-fs://request/team/new-folder");

    provider.createDirectory(uri);

    expect(virtualFolders.has("/team/new-folder")).toBe(true);
    const stat = provider.stat(uri);
    expect(stat.type).toBe(vscode.FileType.Directory);
  });

  it("rejects delete for missing paths", () => {
    const provider = new FileSystemProvider();
    const uri = vscode.Uri.parse("vortex-fs://request/team/missing.vht");

    expect(() => provider.delete(uri, { recursive: true })).toThrow("FileNotFound:/team/missing.vht");
  });

  it("rejects rename when the target already exists", () => {
    const provider = new FileSystemProvider();
    const oldUri = vscode.Uri.parse("vortex-fs://request/fsa/hello.vht");
    const newUri = vscode.Uri.parse("vortex-fs://request/status.vht");

    expect(() => provider.rename(oldUri, newUri)).toThrow("FileExists:/status.vht");
  });
});
