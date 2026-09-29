import type { ChatTurn } from '../engine/LlamaEngine';
import type { ReasoningStyle } from '../model/capabilities';
import { hideToolCall, parseToolCall } from './tools';
import type { ParsedToolCall } from './tools';

export const NO_THINK = '/no_think';
export const THINKING_MIN_TOKENS = 1536;

const THINK_CLOSE = '</think>';

// Qwen3 thinks by default and reads a trailing /no_think as "answer directly".
export function withThinkingSwitch(
  turns: ChatTurn[],
  reasoning: ReasoningStyle,
  thinking: boolean,
): ChatTurn[] {
  if (reasoning !== 'toggle' || thinking) {
    return turns;
  }

  let last = -1;

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index].role === 'user') {
      last = index;
      break;
    }
  }

  if (last < 0) {
    return turns;
  }

  return turns.map((turn, index) =>
    index === last ? { ...turn, content: `${turn.content} ${NO_THINK}` } : turn,
  );
}

// Tool calls only count once the model has finished thinking; a call it merely
// considers inside <think> must not run.
function splitAtThinking(text: string) {
  const close = text.lastIndexOf(THINK_CLOSE);

  if (close >= 0) {
    const at = close + THINK_CLOSE.length;
    return { head: text.slice(0, at), tail: text.slice(at) };
  }

  if (text.trimStart().startsWith('<think>')) {
    return { head: text, tail: '' };
  }

  return { head: '', tail: text };
}

export function findToolCall(text: string): ParsedToolCall | null {
  const { head, tail } = splitAtThinking(text);
  const call = parseToolCall(tail);
  return call ? { ...call, before: head + call.before } : null;
}

export function visibleToolText(text: string) {
  const { head, tail } = splitAtThinking(text);
  return head + hideToolCall(tail);
}
