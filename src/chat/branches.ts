import type { Branch, ChatMessage } from './types';

export type Branches = Record<string, Branch>;

export type BranchInfo = {
  active: number;
  count: number;
};

const ROOT = '__root__';

// Versions are keyed by the message they follow, which stays stable while the
// messages after it are swapped in and out.
export function branchKey(messages: ChatMessage[], index: number) {
  return index <= 0 ? ROOT : messages[index - 1]?.id ?? ROOT;
}

// Saves the messages from `index` onward as a version and opens an empty one
// for the reply that is about to replace them.
export function openBranch(
  branches: Branches,
  messages: ChatMessage[],
  index: number,
): Branches {
  const key = branchKey(messages, index);
  const tail = messages.slice(index);
  const existing = branches[key];

  if (!existing) {
    if (tail.length === 0) {
      return branches;
    }

    return { ...branches, [key]: { tails: [tail, []], active: 1 } };
  }

  const tails = [...existing.tails];
  tails[existing.active] = tail;
  const kept = tails.filter(item => item.length > 0);
  return { ...branches, [key]: { tails: [...kept, []], active: kept.length } };
}

export function switchBranch(
  branches: Branches,
  messages: ChatMessage[],
  index: number,
  target: number,
): { branches: Branches; messages: ChatMessage[] } | null {
  const key = branchKey(messages, index);
  const branch = branches[key];

  if (
    !branch ||
    target < 0 ||
    target >= branch.tails.length ||
    target === branch.active
  ) {
    return null;
  }

  const tails = [...branch.tails];
  tails[branch.active] = messages.slice(index);

  return {
    branches: { ...branches, [key]: { tails, active: target } },
    messages: [...messages.slice(0, index), ...tails[target]],
  };
}

// A regeneration stopped before any text leaves an empty version behind. This
// removes it and brings back the reply that was there before.
export function dropEmptyBranch(
  branches: Branches,
  messages: ChatMessage[],
): { branches: Branches; messages: ChatMessage[] } | null {
  const key = branchKey(messages, messages.length);
  const branch = branches[key];

  if (!branch) {
    return null;
  }

  const tails = branch.tails.filter(
    (tail, index) => index !== branch.active && tail.length > 0,
  );
  const next = { ...branches };

  if (tails.length <= 1) {
    delete next[key];
  } else {
    next[key] = { tails, active: tails.length - 1 };
  }

  return {
    branches: next,
    messages: [...messages, ...(tails[tails.length - 1] ?? [])],
  };
}

export function branchInfo(
  branches: Branches | undefined,
  messages: ChatMessage[],
  index: number,
): BranchInfo | null {
  const branch = branches?.[branchKey(messages, index)];

  if (!branch || branch.tails.length < 2) {
    return null;
  }

  return { active: branch.active, count: branch.tails.length };
}
