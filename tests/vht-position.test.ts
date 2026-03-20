import { describe, expect, it } from 'vitest';
import { VhtParser } from '../src/core/vht/parser';
import { findNodeAtPosition } from '../src/core/vht/parser/types';

describe('vht position context', () => {
    const parser = new VhtParser();
    
    it('should treat first-line lowercase method prefix as RequestLine', () => {
        const ast = parser.parse('g');
        const node = findNodeAtPosition(ast.nodes, 0, 0);

        expect(node?.type).toBe('RequestLine');
    });

    it('should not return Body when document has no RequestLine', () => {
        const ast = parser.parse('hello body');
        const node = findNodeAtPosition(ast.nodes, 0, 1);

        expect(node).toBeUndefined();
    });
});
