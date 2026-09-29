jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/documents',
  exists: jest.fn(async () => false),
  readFile: jest.fn(async () => '{}'),
  writeFile: jest.fn(async () => undefined),
}));

import { maxTokensForContext } from '../src/settings/settingsStore';
import { promptTokenBudget } from '../src/chat/prompt';

describe('generation limits', () => {
  it('offers 2048 tokens only when the context can hold them', () => {
    expect(maxTokensForContext(2048)).toEqual([128, 256, 512, 1024]);
    expect(maxTokensForContext(4096)).toContain(2048);
  });

  it('reserves response tokens inside the context', () => {
    expect(promptTokenBudget(4096, 256)).toBe(3840);
    expect(promptTokenBudget(256, 1024)).toBe(128);
  });
});
