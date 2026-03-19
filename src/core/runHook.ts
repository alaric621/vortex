import type * as vscode from "vscode";
import { getVhtVariables } from "../env";
import { Collections } from "../../typings/filesystem";
import { resolveVariableExpression } from "./vht/variableExpression";

export interface HookRequest extends Partial<Collections> {
  id: string;
  documentUri?: vscode.Uri;
}

export interface HookResponse {
  status?: number;
  statusText?: string;
  headers?: Record<string, unknown>;
  body?: string;
  events?: string[];
  error?: string;
  meta?: Record<string, unknown>;
}

export interface HookContext {
  request: HookRequest;
  response: HookResponse;
  variables: Record<string, unknown>;
  log: (message: string) => void;
}

type AsyncHookFunction = (
  context: HookContext,
  request: HookRequest,
  response: HookResponse,
  variables: Record<string, unknown>,
  console: Console
) => Promise<void>;

export function resolveTemplate(input: string | undefined, variables: Record<string, unknown>): string {
  if (!input) {
    return "";
  }

  return input.replace(/\{\{([\s\S]*?)\}\}/g, (_match, expression: string) => {
    const resolved = resolveVariableExpression(expression.trim(), variables);
    return resolved.kind === "resolved" ? String(resolved.value) : "";
  });
}

export function resolveHookRequest(param: HookRequest): HookRequest {
  const variables = getVhtVariables(param.documentUri);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(param.headers ?? {})) {
    headers[resolveTemplate(key, variables)] = resolveTemplate(value, variables);
  }

  return {
    ...param,
    url: resolveTemplate(param.url, variables),
    headers,
    body: resolveTemplate(param.body, variables),
    scripts: {
      pre: resolveTemplate(param.scripts?.pre ?? "", variables),
      post: resolveTemplate(param.scripts?.post ?? "", variables)
    }
  };
}

export async function runHook(script: string | undefined, context: HookContext): Promise<void> {
  const source = script?.trim();
  if (!source) {
    return;
  }

  const asyncFactory = Object.getPrototypeOf(async function noop() {}).constructor as new (
    ...args: string[]
  ) => AsyncHookFunction;

  const hookConsole: Console = {
    ...console,
    log: (...args: unknown[]) => context.log(args.map(arg => String(arg)).join(" ")),
    warn: (...args: unknown[]) => context.log(`[warn] ${args.map(arg => String(arg)).join(" ")}`),
    error: (...args: unknown[]) => context.log(`[error] ${args.map(arg => String(arg)).join(" ")}`)
  };

  const runner = new asyncFactory(
    "context",
    "request",
    "response",
    "variables",
    "console",
    source
  );

  await runner(context, context.request, context.response, context.variables, hookConsole);
}
