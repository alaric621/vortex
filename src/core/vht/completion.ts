import * as vscode from 'vscode';
import { VhtParser } from './parser';
import { findNodeAtPosition } from './types';
import { getHeaderCompletions, isInHeaderSection } from './headerCompletion';
import { getRequestLineCompletions, isInRequestLine } from './requestLineCompletion';

export class VhtCompletionProvider implements vscode.CompletionItemProvider {
    private readonly parser = new VhtParser();

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const ast = this.parser.parse(document.getText());
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
}
