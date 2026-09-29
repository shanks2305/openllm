export type MarkdownSpan =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; url: string };

export type MarkdownBlock =
  | { type: 'paragraph'; spans: MarkdownSpan[] }
  | { type: 'code'; language: string; value: string }
  | { type: 'list'; ordered: boolean; items: MarkdownSpan[][] }
  | { type: 'heading'; level: 1 | 2 | 3; spans: MarkdownSpan[] }
  | { type: 'quote'; spans: MarkdownSpan[] }
  | { type: 'rule' };

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const fence = /^```(.*)$/.exec(lines[index]);

    if (fence) {
      const language = fence[1].trim();
      const code: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({ type: 'code', language, value: code.join('\n') });
      continue;
    }

    const text: string[] = [];

    while (index < lines.length && !lines[index].startsWith('```')) {
      text.push(lines[index]);
      index += 1;
    }

    blocks.push(...parseText(text.join('\n')));
  }

  return blocks;
}

export function parseInline(source: string): MarkdownSpan[] {
  const spans: MarkdownSpan[] = [];
  let cursor = 0;

  for (const match of source.matchAll(INLINE)) {
    const start = match.index ?? 0;

    if (start > cursor) {
      spans.push({ type: 'text', text: source.slice(cursor, start) });
    }

    const token = match[0];

    if (token.startsWith('`')) {
      spans.push({ type: 'code', text: token.slice(1, -1) });
    } else if (token.startsWith('**')) {
      spans.push({ type: 'bold', text: token.slice(2, -2) });
    } else if (token.startsWith('*')) {
      spans.push({ type: 'italic', text: token.slice(1, -1) });
    } else if (match[5] && match[6]) {
      spans.push({ type: 'link', text: match[5], url: match[6] });
    }

    cursor = start + token.length;
  }

  if (cursor < source.length) {
    spans.push({ type: 'text', text: source.slice(cursor) });
  }

  return spans.filter(span => span.type !== 'text' || span.text.length > 0);
}

function parseText(source: string): MarkdownBlock[] {
  const lines = source.split('\n');
  const blocks: MarkdownBlock[] = [];
  const paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    blocks.push({
      type: 'paragraph',
      spans: parseInline(paragraph.join(' ')),
    });
    paragraph.length = 0;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ type: 'rule' });
      continue;
    }

    const heading = HEADING.exec(line);

    if (heading) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: Math.min(heading[1].length, 3) as 1 | 2 | 3,
        spans: parseInline(heading[2]),
      });
      continue;
    }

    const quote = QUOTE.exec(line);

    if (quote) {
      flushParagraph();
      const quoted = [quote[1].trim()];

      while (index + 1 < lines.length) {
        const next = QUOTE.exec(lines[index + 1]);

        if (!next) {
          break;
        }

        quoted.push(next[1].trim());
        index += 1;
      }

      blocks.push({
        type: 'quote',
        spans: parseInline(quoted.filter(Boolean).join(' ')),
      });
      continue;
    }

    const item = /^(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
    const ordered = /^\d+\.\s+/.test(line);

    if (item) {
      flushParagraph();
      const items = [parseInline(item[1])];

      while (index + 1 < lines.length) {
        const next = lines[index + 1];
        const nextItem = /^(?:[-*]|\d+\.)\s+(.+)$/.exec(next);
        const nextOrdered = /^\d+\.\s+/.test(next);

        if (!nextItem || nextOrdered !== ordered) {
          break;
        }

        items.push(parseInline(nextItem[1]));
        index += 1;
      }

      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks;
}
