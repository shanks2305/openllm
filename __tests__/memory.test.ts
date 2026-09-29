jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/documents',
  exists: jest.fn(async () => false),
  readFile: jest.fn(async () => ''),
  writeFile: jest.fn(async () => undefined),
}));

import RNFS from 'react-native-fs';

import { buildSystemPrompt } from '../src/chat/prompt';
import { MAX_MEMORY_ITEMS, MemoryStore } from '../src/memory/memoryStore';

const exists = RNFS.exists as jest.Mock;
const readFile = RNFS.readFile as jest.Mock;

describe('MemoryStore', () => {
  it('adds, dedupes, edits, and removes facts', () => {
    const store = new MemoryStore();

    expect(store.add('  I live   in Pune ')).toBe(true);
    expect(store.add('i live in pune')).toBe(false);
    expect(store.add('   ')).toBe(false);

    const [item] = store.getState().items;
    expect(item.text).toBe('I live in Pune');

    store.update(item.id, 'I live in Mumbai');
    expect(store.getState().items[0].text).toBe('I live in Mumbai');

    store.update(item.id, '');
    expect(store.getState().items).toHaveLength(0);
  });

  it('stops at the item limit', () => {
    const store = new MemoryStore();

    for (let index = 0; index < MAX_MEMORY_ITEMS; index += 1) {
      store.add(`fact ${index}`);
    }

    expect(store.add('one more')).toBe(false);
  });

  it('hydrates saved facts and the enabled flag', async () => {
    exists.mockResolvedValueOnce(true);
    readFile.mockResolvedValueOnce(
      JSON.stringify({
        enabled: false,
        items: [{ id: 'a', text: 'likes tea', createdAt: 1 }, { id: 2 }],
      }),
    );
    const store = new MemoryStore();
    await store.hydrate();

    expect(store.getState()).toMatchObject({
      enabled: false,
      items: [{ id: 'a', text: 'likes tea', createdAt: 1 }],
    });
  });
});

describe('buildSystemPrompt', () => {
  it('prefers chat, then project, then global instructions', () => {
    expect(buildSystemPrompt({ chat: 'A', project: 'B', global: 'C' })).toBe('A');
    expect(buildSystemPrompt({ chat: ' ', project: 'B', global: 'C' })).toBe('B');
    expect(buildSystemPrompt({ global: 'C' })).toBe('C');
  });

  it('adds memory and tools after the instructions', () => {
    expect(
      buildSystemPrompt({
        global: 'Be kind.',
        memory: ['Name is Shankey', ''],
        tools: 'Tools here',
      }),
    ).toBe(
      'Be kind.\n\nThings the user asked you to remember:\n- Name is Shankey\n\nTools here',
    );
    expect(buildSystemPrompt({ memory: [] })).toBe('');
  });
});
