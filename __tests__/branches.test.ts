import {
  branchInfo,
  dropEmptyBranch,
  openBranch,
  switchBranch,
} from '../src/chat/branches';
import type { ChatMessage } from '../src/chat/types';

const user = (id: string, content = id): ChatMessage => ({
  id,
  role: 'user',
  content,
});
const reply = (id: string, content = id): ChatMessage => ({
  id,
  role: 'assistant',
  content,
});

describe('branches', () => {
  it('keeps the old reply when regenerating and switches back to it', () => {
    const messages = [user('u1'), reply('a1')];
    let branches = openBranch({}, messages, 1);
    let live = [user('u1'), reply('a2')];

    expect(branchInfo(branches, live, 1)).toEqual({ active: 1, count: 2 });

    const back = switchBranch(branches, live, 1, 0);
    expect(back?.messages.map(message => message.id)).toEqual(['u1', 'a1']);

    branches = back!.branches;
    live = back!.messages;
    const forward = switchBranch(branches, live, 1, 1);
    expect(forward?.messages.map(message => message.id)).toEqual(['u1', 'a2']);
  });

  it('keeps later turns with the version they belong to', () => {
    const original = [user('u1'), reply('a1'), user('u2'), reply('a2')];
    const branches = openBranch({}, original, 0);
    const edited = [user('e1'), reply('b1')];
    const back = switchBranch(branches, edited, 0, 0);

    expect(back?.messages.map(message => message.id)).toEqual([
      'u1',
      'a1',
      'u2',
      'a2',
    ]);
  });

  it('keeps a nested version inside an older one', () => {
    const base = [user('u1'), reply('a1'), user('u2'), reply('a2')];
    let branches = openBranch({}, base, 3);
    let live = [user('u1'), reply('a1'), user('u2'), reply('a3')];
    branches = openBranch(branches, live, 0);
    live = [user('e1'), reply('b1')];

    const restored = switchBranch(branches, live, 0, 0)!;
    expect(restored.messages.map(message => message.id)).toEqual([
      'u1',
      'a1',
      'u2',
      'a3',
    ]);
    expect(branchInfo(restored.branches, restored.messages, 3)).toEqual({
      active: 1,
      count: 2,
    });
  });

  it('adds a third version at the end', () => {
    let branches = openBranch({}, [user('u1'), reply('a1')], 1);
    branches = openBranch(branches, [user('u1'), reply('a2')], 1);

    expect(branchInfo(branches, [user('u1'), reply('a3')], 1)).toEqual({
      active: 2,
      count: 3,
    });
  });

  it('restores the previous reply when a regeneration is cancelled', () => {
    const branches = openBranch({}, [user('u1'), reply('a1')], 1);
    const restored = dropEmptyBranch(branches, [user('u1')]);

    expect(restored?.messages.map(message => message.id)).toEqual([
      'u1',
      'a1',
    ]);
    expect(branchInfo(restored?.branches, restored!.messages, 1)).toBeNull();
  });

  it('does not open a version when nothing follows the fork', () => {
    expect(openBranch({}, [user('u1')], 1)).toEqual({});
  });
});
