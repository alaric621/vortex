import * as vscode from "vscode";
import { registerExplorer } from "./config/explorer";
import { registerLanguageFeatures } from "./config/language";
import { registerClientState } from "./config/clientState";
import { DocumentAstCache } from "./core/vht/documentAstCache";
import { Diagnostics } from "./core/vht/diagnostics";
import { VariableDecorator } from "./core/vht/variableDecorator";

/**
 * 方法：activate
 * 说明：执行 activate 相关处理逻辑。
 * @param context 参数 context。
 * @returns 异步完成后无返回值。
 * 返回值示例：await activate({ ... }); // undefined
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 变量：astCache，用于存储语法树缓存。
  const astCache = new DocumentAstCache();
  
  // 变量：diagnostics，用于存储诊断。
  const diagnostics = new Diagnostics(astCache);
  // 变量：decorator，用于存储decorator。
  const decorator = new VariableDecorator(astCache);
  // 变量：explorer，用于存储explorer。
  const explorer = registerExplorer(context, "vortex-fs", "request");

  registerLanguageFeatures(context, astCache, diagnostics, decorator);
  await registerClientState(context, explorer, diagnostics, decorator);
}

/**
 * 方法：deactivate
 * 说明：执行 deactivate 相关处理逻辑。
 * @param 无 无参数。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：deactivate(); // undefined
 */
export function deactivate(): void {}
