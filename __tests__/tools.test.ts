import {
  calculate,
  convertUnits,
  hideToolCall,
  parseToolCall,
  runTool,
  type ToolContext,
} from '../src/chat/tools';
import { splitReasoning, stripReasoning } from '../src/chat/reasoning';

const context: ToolContext = {
  now: () => new Date(2026, 8, 29, 21, 40),
  searchChats: query =>
    query === 'rust' ? [{ title: 'Sorting in Rust', snippet: '…use sort_by…' }] : [],
  remember: fact => fact !== 'dupe',
};

describe('calculate', () => {
  it('follows precedence and supports functions', () => {
    expect(calculate('2 + 3 * 4')).toBe(14);
    expect(calculate('(2 + 3) * 4')).toBe(20);
    expect(calculate('2^3^2')).toBe(512);
    expect(calculate('-3^2')).toBe(-9);
    expect(calculate('2^-1')).toBe(0.5);
    expect(calculate('2*-3')).toBe(-6);
    expect(calculate('sqrt(16) + abs(-2)')).toBe(6);
    expect(calculate('1,234 * 2')).toBe(2468);
    expect(calculate('5!')).toBe(120);
    expect(calculate('50%')).toBe(0.5);
    expect(calculate('10 % 3')).toBe(1);
    expect(calculate('2pi')).toBeCloseTo(6.283185, 5);
    expect(calculate('3(4+1)')).toBe(15);
  });

  it('rejects anything that is not math', () => {
    expect(() => calculate('process.exit()')).toThrow();
    expect(() => calculate('1/0')).toThrow(/zero/);
    expect(() => calculate('(1 + 2')).toThrow(/\)/);
  });
});

describe('convertUnits', () => {
  it('converts within a kind and between temperatures', () => {
    expect(convertUnits(1, 'mile', 'km')).toBeCloseTo(1.609344);
    expect(convertUnits(100, 'celsius', 'f')).toBeCloseTo(212);
    expect(convertUnits(2, 'lbs', 'kg')).toBeCloseTo(0.907185);
    expect(() => convertUnits(1, 'kg', 'km')).toThrow(/mass to length/);
  });
});

describe('parseToolCall', () => {
  it('reads a call whose close tag was cut by the stop sequence', () => {
    const call = parseToolCall(
      'Let me check.<tool_call>\n{"name": "calculator", "arguments": {"expression": "2+2"}}',
    );

    expect(call).toMatchObject({
      before: 'Let me check.',
      name: 'calculator',
      arguments: { expression: '2+2' },
    });
  });

  it('accepts string arguments and ignores broken JSON', () => {
    expect(
      parseToolCall('<tool_call>{"name":"search_chats","arguments":"{\\"query\\":\\"rust\\"}"}</tool_call>')
        ?.arguments,
    ).toEqual({ query: 'rust' });
    expect(parseToolCall('<tool_call>{"name": ')).toBeNull();
    expect(parseToolCall('no call here')).toBeNull();
  });

  it('hides a call, even a partial tag, while streaming', () => {
    expect(hideToolCall('Sure <tool_call>{"na')).toBe('Sure ');
    expect(hideToolCall('Sure <tool_')).toBe('Sure ');
    expect(hideToolCall('a < b')).toBe('a < b');
  });
});

describe('runTool', () => {
  it('runs tools and turns failures into results the model can read', () => {
    expect(
      runTool({ name: 'calculator', arguments: { expression: '6*7' } }, context)
        .result,
    ).toBe('6*7 = 42');
    expect(
      runTool({ name: 'search_chats', arguments: { query: 'rust' } }, context)
        .result,
    ).toContain('Sorting in Rust');
    expect(
      runTool({ name: 'remember', arguments: { fact: 'dupe' } }, context).result,
    ).toMatch(/Not saved/);
    expect(
      runTool({ name: 'current_datetime', arguments: {} }, context).result,
    ).toContain('Tuesday, September 29, 2026');
    expect(runTool({ name: 'nope', arguments: {} }, context).result).toMatch(
      /no tool named/,
    );
    expect(
      runTool({ name: 'calculator', arguments: {} }, context).result,
    ).toMatch(/^Error/);
  });
});

describe('splitReasoning', () => {
  it('separates finished and streaming thoughts from the answer', () => {
    expect(splitReasoning('<think>\nhmm\n</think>\n\nHello')).toEqual({
      thinking: 'hmm',
      thinkingDone: true,
      answer: 'Hello',
    });
    expect(splitReasoning('<think>still going')).toEqual({
      thinking: 'still going',
      thinkingDone: false,
      answer: '',
    });
    expect(splitReasoning('no tags')).toEqual({
      thinking: null,
      thinkingDone: true,
      answer: 'no tags',
    });
  });

  it('handles a reply that starts inside the block', () => {
    expect(splitReasoning('plan first</think>Answer').thinking).toBe('plan first');
    expect(stripReasoning('<think></think>\n\nHi')).toBe('Hi');
  });
});
