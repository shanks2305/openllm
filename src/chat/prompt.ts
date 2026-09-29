import type { ChatTurn } from '../engine/LlamaEngine';
import type { ChatMessage } from './types';

const DEFAULT_CONTEXT_CHARS = 12000;

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

  return fitContext(turns);
}

export function fitContext(
  turns: ChatTurn[],
  maxChars = DEFAULT_CONTEXT_CHARS,
): ChatTurn[] {
  const system = turns.filter(turn => turn.role === 'system');
  const rest = turns.filter(turn => turn.role !== 'system');
  const kept: ChatTurn[] = [];
  let used = system.reduce((total, turn) => total + turn.content.length, 0);

  for (let index = rest.length - 1; index >= 0; index -= 1) {
    const turn = rest[index];

    if (kept.length > 0 && used + turn.content.length > maxChars) {
      break;
    }

    kept.push(turn);
    used += turn.content.length;
  }

  kept.reverse();
  return [...system, ...kept];
}
