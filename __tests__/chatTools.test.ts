import { conversationToMarkdown } from '../src/chat/export';
import { matchChat } from '../src/chat/search';
import { getCatalogModel, MODEL_CATALOG } from '../src/model/catalog';

describe('matchChat', () => {
  const chat = {
    title: 'Trip planning',
    messages: [
      { content: 'What should I pack?' },
      { content: 'Bring a rain jacket for the mountain passes in October.' },
    ],
  };

  it('matches every chat when the query is empty', () => {
    expect(matchChat(chat, '  ')).toEqual({ snippet: null });
  });

  it('matches titles without a snippet', () => {
    expect(matchChat(chat, 'TRIP')).toEqual({ snippet: null });
  });

  it('matches message text and returns a snippet around it', () => {
    const match = matchChat(chat, 'rain jacket');

    expect(match?.snippet).toContain('rain jacket');
  });

  it('returns null when nothing matches', () => {
    expect(matchChat(chat, 'sunscreen')).toBeNull();
  });
});

describe('conversationToMarkdown', () => {
  it('writes a readable transcript and skips empty messages', () => {
    const text = conversationToMarkdown(
      {
        title: 'Hello',
        systemPrompt: 'Be brief.',
        messages: [
          { id: '1', role: 'user', content: 'Hi' },
          { id: '2', role: 'assistant', content: '' },
          { id: '3', role: 'assistant', content: 'Hello!' },
        ],
      },
      'Qwen2.5 0.5B',
    );

    expect(text).toBe(
      [
        '# Hello',
        '',
        '_Model: Qwen2.5 0.5B_',
        '',
        '> Instructions: Be brief.',
        '',
        '**You**',
        '',
        'Hi',
        '',
        '**Assistant**',
        '',
        'Hello!',
        '',
      ].join('\n'),
    );
  });
});

describe('catalog quant variants', () => {
  it('keeps the original id for the default quant', () => {
    const qwen = MODEL_CATALOG.find(
      model => model.id === 'qwen2.5-0.5b-instruct-q4_k_m',
    );

    expect(qwen?.quant).toBe('Q4_K_M');
    expect(qwen?.variants.map(variant => variant.quant)).toEqual([
      'Q4_K_M',
      'Q5_K_M',
      'Q8_0',
    ]);
  });

  it('resolves a non-default variant with its own url and a labelled name', () => {
    const model = getCatalogModel('qwen2.5-0.5b-instruct-q8_0');

    expect(model).toMatchObject({
      name: 'Qwen2.5 0.5B Instruct Q8_0',
      quant: 'Q8_0',
      sizeBytes: 675710816,
      url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q8_0.gguf',
    });
  });

  it('gives every variant a unique id', () => {
    const ids = MODEL_CATALOG.flatMap(model =>
      model.variants.map(variant => variant.id),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });
});
