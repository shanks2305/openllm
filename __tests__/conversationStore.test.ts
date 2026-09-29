jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/documents',
  exists: jest.fn(async () => false),
  readFile: jest.fn(async () => ''),
  writeFile: jest.fn(async () => undefined),
}));

import RNFS from 'react-native-fs';

import { ConversationStore } from '../src/chat/conversationStore';

const exists = RNFS.exists as jest.Mock;
const readFile = RNFS.readFile as jest.Mock;
const writeFile = RNFS.writeFile as jest.Mock;

describe('ConversationStore', () => {
  beforeEach(() => {
    exists.mockReset();
    readFile.mockReset();
    writeFile.mockReset();
    exists.mockResolvedValue(false);
    writeFile.mockResolvedValue(undefined);
  });

  it('drops a chat and clears the active id', async () => {
    const store = new ConversationStore();
    const chat = store.startNew();
    store.setMessages(chat.id, [{ id: '1', role: 'user', content: 'hello' }]);

    store.remove(chat.id);
    await store.flush();

    expect(store.getState().conversations).toHaveLength(0);
    expect(store.getState().activeId).toBeNull();
  });

  it('keeps a renamed title when later messages arrive', () => {
    const store = new ConversationStore();
    const chat = store.startNew();
    store.setMessages(chat.id, [
      { id: '1', role: 'user', content: 'hello there friend' },
    ]);
    store.rename(chat.id, 'Project notes');
    store.setMessages(chat.id, [
      { id: '1', role: 'user', content: 'a completely different opening' },
      { id: '2', role: 'assistant', content: 'ok' },
    ]);

    expect(store.getState().conversations[0].title).toBe('Project notes');
  });

  it('hydrates saved chats and ignores empty ones', async () => {
    exists.mockResolvedValue(true);
    readFile.mockResolvedValue(
      JSON.stringify({
        activeId: 'kept',
        conversations: [
          {
            id: 'empty',
            title: 'New chat',
            messages: [],
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'kept',
            title: 'Custom',
            titleCustom: true,
            modelId: 'llama',
            systemPrompt: 'be brief',
            messages: [{ id: 'm', role: 'user', content: 'hi' }],
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      }),
    );

    const store = new ConversationStore();
    await store.hydrate();
    const state = store.getState();

    expect(state.conversations).toHaveLength(1);
    expect(state.activeId).toBe('kept');
    expect(state.conversations[0]).toMatchObject({
      title: 'Custom',
      modelId: 'llama',
      systemPrompt: 'be brief',
      titleCustom: true,
    });
  });

  it('keeps a generated title until the user renames or resets it', () => {
    const store = new ConversationStore();
    const chat = store.startNew();
    store.setMessages(chat.id, [{ id: '1', role: 'user', content: 'hello' }]);
    store.setGeneratedTitle(chat.id, 'Friendly greeting');
    store.setMessages(chat.id, [
      { id: '1', role: 'user', content: 'hello' },
      { id: '2', role: 'assistant', content: 'hi' },
    ]);

    expect(store.getState().conversations[0].title).toBe('Friendly greeting');

    store.rename(chat.id, '');
    expect(store.getState().conversations[0].title).toBe('hello');
  });

  it('does not replace a custom title with a generated one', () => {
    const store = new ConversationStore();
    const chat = store.startNew();
    store.setMessages(chat.id, [{ id: '1', role: 'user', content: 'hello' }]);
    store.rename(chat.id, 'Mine');
    store.setGeneratedTitle(chat.id, 'Generated');

    expect(store.getState().conversations[0].title).toBe('Mine');
  });

  it('restores reply stats and drops malformed ones', async () => {
    exists.mockResolvedValue(true);
    readFile.mockResolvedValue(
      JSON.stringify({
        activeId: 'c',
        conversations: [
          {
            id: 'c',
            title: 'T',
            messages: [
              { id: 'u', role: 'user', content: 'hi' },
              {
                id: 'a',
                role: 'assistant',
                content: 'hello',
                stats: {
                  tokens: 12,
                  gpu: true,
                  tokensPerSecond: 30,
                  timeToFirstTokenMs: 'soon',
                },
              },
              { id: 'b', role: 'assistant', content: 'x', stats: 'bad' },
            ],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );

    const store = new ConversationStore();
    await store.hydrate();
    const [, reply, broken] = store.getState().conversations[0].messages;

    expect(reply.stats).toEqual({
      tokens: 12,
      gpu: true,
      tokensPerSecond: 30,
      timeToFirstTokenMs: null,
    });
    expect(broken.stats).toBeUndefined();
  });

  it('reports a save failure', async () => {
    writeFile.mockRejectedValue(new Error('full'));
    const store = new ConversationStore();
    store.startNew();
    await store.flush();

    expect(store.getState().saveError).toMatch(/save/i);
  });
});
