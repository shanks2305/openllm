import { isImageFile } from '../src/chat/documents';
import {
  findToolCall,
  NO_THINK,
  visibleToolText,
  withThinkingSwitch,
} from '../src/chat/generation';
import { messagesToTurns } from '../src/chat/prompt';
import type { ChatMessage } from '../src/chat/types';
import { hasVision, reasoningStyle } from '../src/model/capabilities';

describe('withThinkingSwitch', () => {
  const turns = [
    { role: 'system' as const, content: 'Be brief.' },
    { role: 'user' as const, content: 'first' },
    { role: 'assistant' as const, content: 'ok' },
    { role: 'user' as const, content: 'second' },
  ];

  it('appends /no_think to the last user turn only', () => {
    const result = withThinkingSwitch(turns, 'toggle', false);
    expect(result[1].content).toBe('first');
    expect(result[3].content).toBe(`second ${NO_THINK}`);
  });

  it('leaves turns alone when thinking is on or the model has no switch', () => {
    expect(withThinkingSwitch(turns, 'toggle', true)).toBe(turns);
    expect(withThinkingSwitch(turns, 'always', false)).toBe(turns);
    expect(withThinkingSwitch(turns, null, false)).toBe(turns);
  });
});

describe('findToolCall', () => {
  it('ignores calls the model only considers while thinking', () => {
    const text =
      '<think>maybe <tool_call>{"name":"calculator","arguments":{"expression":"1+1"}}';
    expect(findToolCall(text)).toBeNull();
  });

  it('finds a call after the thinking block and keeps the thinking in before', () => {
    const text =
      '<think>need math</think>\nLet me check.<tool_call>\n{"name":"calculator","arguments":{"expression":"2*3"}}';
    const call = findToolCall(text);
    expect(call?.name).toBe('calculator');
    expect(call?.arguments).toEqual({ expression: '2*3' });
    expect(call?.before).toBe('<think>need math</think>\nLet me check.');
  });

  it('finds a call without any thinking', () => {
    expect(
      findToolCall('<tool_call>{"name":"current_datetime","arguments":{}}')?.name,
    ).toBe('current_datetime');
  });
});

describe('visibleToolText', () => {
  it('hides a streaming call but keeps the thinking', () => {
    expect(visibleToolText('<think>a</think>Sure. <tool_call>{"na')).toBe(
      '<think>a</think>Sure. ',
    );
    expect(visibleToolText('Sure. <tool_')).toBe('Sure. ');
  });
});

describe('capabilities', () => {
  it('detects Qwen3 as a switchable reasoning model', () => {
    expect(reasoningStyle({ id: 'qwen3-1.7b-q4_k_m', name: 'Qwen3 1.7B' })).toBe(
      'toggle',
    );
    expect(
      reasoningStyle({ id: 'imported-1', name: 'Qwen3-8B-Q4_K_M' }),
    ).toBe('toggle');
  });

  it('detects always-on reasoners and plain models', () => {
    expect(
      reasoningStyle({ id: 'x', name: 'DeepSeek-R1-Distill-Qwen-1.5B' }),
    ).toBe('always');
    expect(reasoningStyle({ id: 'qwen2.5-1.5b-q4_k_m', name: 'Qwen2.5 1.5B' })).toBeNull();
    expect(reasoningStyle({ id: 'x', name: 'Qwen2.5-VL-3B' })).toBeNull();
  });

  it('treats a model as vision-capable only with a projector', () => {
    expect(hasVision({ id: 'a', name: 'SmolVLM2' })).toBe(false);
    expect(
      hasVision({ id: 'a', name: 'SmolVLM2', projectorPath: '/x.mmproj.gguf' }),
    ).toBe(true);
  });
});

describe('image attachments in prompts', () => {
  const messages: ChatMessage[] = [
    {
      id: 'u1',
      role: 'user',
      content: 'What is this?',
      attachments: [
        { id: 'i1', kind: 'image', name: 'cat.jpg', path: '/tmp/cat.jpg' },
      ],
    },
  ];

  it('passes image paths when the model can see', () => {
    const [turn] = messagesToTurns(messages, '', 3000, { vision: true });
    expect(turn.images).toEqual(['/tmp/cat.jpg']);
    expect(turn.content).toBe('What is this?');
  });

  it('adds a note instead when the model cannot see', () => {
    const [turn] = messagesToTurns(messages, '', 3000, { vision: false });
    expect(turn.images).toBeUndefined();
    expect(turn.content).toContain('cannot see images');
  });

  it('recognizes image file names', () => {
    expect(isImageFile('IMG_0001.HEIC')).toBe(true);
    expect(isImageFile('notes.md')).toBe(false);
  });
});
