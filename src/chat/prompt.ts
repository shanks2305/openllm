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
