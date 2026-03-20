import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => {
  class Uri {
    constructor(public scheme: string, public authority: string, public path: string) {}
    static from(parts: { scheme: string; authority?: string; path: string }): Uri {
      return new Uri(
        parts.scheme,
        parts.authority ?? "",
        path.posix.normalize(parts.path)
      );
    }
    with(parts: { path?: string }) {
      return new Uri(this.scheme, this.authority, parts.path ?? this.path);
    }
    toString() {
      return `${this.scheme}://${this.authority}${this.path}`;
    }
  }

  return {
    Uri,
    window: {
      activeTextEditor: undefined,
      createOutputChannel: () => ({
        appendLine: () => undefined,
        show: () => undefined,
        clear: () => undefined
      })
    }
  };
});

import {
  buildUri,
  getParentFolderPath,
  getResourceUri,
  isRequestUri,
  toEntityUri,
  toRequestUri
} from "../src/utils/requestUri";

class FakeUri {
  constructor(public scheme: string, public authority: string, public path: string) {}
  with(parts: { path?: string }) {
    return new FakeUri(this.scheme, this.authority, parts.path ?? this.path);
  }
  toString() {
    return `${this.scheme}://${this.authority}${this.path}`;
  }
}

describe("requestUri utils", () => {
  it("builds normalized uri", () => {
    const uri = buildUri("vortex-fs", "request", "team/./users");
    expect(uri.scheme).toBe("vortex-fs");
    expect(uri.path).toBe("/team/users");
  });

  it("identifies request uri and entity uri", () => {
    const uri = new FakeUri("vortex-fs", "request", "/team/users.vht");
    expect(isRequestUri(uri as unknown as import("vscode").Uri)).toBe(true);
    expect(toRequestUri(new FakeUri("vortex-fs", "request", "/team/users") as any).path).toBe(
      "/team/users.vht"
    );
    expect(toEntityUri(uri as unknown as import("vscode").Uri).path).toBe("/team/users");
  });

  it("returns parent folder path and handles resources", () => {
    const target = new FakeUri("vortex-fs", "request", "/team/users.vht");
    expect(getParentFolderPath(target as unknown as import("vscode").Uri)).toBe("/team");
  });

  it("falls back to focused resource", () => {
    const result = getResourceUri();
    expect(result).toBeUndefined();
  });
});
