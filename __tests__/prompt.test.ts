import { fitContext, messagesToTurns, titleFromMessages } from '../src/chat/prompt';
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
    const turns = fitContext([
      { role: 'user', content: 'x'.repeat(20000) },
    ]);

    expect(turns).toHaveLength(1);
    expect(turns[0].content).toHaveLength(20000);
  });
});
