import type * as vscode from "vscode";
import type { Collections } from "../../typings/filesystem";
import { createMutableBaseVhtVariables, setRuntimeVhtVariables } from "../context";
import { runHookStrict } from "./runHook";

/**
 * 方法：prepareRuntimeVariables
 * 说明：执行 prepareRuntimeVariables 相关处理逻辑。
 * @param documentUri 参数 documentUri。
 * @param request 参数 request。
 * @returns 异步返回 Record<string, unknown> 类型结果。
 * 返回值示例：const result = await prepareRuntimeVariables(uri, item); // { token: 'demo-token', env: 'dev' }
 */
export async function prepareRuntimeVariables(
  documentUri: vscode.Uri,
  request: Collections
): Promise<Record<string, unknown>> {
  // 变量：fallbackVariables，用于存储fallback变量。
  const fallbackVariables = createMutableBaseVhtVariables(documentUri);
  // 变量：variables，用于存储变量。
  const variables = createMutableBaseVhtVariables(documentUri);
  // 变量：runtimeRequest，用于存储运行时请求。
  const runtimeRequest = cloneRequest(request);

  if (!runtimeRequest.scripts?.pre?.trim()) {
    setRuntimeState(documentUri, variables);
    return variables;
  }

  try {
    await runHookStrict(runtimeRequest.scripts.pre, {
      client: variables,
      variables,
      request: runtimeRequest
    });
    setRuntimeState(documentUri, variables);
    return variables;
  } catch (error) {
    setRuntimeState(documentUri, fallbackVariables);
    throw error;
  }
}

/**
 * 方法：setRuntimeState
 * 说明：执行 setRuntimeState 相关处理逻辑。
 * @param documentUri 参数 documentUri。
 * @param variables 参数 variables。
 * @returns 无返回值，通过副作用完成处理。
 * 返回值示例：setRuntimeState(uri, { token: 'abc' }); // undefined
 */
function setRuntimeState(documentUri: vscode.Uri, variables: Record<string, unknown>): void {
  setRuntimeVhtVariables(documentUri, variables);
}

/**
 * 方法：cloneRequest
 * 说明：执行 cloneRequest 相关处理逻辑。
 * @param request 参数 request。
 * @returns 返回 Collections 类型结果。
 * 返回值示例：const result = cloneRequest(item); // { id: 'req_demo', type: 'GET', name: 'users', folder: '/', url: 'https://example.com' }
 */
function cloneRequest(request: Collections): Collections {
  return {
    ...request,
    headers: request.headers ? { ...request.headers } : {},
    scripts: request.scripts
      ? { ...request.scripts }
      : { pre: "", post: "" }
  };
}
