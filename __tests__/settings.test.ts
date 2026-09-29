jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/documents',
  exists: jest.fn(async () => false),
  readFile: jest.fn(async () => '{}'),
  writeFile: jest.fn(async () => undefined),
}));

import {
  contextOptionsForModel,
  effectiveContextSize,
  formatStopSequences,
  maxTokensForContext,
  parseStopSequences,
} from '../src/settings/settingsStore';
import { coarseHistoryBudget, promptTokenBudget } from '../src/chat/prompt';

describe('context options', () => {
  it('stays at 8192 or below when the model is unknown', () => {
    expect(contextOptionsForModel()).toEqual([2048, 4096, 8192]);
  });

  it('offers larger sizes only up to what the model was trained on', () => {
    expect(contextOptionsForModel(32768)).toEqual([
      2048, 4096, 8192, 16384, 32768,
    ]);
    expect(contextOptionsForModel(2048)).toEqual([2048]);
    expect(contextOptionsForModel(1024)).toEqual([2048]);
  });

  it('clamps a saved size to the selected model', () => {
    expect(effectiveContextSize(16384, 4096)).toBe(4096);
    expect(effectiveContextSize(4096, 131072)).toBe(4096);
    expect(effectiveContextSize(16384)).toBe(8192);
  });
});

describe('stop sequences', () => {
  it('reads one per line, drops blanks and duplicates, and decodes \\n', () => {
    expect(parseStopSequences('###\n\nUser:\n###\n\\n\\n')).toEqual([
      '###',
      'User:',
      '\n\n',
    ]);
  });

  it('round-trips through the settings text field', () => {
    const stops = ['</s>', '\nUser:'];
    expect(parseStopSequences(formatStopSequences(stops))).toEqual(stops);
  });
});

describe('generation limits', () => {
  it('offers 2048 tokens only when the context can hold them', () => {
    expect(maxTokensForContext(2048)).toEqual([128, 256, 512, 1024]);
    expect(maxTokensForContext(4096)).toContain(2048);
  });

  it('reserves response tokens inside the context', () => {
    expect(promptTokenBudget(4096, 256)).toBe(3840);
    expect(promptTokenBudget(256, 1024)).toBe(128);
  });

  it('keeps extra history for the native tokenizer to trim', () => {
    expect(coarseHistoryBudget(4096, 256)).toBe(7680);
  });
});
