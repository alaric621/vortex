import * as fs from "node:fs";
import * as path from "node:path";
import type * as vscode from "vscode";

export interface VhtEnvVariables {
    [key: string]: unknown;
    name: string;
    client: {
        api: string;
        token: string;
    };
    env: string;
}

export const vhtMockVariables: VhtEnvVariables = {
    name: 'demo-user',
    client: {
        api: 'demo-api-key-123',
        token: 'demo-token'
    },
    env: 'dev'
};

export interface VortexWorkspaceConfig {
    activeEnvironment?: string;
    variables?: Record<string, unknown>;
    environments?: Record<string, Record<string, unknown>>;
}

const runtimeVariableOverrides = new Map<string, Record<string, unknown>>();
const runtimeVariableListeners = new Set<(documentUri?: vscode.Uri) => void>();

function getVSCodeModule(): typeof vscode | undefined {
    const globalModule = (globalThis as { __vscode?: typeof vscode }).__vscode;
    if (globalModule) {
        return globalModule;
    }

    try {
        return require("vscode") as typeof vscode;
    } catch {
        return undefined;
    }
}

function getWorkspaceRoots(documentUri?: vscode.Uri): string[] {
    const vscodeModule = getVSCodeModule();
    if (!vscodeModule) {
        return [];
    }

    const roots = new Set<string>();
    const folder = documentUri ? vscodeModule.workspace.getWorkspaceFolder(documentUri) : undefined;
    if (folder?.uri.fsPath) {
        roots.add(folder.uri.fsPath);
    }

    for (const workspaceFolder of vscodeModule.workspace.workspaceFolders ?? []) {
        if (workspaceFolder.uri.fsPath) {
            roots.add(workspaceFolder.uri.fsPath);
        }
    }

    return Array.from(roots);
}

function loadWorkspaceConfig(documentUri?: vscode.Uri): VortexWorkspaceConfig | undefined {
    for (const root of getWorkspaceRoots(documentUri)) {
        const configPath = path.join(root, "vortex.json");
        if (!fs.existsSync(configPath)) {
            continue;
        }

        try {
            const raw = fs.readFileSync(configPath, "utf8");
            return JSON.parse(raw) as VortexWorkspaceConfig;
        } catch {
            return undefined;
        }
    }

    return undefined;
}

function getBaseVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
    const config = loadWorkspaceConfig(documentUri);
    if (!config) {
        return vhtMockVariables;
    }

    const baseVariables = config.variables ?? {};
    const activeName = config.activeEnvironment;
    const activeVariables = activeName ? config.environments?.[activeName] : undefined;

    if (activeVariables) {
        return {
            ...baseVariables,
            ...activeVariables
        };
    }

    if (Object.keys(baseVariables).length > 0) {
        return baseVariables;
    }

    return vhtMockVariables;
}

function toRuntimeKey(documentUri?: vscode.Uri): string | undefined {
    return documentUri?.toString();
}

function emitRuntimeVariableChange(documentUri?: vscode.Uri): void {
    for (const listener of runtimeVariableListeners) {
        listener(documentUri);
    }
}

function cloneValue<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(item => cloneValue(item)) as T;
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, cloneValue(item)])
        ) as T;
    }

    return value;
}

export function getVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
    const key = toRuntimeKey(documentUri);
    if (key) {
        const runtimeVariables = runtimeVariableOverrides.get(key);
        if (runtimeVariables) {
            return runtimeVariables;
        }
    }

    return getBaseVhtVariables(documentUri);
}

export function createMutableVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
    return cloneValue(getVhtVariables(documentUri));
}

export function createMutableBaseVhtVariables(documentUri?: vscode.Uri): Record<string, unknown> {
    return cloneValue(getBaseVhtVariables(documentUri));
}

export function setRuntimeVhtVariables(documentUri: vscode.Uri, variables: Record<string, unknown>): void {
    runtimeVariableOverrides.set(documentUri.toString(), variables);
    emitRuntimeVariableChange(documentUri);
}

export function clearRuntimeVhtVariables(documentUri?: vscode.Uri): void {
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

export function onDidChangeVhtVariables(listener: (documentUri?: vscode.Uri) => void): { dispose(): void } {
    runtimeVariableListeners.add(listener);
    return {
        dispose(): void {
            runtimeVariableListeners.delete(listener);
        }
    };
}
