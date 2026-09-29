import { parseMarkdown } from './markdown';
import { stripReasoning } from './reasoning';
import type { ChatMessage } from './types';

export type Artifact = {
  id: string;
  messageId: string;
  language: string;
  code: string;
  title: string;
  kind: 'html' | 'svg' | 'code';
};

// Short snippets are clutter in the panel; they stay inline in the chat.
const MIN_ARTIFACT_LINES = 3;

const LANGUAGE_NAMES: Record<string, string> = {
  html: 'HTML page',
  svg: 'SVG image',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  jsx: 'JSX',
  py: 'Python',
  python: 'Python',
  css: 'CSS',
  json: 'JSON',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Shell',
  swift: 'Swift',
  md: 'Markdown',
  markdown: 'Markdown',
};

export function artifactKind(language: string, code: string): Artifact['kind'] {
  const lang = language.toLowerCase();
  const start = code.trimStart().slice(0, 200).toLowerCase();

  if (lang === 'svg' || ((lang === 'xml' || !lang) && start.startsWith('<svg'))) {
    return 'svg';
  }

  if (
    lang === 'html' ||
    lang === 'htm' ||
    (!lang && (start.startsWith('<!doctype html') || start.startsWith('<html')))
  ) {
    return 'html';
  }

  return 'code';
}

function titleFor(language: string, code: string, kind: Artifact['kind']) {
  if (kind === 'html') {
    const match = code.match(/<title[^>]*>([^<]{1,60})<\/title>/i);

    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return LANGUAGE_NAMES[language.toLowerCase()] ?? (language || 'Code');
}

export function extractArtifacts(messages: ChatMessage[]): Artifact[] {
  const artifacts: Artifact[] = [];

  for (const message of messages) {
    if (message.role !== 'assistant' || !message.content.includes('```')) {
      continue;
    }

    let index = 0;

    for (const block of parseMarkdown(stripReasoning(message.content))) {
      if (block.type !== 'code') {
        continue;
      }

      const code = block.value;
      const kind = artifactKind(block.language, code);

      if (kind === 'code' && code.split('\n').length < MIN_ARTIFACT_LINES) {
        index += 1;
        continue;
      }

      artifacts.push({
        id: `${message.id}:${index}`,
        messageId: message.id,
        language: block.language,
        code,
        kind,
        title: titleFor(block.language, code, kind),
      });
      index += 1;
    }
  }

  return artifacts;
}

export function canOpenArtifact(language: string, code: string) {
  return (
    artifactKind(language, code) !== 'code' ||
    code.split('\n').length >= MIN_ARTIFACT_LINES
  );
}

// Previews run model-written code, so the page may run its own inline script
// but cannot reach the network or load anything outside itself.
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:";

const HEAD = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width, initial-scale=1">`;

export function previewHtml(artifact: Pick<Artifact, 'kind' | 'code'>) {
  if (artifact.kind === 'svg') {
    return `<!doctype html><html><head>${HEAD}<style>html,body{margin:0;height:100%;background:#fff}body{display:flex;align-items:center;justify-content:center}svg{max-width:100%;max-height:100%;height:auto}</style></head><body>${artifact.code}</body></html>`;
  }

  const code = artifact.code;

  // The CSP must come before any content the page could use to load things.
  if (/<head[^>]*>/i.test(code)) {
    return code.replace(/<head[^>]*>/i, match => `${match}${HEAD}`);
  }

  if (/<html[^>]*>/i.test(code)) {
    return code.replace(/<html[^>]*>/i, match => `${match}<head>${HEAD}</head>`);
  }

  return `<!doctype html><html><head>${HEAD}</head><body>${code}</body></html>`;
}
