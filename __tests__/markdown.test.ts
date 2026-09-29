import { highlightCode } from '../src/chat/highlight';
import { latexToUnicode } from '../src/chat/latex';
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

describe('latexToUnicode', () => {
  it('turns common math into readable text', () => {
    expect(latexToUnicode('x^2 + y_{1} \\le \\frac{a}{b}')).toBe('x² + y₁ ≤ a/b');
    expect(latexToUnicode('\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}')).toBe(
      '(-b ± √(b²-4ac))/2a',
    );
    expect(latexToUnicode('\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}')).toBe(
      '∑ᵢ₌₁ⁿ i = (n(n+1))/2',
    );
    expect(latexToUnicode('\\mathbb{R}^n \\to \\text{real}')).toBe('ℝⁿ → real');
    expect(latexToUnicode('e^{i\\pi}')).toBe('e^(iπ)');
  });
});

describe('parseMarkdown extras', () => {
  it('reads a table with alignment', () => {
    const [table] = parseMarkdown(
      '| Name | Qty |\n|:-----|----:|\n| Apples | 3 |\n| Pears | **12** |',
    );

    expect(table).toMatchObject({ type: 'table', align: ['left', 'right'] });

    if (table.type === 'table') {
      expect(table.header.map(cell => cell[0].text)).toEqual(['Name', 'Qty']);
      expect(table.rows).toHaveLength(2);
      expect(table.rows[1][1]).toEqual([{ type: 'bold', text: '12' }]);
    }
  });

  it('reads display math and inline math but leaves prices alone', () => {
    const blocks = parseMarkdown(
      'Area is $\\pi r^2$ and costs $5 or $10.\n\n$$\nE = mc^2\n$$',
    );

    expect(blocks[0]).toMatchObject({ type: 'paragraph' });

    if (blocks[0].type === 'paragraph') {
      expect(blocks[0].spans.filter(span => span.type === 'math')).toEqual([
        { type: 'math', text: 'π r²' },
      ]);
      expect(
        blocks[0].spans.map(span => span.text).join(''),
      ).toContain('costs $5 or $10.');
    }

    expect(blocks[1]).toEqual({ type: 'math', value: 'E = mc²' });
  });

  it('reads nested lists, tasks, and strikethrough', () => {
    const [list] = parseMarkdown(
      '- top\n  1. inner\n  2. ~~old~~\n- [x] done',
    );

    expect(list).toMatchObject({
      type: 'list',
      markers: ['•', '1.', '2.', '•'],
      depths: [0, 1, 1, 0],
    });

    if (list.type === 'list') {
      expect(list.items[2]).toEqual([{ type: 'strike', text: 'old' }]);
      expect(list.items[3][0].text).toBe('☑ done');
    }
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
