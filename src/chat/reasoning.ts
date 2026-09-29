export type ReasoningParts = {
  thinking: string | null;
  // False while a thinking block is still streaming.
  thinkingDone: boolean;
  answer: string;
};

const OPEN = '<think>';
const CLOSE = '</think>';

export function splitReasoning(content: string): ReasoningParts {
  const thoughts: string[] = [];
  let answer = '';
  let rest = content;
  let done = true;

  // Some templates put the opening tag in the prompt, so the reply starts
  // inside the thinking block and only the closing tag appears.
  const firstOpen = rest.indexOf(OPEN);
  const firstClose = rest.indexOf(CLOSE);

  if (firstClose >= 0 && (firstOpen < 0 || firstClose < firstOpen)) {
    thoughts.push(rest.slice(0, firstClose));
    rest = rest.slice(firstClose + CLOSE.length);
  }

  while (rest.length > 0) {
    const open = rest.indexOf(OPEN);

    if (open < 0) {
      answer += rest;
      break;
    }

    answer += rest.slice(0, open);
    const afterOpen = rest.slice(open + OPEN.length);
    const close = afterOpen.indexOf(CLOSE);

    if (close < 0) {
      thoughts.push(afterOpen);
      done = false;
      break;
    }

    thoughts.push(afterOpen.slice(0, close));
    rest = afterOpen.slice(close + CLOSE.length);
  }

  const thinking = thoughts
    .map(part => part.trim())
    .filter(Boolean)
    .join('\n\n');

  return {
    thinking: thinking || (!done ? '' : null),
    thinkingDone: done,
    answer: answer.replace(/^\s+/, ''),
  };
}

export function stripReasoning(content: string) {
  return splitReasoning(content).answer;
}

export function hasReasoning(content: string) {
  return content.includes(OPEN) || content.includes(CLOSE);
}
