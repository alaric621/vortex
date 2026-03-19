import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

describe("package contributions", () => {
  it("gates send and stop commands with the client busy context", () => {
    const viewContext = packageJson.contributes.menus["view/item/context"];
    const editorTitle = packageJson.contributes.menus["editor/title"];
    const keybindings = packageJson.contributes.keybindings;

    expect(viewContext.some(item => item.command === "vortex.request.send" && item.when === "view == vortex-explorer && viewItem == vortex.requestNode")).toBe(true);
    expect(viewContext.some(item => item.command === "vortex.request.stop" && item.when.includes("vortex.client.busy"))).toBe(true);
    expect(editorTitle.some(item => item.command === "vortex.request.send" && item.when === "resourceExtname == .vht")).toBe(true);
    expect(editorTitle.some(item => item.command === "vortex.request.stop" && item.when.includes("vortex.client.busy"))).toBe(true);
    expect(keybindings.some(item => item.command === "vortex.request.send" && !item.when.includes("vortex.client.busy"))).toBe(true);
    expect(keybindings.some(item => item.command === "vortex.request.stop" && item.when.includes("vortex.client.busy"))).toBe(true);
  });
});
