import {
  cleanGeneratedTitle,
  fitContext,
  messagesToTurns,
  titleFromMessages,
} from '../src/chat/prompt';

describe('cleanGeneratedTitle', () => {
  it('strips labels, quotes, markdown, and trailing punctuation', () => {
    expect(cleanGeneratedTitle('Title: "Sorting Arrays in Rust".')).toBe(
      'Sorting Arrays in Rust',
    );
    expect(cleanGeneratedTitle('**Trip Planning**\nextra line')).toBe(
      'Trip Planning',
    );
  });

  it('rejects empty output and clips long titles', () => {
    expect(cleanGeneratedTitle('  \n "" ')).toBeNull();
    const long = cleanGeneratedTitle('word '.repeat(30));
    expect(long?.endsWith('…')).toBe(true);
    expect(long!.length).toBeLessThanOrEqual(61);
  });
});
import type { ChatMessage } from '../src/chat/types';

function message(
  id: string,
  role: ChatMessage['role'],
  content: string,
): ChatMessage {
  return { id, role, content };
}

describe('titleFromMessages', () => {
  it('uses a short title until the first user message', () => {
    expect(titleFromMessages([])).toBe('New chat');
  });

  it('clips a long first message', () => {
    const title = titleFromMessages([
      message('1', 'user', 'explain how a local language model keeps context'),
    ]);

    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(43);
  });
});

describe('messagesToTurns', () => {
  it('keeps the system prompt and the newest turns that fit', () => {
    const messages = [
      message('1', 'user', 'a'.repeat(8000)),
      message('2', 'assistant', 'b'.repeat(8000)),
      message('3', 'user', 'latest question'),
    ];

    const turns = messagesToTurns(messages, 'be brief');

    expect(turns[0]).toEqual({ role: 'system', content: 'be brief' });
    expect(turns[turns.length - 1]).toEqual({
      role: 'user',
      content: 'latest question',
    });
    expect(turns.some(turn => turn.content.startsWith('aaa'))).toBe(false);
  });

  it('always keeps the latest message even when it is long', () => {
    const turns = fitContext([{ role: 'user', content: 'x'.repeat(20000) }]);

    expect(turns).toHaveLength(1);
    expect(turns[0].content).toHaveLength(20000);
  });

  it('keeps older turns that fit the token budget', () => {
    const turns = fitContext(
      [
        { role: 'user', content: 'a'.repeat(400) },
        { role: 'user', content: 'latest' },
      ],
      120,
    );

    expect(turns.map(turn => turn.content)).toEqual([
      'a'.repeat(400),
      'latest',
    ]);
  });

  it('drops older turns that exceed the token budget', () => {
    const turns = fitContext(
      [
        { role: 'system', content: 'rules' },
        { role: 'user', content: 'a'.repeat(800) },
        { role: 'assistant', content: 'b'.repeat(400) },
        { role: 'user', content: 'latest' },
      ],
      120,
    );

    expect(turns.map(turn => turn.role)).toEqual([
      'system',
      'assistant',
      'user',
    ]);
    expect(turns.some(turn => turn.content.startsWith('aaa'))).toBe(false);
  });
});
