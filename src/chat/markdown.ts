import { latexToUnicode } from './latex';

export type MarkdownSpan =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'strike'; text: string }
  | { type: 'code'; text: string }
  | { type: 'math'; text: string }
  | { type: 'link'; text: string; url: string };

export type TableAlign = 'left' | 'center' | 'right';

export type MarkdownBlock =
  | { type: 'paragraph'; spans: MarkdownSpan[] }
  | { type: 'code'; language: string; value: string }
  | {
      type: 'list';
      ordered: boolean;
      items: MarkdownSpan[][];
      markers?: string[];
      depths?: number[];
    }
  | { type: 'heading'; level: 1 | 2 | 3; spans: MarkdownSpan[] }
  | { type: 'quote'; spans: MarkdownSpan[] }
  | { type: 'math'; value: string }
  | {
      type: 'table';
      align: TableAlign[];
      header: MarkdownSpan[][];
      rows: MarkdownSpan[][][];
    }
  | { type: 'rule' };

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const INLINE =
  /(`[^`]+`)|(\\\((.+?)\\\))|(\$([^\s$](?:[^$\n]*[^\s$])?)\$(?!\d))|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const fence = /^\s*```(.*)$/.exec(lines[index]);

    if (fence) {
      const language = fence[1].trim();
      const code: string[] = [];
      index += 1;

      while (index < lines.length && !/^\s*```/.test(lines[index])) {
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

    while (index < lines.length && !/^\s*```/.test(lines[index])) {
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

    if (match[1]) {
      spans.push({ type: 'code', text: token.slice(1, -1) });
    } else if (match[2]) {
      spans.push({ type: 'math', text: latexToUnicode(match[3]) });
    } else if (match[4]) {
      spans.push({ type: 'math', text: latexToUnicode(match[5]) });
    } else if (match[6]) {
      spans.push({ type: 'bold', text: token.slice(2, -2) });
    } else if (match[7]) {
      spans.push({ type: 'strike', text: token.slice(2, -2) });
    } else if (match[8]) {
      spans.push({ type: 'italic', text: token.slice(1, -1) });
    } else if (match[10] && match[11]) {
      spans.push({ type: 'link', text: match[10], url: match[11] });
    }

    cursor = start + token.length;
  }

  if (cursor < source.length) {
    spans.push({ type: 'text', text: source.slice(cursor) });
  }

  return spans.filter(span => span.type !== 'text' || span.text.length > 0);
}

function splitRow(line: string) {
  let row = line.trim();

  if (row.startsWith('|')) {
    row = row.slice(1);
  }

  if (row.endsWith('|') && !row.endsWith('\\|')) {
    row = row.slice(0, -1);
  }

  const cells: string[] = [];
  let cell = '';

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];

    if (char === '\\' && row[index + 1] === '|') {
      cell += '|';
      index += 1;
    } else if (char === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function tableAlign(separator: string): TableAlign[] {
  return splitRow(separator).map(cell => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    return left && right ? 'center' : right ? 'right' : 'left';
  });
}

function isTableStart(lines: string[], index: number) {
  const header = lines[index];
  const separator = lines[index + 1];
  return (
    header !== undefined &&
    separator !== undefined &&
    header.includes('|') &&
    TABLE_SEPARATOR.test(separator) &&
    (separator.includes('|') || header.trim().startsWith('|'))
  );
}

function mathFence(line: string): { open: string; close: string } | null {
  const trimmed = line.trim();

  if (trimmed.startsWith('$$')) {
    return { open: '$$', close: '$$' };
  }

  if (trimmed.startsWith('\\[')) {
    return { open: '\\[', close: '\\]' };
  }

  return null;
}

function taskPrefix(text: string) {
  const task = /^\[([ xX])\]\s+(.*)$/.exec(text);

  if (!task) {
    return text;
  }

  return `${task[1] === ' ' ? '☐' : '☑'} ${task[2]}`;
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

    const math = mathFence(line);

    if (math) {
      flushParagraph();
      let body = line.trim().slice(math.open.length);
      let closed = body.includes(math.close);

      while (!closed && index + 1 < lines.length) {
        index += 1;
        body += `\n${lines[index]}`;
        closed = lines[index].includes(math.close);
      }

      const end = body.lastIndexOf(math.close);
      const value = end >= 0 ? body.slice(0, end) : body;
      blocks.push({ type: 'math', value: latexToUnicode(value) });
      continue;
    }

    if (isTableStart(lines, index)) {
      flushParagraph();
      const header = splitRow(line);
      const align = tableAlign(lines[index + 1]);
      const rows: MarkdownSpan[][][] = [];
      index += 1;

      while (index + 1 < lines.length && lines[index + 1].includes('|')) {
        const cells = splitRow(lines[index + 1]);
        rows.push(
          header.map((_, column) => parseInline(cells[column] ?? '')),
        );
        index += 1;
      }

      blocks.push({
        type: 'table',
        align: header.map((_, column) => align[column] ?? 'left'),
        header: header.map(cell => parseInline(cell)),
        rows,
      });
      continue;
    }

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

    const item = LIST_ITEM.exec(line);

    if (item && item[3].trim()) {
      flushParagraph();
      const baseIndent = item[1].length;
      const ordered = /\d/.test(item[2]);
      const items: MarkdownSpan[][] = [];
      const markers: string[] = [];
      const depths: number[] = [];
      let current: RegExpExecArray | null = item;

      while (current) {
        const depth = Math.max(
          0,
          Math.floor((current[1].length - baseIndent) / 2),
        );
        const isOrdered = /\d/.test(current[2]);
        items.push(parseInline(taskPrefix(current[3].trim())));
        markers.push(
          isOrdered
            ? `${parseInt(current[2], 10)}.`
            : depth === 0
            ? '•'
            : '◦',
        );
        depths.push(Math.min(depth, 3));

        const next = lines[index + 1];
        const nextItem = next === undefined ? null : LIST_ITEM.exec(next);

        if (
          !nextItem ||
          !nextItem[3].trim() ||
          (nextItem[1].length <= baseIndent &&
            /\d/.test(nextItem[2]) !== ordered)
        ) {
          break;
        }

        current = nextItem;
        index += 1;
      }

      blocks.push({ type: 'list', ordered, items, markers, depths });
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
