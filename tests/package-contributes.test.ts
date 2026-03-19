import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

describe("package contributions", () => {
  it("registers strict output format configuration", () => {
    const config = packageJson.contributes.configuration?.properties?.["vortex.output.strictLogFormat"];
    expect(config).toBeDefined();
    expect(config.type).toBe("boolean");
    expect(config.default).toBe(true);
  });

  it("gates explorer node actions with per-node context", () => {
    const viewContext = packageJson.contributes.menus["view/item/context"];
    const editorTitle = packageJson.contributes.menus["editor/title"];
    const keybindings = packageJson.contributes.keybindings;

    expect(
      viewContext.some(
        item => item.command === "vortex.request.send"
          && item.when === "view == vortex-explorer && viewItem == vortex.requestNode.idle"
      )
    ).toBe(true);
    expect(
      viewContext.some(
        item => item.command === "vortex.request.stop"
          && item.when === "view == vortex-explorer && viewItem == vortex.requestNode.running"
      )
    ).toBe(true);
    expect(
      editorTitle.some(
        item => item.command === "vortex.request.send"
          && item.when === "resourceExtname == .vht && !vortex.client.busy"
      )
    ).toBe(true);
    expect(editorTitle.some(item => item.command === "vortex.request.stop")).toBe(false);
    expect(
      keybindings.some(
        item => item.command === "vortex.request.send"
          && item.when === "focusedView == vortex-explorer && listFocus && !inputFocus && viewItem == vortex.requestNode.idle"
      )
    ).toBe(true);
    expect(
      keybindings.some(
        item => item.command === "vortex.request.stop"
          && item.when === "focusedView == vortex-explorer && listFocus && !inputFocus && viewItem == vortex.requestNode.running"
      )
    ).toBe(true);
    expect(keybindings.some(item => item.command === "vortex.request.stop" && item.when.includes("resourceExtname == .vht"))).toBe(true);
  });

  it("registers transaction log language and grammar", () => {
    const languages = packageJson.contributes.languages;
    const grammars = packageJson.contributes.grammars;

    expect(languages.some(language => language.id === "vortex-log")).toBe(true);
    expect(
      grammars.some(
        grammar => grammar.language === "vortex-log"
          && grammar.scopeName === "source.vortex-log"
          && grammar.path === "./syntaxes/vortex-log.tmLanguage.json"
      )
    ).toBe(true);
  });
});
