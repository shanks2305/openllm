import { highlightCode } from '../src/chat/highlight';
import { parseMarkdown } from '../src/chat/markdown';

describe('parseMarkdown blocks', () => {
  it('reads headings, quotes, and rules', () => {
    const blocks = parseMarkdown(
      '## Setup\n> first line\n> second line\n\n---\n#### Deep',
    );

    expect(blocks.map(block => block.type)).toEqual([
      'heading',
      'quote',
      'rule',
      'heading',
    ]);
    expect(blocks[0]).toMatchObject({ level: 2 });
    expect(blocks[1]).toMatchObject({
      spans: [{ type: 'text', text: 'first line second line' }],
    });
    expect(blocks[3]).toMatchObject({ level: 3 });
  });

  it('does not treat a hashtag without a space as a heading', () => {
    expect(parseMarkdown('#notaheading')[0].type).toBe('paragraph');
  });
});

describe('highlightCode', () => {
  it('marks keywords, strings, numbers, and comments', () => {
    const tokens = highlightCode('const n = 42; // answer\nlet s = "hi";', 'ts');
    const byType = (type: string) =>
      tokens.filter(token => token.type === type).map(token => token.text);

    expect(byType('keyword')).toEqual(['const', 'let']);
    expect(byType('number')).toEqual(['42']);
    expect(byType('comment')).toEqual(['// answer']);
    expect(byType('string')).toEqual(['"hi"']);
    expect(tokens.map(token => token.text).join('')).toBe(
      'const n = 42; // answer\nlet s = "hi";',
    );
  });

  it('uses hash comments for Python and keeps floor division', () => {
    const tokens = highlightCode('x = 7 // 2  # half', 'python');

    expect(tokens.filter(token => token.type === 'comment')).toEqual([
      { type: 'comment', text: '# half' },
    ]);
  });

  it('leaves unlabelled code plain', () => {
    expect(highlightCode('if x', '')).toEqual([{ type: 'plain', text: 'if x' }]);
  });
});

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
