import * as vscode from "vscode";
import { getVhtVariables } from "../../../context";
import { collectDiagnosticIssues } from "../engine/diagnosticsRules";
import { DiagnosticIssue } from "../engine/diagnosticsRules/types";
import { DocumentAstCache } from "../documentAstCache";
import { toVsCodeRange } from "../../../utils/range";
import { Range } from "../engine/parser/types";

export class Diagnostics {
  // 变量：collection，用于存储collection。
  private readonly collection = vscode.languages.createDiagnosticCollection("vht-linter");
  // 变量：timers，用于存储timers。
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly astCache: DocumentAstCache = new DocumentAstCache()) {}

  /**
   * 方法：scheduleUpdate
   * 说明：执行 scheduleUpdate 相关处理逻辑。
   * @param document 参数 document。
   * @param delayMs 参数 delayMs。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：scheduleUpdate(document, 1); // undefined
   */
  public scheduleUpdate(document: vscode.TextDocument, delayMs: number = 120): void {
    if (document.languageId !== "vht") {
      return;
    }

    // 变量：key，用于存储key。
    const key = document.uri.toString();
    this.clearPendingTimer(key);
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      this.update(document);
    }, delayMs));
  }

  /**
   * 方法：update
   * 说明：执行 update 相关处理逻辑。
   * @param document 参数 document。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：update(document); // undefined
   */
  public update(document: vscode.TextDocument): void {
    if (document.languageId !== "vht") {
      return;
    }

    // 变量：ast，用于存储语法树。
    const ast = this.astCache.get(document);
    // 变量：issues，用于存储issues。
    const issues = collectDiagnosticIssues(ast, document.getText(), getVhtVariables(document.uri));
    this.collection.set(document.uri, [
      ...ast.errors.map(error => createParserDiagnostic(error.range, error.message)),
      ...issues.map(createRuleDiagnostic)
    ]);
  }

  /**
   * 方法：clear
   * 说明：执行 clear 相关处理逻辑。
   * @param document 参数 document。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：clear(document); // undefined
   */
  public clear(document: vscode.TextDocument): void {
    this.clearPendingTimer(document.uri.toString());
    this.astCache.delete(document);
    this.collection.delete(document.uri);
  }

  /**
   * 方法：getCollection
   * 说明：执行 getCollection 相关处理逻辑。
   * @param 无 无参数。
   * @returns 返回 vscode.DiagnosticCollection 类型结果。
   * 返回值示例：const result = getCollection(); // { ok: true }
   */
  public getCollection(): vscode.DiagnosticCollection {
    return this.collection;
  }

  /**
   * 方法：clearPendingTimer
   * 说明：执行 clearPendingTimer 相关处理逻辑。
   * @param key 参数 key。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：clearPendingTimer('demo-value'); // undefined
   */
  private clearPendingTimer(key: string): void {
    // 变量：timer，用于存储定时器。
    const timer = this.timers.get(key);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.timers.delete(key);
  }
}

/**
 * 方法：createParserDiagnostic
 * 说明：执行 createParserDiagnostic 相关处理逻辑。
 * @param range 参数 range。
 * @param message 参数 message。
 * @returns 返回 vscode.Diagnostic 类型结果。
 * 返回值示例：const result = createParserDiagnostic({ ... }, 'demo-value'); // { ok: true }
 */
function createParserDiagnostic(range: Range, message: string): vscode.Diagnostic {
  // 变量：diagnostic，用于存储诊断。
  const diagnostic = new vscode.Diagnostic(
    toVsCodeRange(range),
    message,
    vscode.DiagnosticSeverity.Error
  );
  diagnostic.source = "VHT Parser";
  diagnostic.code = getParserDiagnosticCode(message);
  return diagnostic;
}

/**
 * 方法：getParserDiagnosticCode
 * 说明：执行 getParserDiagnosticCode 相关处理逻辑。
 * @param message 参数 message。
 * @returns 命中时返回 string，未命中时返回 undefined。
 * 返回值示例：const result = getParserDiagnosticCode('demo-value'); // 'demo-value' 或 undefined
 */
function getParserDiagnosticCode(message: string): string | undefined {
  if (message.includes("空行")) {
    return "missing-blank-line";
  }

  if (message.includes("Header")) {
    return "invalid-header";
  }

  return undefined;
}

/**
 * 方法：createRuleDiagnostic
 * 说明：执行 createRuleDiagnostic 相关处理逻辑。
 * @param issue 参数 issue。
 * @returns 返回 vscode.Diagnostic 类型结果。
 * 返回值示例：const result = createRuleDiagnostic({ ... }); // { ok: true }
 */
function createRuleDiagnostic(issue: DiagnosticIssue): vscode.Diagnostic {
  // 变量：diagnostic，用于存储诊断。
  const diagnostic = new vscode.Diagnostic(
    toVsCodeRange(issue.range),
    issue.message,
    toSeverity(issue.severity)
  );
  diagnostic.code = issue.code;
  diagnostic.source = issue.source ?? "VHT Rules";
  return diagnostic;
}

/**
 * 方法：toSeverity
 * 说明：执行 toSeverity 相关处理逻辑。
 * @param severity 参数 severity。
 * @returns 返回 vscode.DiagnosticSeverity 类型结果。
 * 返回值示例：const result = toSeverity({ ... }); // { ok: true }
 */
function toSeverity(severity: DiagnosticIssue["severity"]): vscode.DiagnosticSeverity {
  if (severity === "error") {
    return vscode.DiagnosticSeverity.Error;
  }

  if (severity === "warning") {
    return vscode.DiagnosticSeverity.Warning;
  }

  return vscode.DiagnosticSeverity.Information;
}
