import * as vscode from 'vscode';
import { VhtParser } from './parser';
import { findNodeAtPosition, VhtAST } from './types';
import { getHeaderCompletions, isInHeaderSection } from './headerCompletion';
import { getRequestLineCompletions, isInRequestLine } from './requestLineCompletion';
import { getVariableCompletions } from './variableCompletion';

export class VhtCompletionProvider implements vscode.CompletionItemProvider {
    private readonly parser = new VhtParser();
    private readonly astCache: Map<string, { version: number; ast: VhtAST }> = new Map();

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const ast = this.getOrParseAst(document);
        const variableCompletions = getVariableCompletions(document, position, ast);
        if (variableCompletions.length > 0) {
            return variableCompletions;
        }

        const node = findNodeAtPosition(ast.nodes, position.line, position.character);

        if (isInHeaderSection(document, ast, position, node)) {
            return getHeaderCompletions(document, position, ast);
        }

        if (isInRequestLine(document, ast, position, node)) {
            return getRequestLineCompletions(document, position, ast);
        }

        if (!node) {
            const item = new vscode.CompletionItem('GET', vscode.CompletionItemKind.Keyword);
            item.insertText = new vscode.SnippetString('GET ${1:http://localhost:3000}');
            return [item];
        }

        return [];
    }

    private getOrParseAst(document: vscode.TextDocument): VhtAST {
        const key = document.uri.toString();
        const cached = this.astCache.get(key);
        if (cached && cached.version === document.version) {
            return cached.ast;
        }

        const ast = this.parser.parse(document.getText());
        this.astCache.set(key, { version: document.version, ast });
        if (this.astCache.size > 64) {
            this.astCache.clear();
        }
        return ast;
    }
}
