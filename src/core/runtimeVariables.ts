import type * as vscode from "vscode";
import type { Collections } from "../../typings/filesystem";
import { createMutableBaseVhtVariables, setRuntimeVhtVariables } from "../env";
import { runHookStrict } from "./runHook";

export async function prepareRuntimeVariables(
  documentUri: vscode.Uri,
  request: Collections
): Promise<Record<string, unknown>> {
  const fallbackVariables = createMutableBaseVhtVariables(documentUri);
  const variables = createMutableBaseVhtVariables(documentUri);

  if (!request.scripts?.pre?.trim()) {
    setRuntimeVhtVariables(documentUri, variables);
    return variables;
  }

  try {
    await runHookStrict(request.scripts.pre, {
      client: variables,
      variables,
      request
    });
    setRuntimeVhtVariables(documentUri, variables);
    return variables;
  } catch (error) {
    setRuntimeVhtVariables(documentUri, fallbackVariables);
    throw error;
  }
}
