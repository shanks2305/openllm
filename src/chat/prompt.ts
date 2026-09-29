import type { ChatTurn } from '../engine/LlamaEngine';
import { documentAllowances, renderDocument } from './documents';
import { stripReasoning } from './reasoning';
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

export type SystemPromptParts = {
  chat?: string;
  project?: string;
  global?: string;
  memory?: string[];
  tools?: string;
};

// The most specific instructions win: chat, then project, then Settings.
// Memory and tool descriptions are added after whichever one applies.
export function buildSystemPrompt(parts: SystemPromptParts) {
  const base =
    [parts.chat, parts.project, parts.global]
      .map(value => value?.trim() ?? '')
      .find(Boolean) ?? '';
  const sections = [base];
  const memory = (parts.memory ?? []).map(item => item.trim()).filter(Boolean);

  if (memory.length > 0) {
    sections.push(
      `Things the user asked you to remember:\n${memory
        .map(item => `- ${item}`)
        .join('\n')}`,
    );
  }

  if (parts.tools?.trim()) {
    sections.push(parts.tools.trim());
  }

  return sections.filter(Boolean).join('\n\n');
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

export type TurnOptions = {
  documentChars?: number;
  vision?: boolean;
};

export function messagesToTurns(
  messages: ChatMessage[],
  systemPrompt: string,
  maxTokens = DEFAULT_CONTEXT_TOKENS,
  options: TurnOptions = {},
): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const system = systemPrompt.trim();
  const allowances = documentAllowances(
    messages,
    options.documentChars ?? Number.MAX_SAFE_INTEGER,
  );

  if (system) {
    turns.push({ role: 'system', content: system });
  }

  for (const message of messages) {
    const text =
      message.role === 'assistant'
        ? stripReasoning(message.content)
        : message.content;
    const attachments = message.attachments ?? [];
    const documents = attachments.flatMap(item =>
      item.kind === 'document'
        ? [renderDocument(item, allowances.get(item.id) ?? 0)]
        : [],
    );
    const images = attachments.flatMap(item =>
      item.kind === 'image' ? [item] : [],
    );
    const imageNotes =
      images.length > 0 && !options.vision
        ? [
            `[The user attached ${images.length === 1 ? 'an image' : `${images.length} images`}, but the current model cannot see images.]`,
          ]
        : [];
    const content = [...documents, ...imageNotes, text.trim() ? text : '']
      .filter(Boolean)
      .join('\n\n');

    if (!content.trim() && !(options.vision && images.length > 0)) {
      continue;
    }

    turns.push({
      role: message.role,
      content,
      ...(options.vision && images.length > 0
        ? { images: images.map(image => image.path) }
        : {}),
    });
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
