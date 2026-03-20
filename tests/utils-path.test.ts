import { describe, expect, it } from "vitest";
import { basenamePath, dirnamePath, ensureRequestPathWithoutExtension, joinPath, normalizePath, stripVhtSuffix } from "../src/utils/path";

describe("path utils", () => {
  it("normalizes windows slashes and trailing slash", () => {
    expect(normalizePath("\\\\team\\users\\")).toBe("/team/users");
    expect(stripVhtSuffix("/team/request.vht")).toBe("/team/request");
  });

  it("computes dirname and basename", () => {
    expect(dirnamePath("/team/users/request")).toBe("/team/users");
    expect(basenamePath("/team/users/request")).toBe("request");
  });

  it("joins relative and absolute paths", () => {
    expect(joinPath("/team", "request.vht")).toBe("/team/request.vht");
    expect(joinPath("/", "request.vht")).toBe("/request.vht");
    expect(joinPath("/team", "/others/request")).toBe("/others/request");
  });

  it("ensures requests without extension", () => {
    expect(ensureRequestPathWithoutExtension("/team/request.vht")).toBe("/team/request");
    expect(ensureRequestPathWithoutExtension("/team/request")).toBe("/team/request");
  });
});
