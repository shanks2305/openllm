import type { ChatTurn } from '../engine/LlamaEngine';
import type { ChatMessage } from './types';

const CHARS_PER_TOKEN = 4;
export const DEFAULT_CONTEXT_TOKENS = 3000;

export function estimateTokens(text: string) {
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function promptTokenBudget(contextSize: number, reservedTokens: number) {
  const budget = Math.floor(contextSize - reservedTokens);
  return Math.max(128, budget);
}

// The native module trims history with the model's real tokenizer. This only
// bounds the payload, so it assumes about two characters per token and keeps
// more history than the four-character estimate would.
export function coarseHistoryBudget(
  contextSize: number,
  reservedTokens: number,
) {
  return promptTokenBudget(contextSize, reservedTokens) * 2;
}

export const TITLE_REQUEST =
  'Write a title of at most six words for this conversation. Reply with the title only.';

export function cleanGeneratedTitle(raw: string) {
  const line =
    raw
      .split('\n')
      .map(part => part.trim())
      .find(Boolean) ?? '';
  const title = line
    .replace(/^(title|chat title)\s*[:\-–]\s*/i, '')
    .replace(/^[#*_"'“”‘’`\s]+|[#*_"'“”‘’`\s.!?:;,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (title.length < 2) {
    return null;
  }

  return title.length <= 60 ? title : `${title.slice(0, 60).trimEnd()}…`;
}

export function titleFromMessages(messages: ChatMessage[]) {
  const firstUser = messages.find(
    message => message.role === 'user' && message.content.trim(),
  );

  if (!firstUser) {
    return 'New chat';
  }

  const line = firstUser.content.trim().replace(/\s+/g, ' ');

  if (line.length <= 42) {
    return line;
  }

  return `${line.slice(0, 42).trimEnd()}…`;
}

export function messagesToTurns(
  messages: ChatMessage[],
  systemPrompt: string,
  maxTokens = DEFAULT_CONTEXT_TOKENS,
): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const system = systemPrompt.trim();

  if (system) {
    turns.push({ role: 'system', content: system });
  }

  for (const message of messages) {
    const content = message.content.trim();

    if (!content) {
      continue;
    }

    turns.push({ role: message.role, content: message.content });
  }

  return fitContext(turns, maxTokens);
}

export function fitContext(
  turns: ChatTurn[],
  maxTokens = DEFAULT_CONTEXT_TOKENS,
): ChatTurn[] {
  const system = turns.filter(turn => turn.role === 'system');
  const rest = turns.filter(turn => turn.role !== 'system');
  const kept: ChatTurn[] = [];
  let used = system.reduce(
    (total, turn) => total + estimateTokens(turn.content),
    0,
  );

  for (let index = rest.length - 1; index >= 0; index -= 1) {
    const turn = rest[index];
    const tokens = estimateTokens(turn.content);

    if (kept.length > 0 && used + tokens > maxTokens) {
      break;
    }

    kept.push(turn);
    used += tokens;
  }

  kept.reverse();
  return [...system, ...kept];
}
