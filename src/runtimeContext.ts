import type * as vscode from "vscode";

export type VariableListener = (documentUri?: vscode.Uri) => void;

export interface RuntimeContextDependencies {
  cloneValue<T>(value: T): T;
  getBaseVariables(documentUri?: vscode.Uri): Record<string, unknown>;
  invalidateBaseVariables(documentUri?: vscode.Uri): void;
}

export interface RuntimeContext {
  getVhtVariables(documentUri?: vscode.Uri): Record<string, unknown>;
  createMutableVhtVariables(documentUri?: vscode.Uri): Record<string, unknown>;
  createMutableBaseVhtVariables(documentUri?: vscode.Uri): Record<string, unknown>;
  setRuntimeVhtVariables(documentUri: vscode.Uri, variables: Record<string, unknown>): void;
  clearRuntimeVhtVariables(documentUri?: vscode.Uri): void;
  refreshBaseVhtVariables(documentUri?: vscode.Uri): void;
  onDidChangeVhtVariables(listener: VariableListener): { dispose(): void };
}

export function createRuntimeContext(deps: RuntimeContextDependencies): RuntimeContext {
  // 变量：runtimeVariableOverrides，运行时变量覆写表，按文档 URI 隔离。
  const runtimeVariableOverrides = new Map<string, Record<string, unknown>>();
  // 变量：runtimeVariableListeners，运行时变量变更监听器集合。
  const runtimeVariableListeners = new Set<VariableListener>();

  /**
   * 方法：getVhtVariables
   * 说明：获取当前文档生效变量，优先运行时覆写。
   * @param documentUri 参数 documentUri。
   * @returns 返回 Record<string, unknown> 类型结果。
   * 返回值示例：const result = getVhtVariables(uri); // { token: 'demo-token', env: 'dev' }
   */
  function getVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
    // 变量：runtimeVariables，用于保存当前流程中的中间状态。
    const runtimeVariables = getRuntimeVariables(documentUri);
    return runtimeVariables ?? deps.getBaseVariables(documentUri);
  }

  /**
   * 方法：createMutableVhtVariables
   * 说明：返回当前变量的可变深拷贝。
   * @param documentUri 参数 documentUri。
   * @returns 返回 Record<string, unknown> 类型结果。
   * 返回值示例：const result = createMutableVhtVariables(uri); // { token: 'demo-token', env: 'dev' }
   */
  function createMutableVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
    return deps.cloneValue(getVhtVariables(documentUri));
  }

  /**
   * 方法：createMutableBaseVhtVariables
   * 说明：返回基础变量（不含运行时覆写）的深拷贝。
   * @param documentUri 参数 documentUri。
   * @returns 返回 Record<string, unknown> 类型结果。
   * 返回值示例：const result = createMutableBaseVhtVariables(uri); // { token: 'demo-token', env: 'dev' }
   */
  function createMutableBaseVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
    return deps.cloneValue(deps.getBaseVariables(documentUri));
  }

  /**
   * 方法：setRuntimeVhtVariables
   * 说明：设置文档级运行时变量覆写。
   * @param documentUri 参数 documentUri。
   * @param variables 参数 variables。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：setRuntimeVhtVariables(uri, { token: 'abc' }); // undefined
   */
  function setRuntimeVhtVariables(documentUri: vscode.Uri, variables: Record<string, unknown>): void {
    runtimeVariableOverrides.set(documentUri.toString(), deps.cloneValue(variables));
    emitRuntimeVariableChange(documentUri);
  }

  /**
   * 方法：clearRuntimeVhtVariables
   * 说明：清理指定文档或全局运行时变量覆写。
   * @param documentUri 参数 documentUri。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：clearRuntimeVhtVariables(uri); // undefined
   */
  function clearRuntimeVhtVariables(documentUri?: vscode.Uri): void {
    // 变量：key，用于保存当前流程中的中间状态。
    const key = toRuntimeKey(documentUri);
    if (!key) {
      runtimeVariableOverrides.clear();
      emitRuntimeVariableChange();
      return;
    }

    if (runtimeVariableOverrides.delete(key)) {
      emitRuntimeVariableChange(documentUri);
    }
  }

  /**
   * 方法：refreshBaseVhtVariables
   * 说明：刷新基础变量缓存并广播变更。
   * @param documentUri 参数 documentUri。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：refreshBaseVhtVariables(uri); // undefined
   */
  function refreshBaseVhtVariables(documentUri?: vscode.Uri): void {
    deps.invalidateBaseVariables(documentUri);
    emitRuntimeVariableChange();
  }

  /**
   * 方法：onDidChangeVhtVariables
   * 说明：注册变量变更监听并返回取消订阅句柄。
   * @param listener 参数 listener。
   * @returns 返回 { dispose(): void } 类型结果。
   * 返回值示例：const result = onDidChangeVhtVariables(() => {}); // { dispose: () => {} }
   */
  function onDidChangeVhtVariables(listener: VariableListener): { dispose(): void } {
    runtimeVariableListeners.add(listener);
    return {
      /**
       * 方法：dispose
       * 说明：取消当前监听，释放订阅关系。
       * @param 无 本方法无入参。
       * @returns 无返回值，通过副作用完成处理。
       * 返回值示例：dispose(); // undefined
       */
      dispose(): void {
        runtimeVariableListeners.delete(listener);
      }
    };
  }

  /**
   * 方法：getRuntimeVariables
   * 说明：读取文档对应的运行时变量覆写。
   * @param documentUri 参数 documentUri。
   * @returns 命中时返回 Record<string, unknown>，未命中返回 undefined。
   * 返回值示例：const result = getRuntimeVariables(uri); // { token: 'demo-token', env: 'dev' } 或 undefined
   */
  function getRuntimeVariables(documentUri?: vscode.Uri): Record<string, unknown> | undefined {
    // 变量：key，用于保存当前流程中的中间状态。
    const key = toRuntimeKey(documentUri);
    return key ? runtimeVariableOverrides.get(key) : undefined;
  }

  /**
   * 方法：toRuntimeKey
   * 说明：将文档 URI 规范化为覆写映射键。
   * @param documentUri 参数 documentUri。
   * @returns 命中时返回 string，未命中返回 undefined。
   * 返回值示例：const result = toRuntimeKey(uri); // 'demo-value' 或 undefined
   */
  function toRuntimeKey(documentUri?: vscode.Uri): string | undefined {
    return documentUri?.toString();
  }

  /**
   * 方法：emitRuntimeVariableChange
   * 说明：向所有监听器广播变量变更。
   * @param documentUri 参数 documentUri。
   * @returns 无返回值，通过副作用完成处理。
   * 返回值示例：emitRuntimeVariableChange(uri); // undefined
   */
  function emitRuntimeVariableChange(documentUri?: vscode.Uri): void {
    for (const listener of runtimeVariableListeners) {
      listener(documentUri);
    }
  }

  return {
    getVhtVariables,
    createMutableVhtVariables,
    createMutableBaseVhtVariables,
    setRuntimeVhtVariables,
    clearRuntimeVhtVariables,
    refreshBaseVhtVariables,
    onDidChangeVhtVariables
  };
}
