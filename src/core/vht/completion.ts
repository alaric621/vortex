import * as vscode from 'vscode';
import { findNodeAtPosition } from './types';
import { getHeaderCompletions, isInHeaderSection } from './headerCompletion';
import { getRequestLineCompletions, isInRequestLine } from './requestLineCompletion';
import { getVariableCompletions } from './variableCompletion';
import { DocumentAstCache } from './documentAstCache';

export class VhtCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private readonly astCache: DocumentAstCache = new DocumentAstCache()) {}

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

    private getOrParseAst(document: vscode.TextDocument) {
        return this.astCache.get(document);
    }
}
