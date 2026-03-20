import { describe, expect, it } from 'vitest';
import { Parser } from '../src/core/vht/engine/parser';
import { findNodeAtPosition } from '../src/core/vht/engine/parser/types';

describe('vht position context', () => {
    const parser = new Parser();
    
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
