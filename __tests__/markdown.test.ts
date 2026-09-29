import { parseMarkdown } from '../src/chat/markdown';

describe('parseMarkdown', () => {
  it('splits fenced code from the surrounding text', () => {
    const blocks = parseMarkdown('See this:\n```ts\nconst n = 1;\n```\nDone');
    const code = blocks.find(block => block.type === 'code');

    expect(code).toMatchObject({
      type: 'code',
      language: 'ts',
      value: 'const n = 1;',
    });
    expect(blocks.some(block => block.type === 'paragraph')).toBe(true);
  });

  it('keeps an unclosed fence as code', () => {
    const blocks = parseMarkdown('```py\nprint(1)');

    expect(blocks).toEqual([
      { type: 'code', language: 'py', value: 'print(1)' },
    ]);
  });

  it('reads lists, emphasis, and links', () => {
    const blocks = parseMarkdown(
      'Use **bold** and `code`.\n\n- first\n- see [docs](https://example.com)',
    );
    const list = blocks.find(block => block.type === 'list');

    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(list).toMatchObject({ type: 'list', ordered: false });

    if (list?.type === 'list') {
      expect(list.items).toHaveLength(2);
      expect(list.items[1].some(span => span.type === 'link')).toBe(true);
    }
  });
});
