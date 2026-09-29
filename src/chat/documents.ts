import type { ChatMessage, DocumentAttachment } from './types';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'rst', 'csv', 'tsv', 'json', 'jsonl', 'xml', 'html',
  'htm', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'env', 'tex',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'rb', 'php', 'java', 'kt',
  'kts', 'swift', 'm', 'mm', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'go', 'rs',
  'scala', 'dart', 'lua', 'r', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'css',
  'scss', 'less', 'vue', 'svelte', 'gradle', 'properties', 'srt', 'vtt',
]);

export function fileExtension(name: string) {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff', 'webp',
]);

export function isReadableDocument(name: string) {
  const ext = fileExtension(name);
  return ext === 'pdf' || TEXT_EXTENSIONS.has(ext);
}

export function isImageFile(name: string) {
  return IMAGE_EXTENSIONS.has(fileExtension(name));
}

export function normalizeDocumentText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Shares a character budget across every attached document, newest first, so
// the file the user just attached is the one that survives a small context.
export function documentAllowances(
  messages: ChatMessage[],
  budgetChars: number,
) {
  const allowances = new Map<string, number>();
  let remaining = Math.max(0, budgetChars);

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const documents = (messages[index].attachments ?? []).filter(
      (item): item is DocumentAttachment => item.kind === 'document',
    );
    const share =
      documents.length > 0 ? Math.floor(remaining / documents.length) : 0;

    for (const document of documents) {
      const allowed = Math.min(document.text.length, share);
      allowances.set(document.id, allowed);
      remaining -= allowed;
    }
  }

  return allowances;
}

export function renderDocument(document: DocumentAttachment, allowed: number) {
  if (allowed < 200 && allowed < document.text.length) {
    return `<document name="${document.name}">\n[Left out because the conversation is too long. Ask the user to attach it again if you need it.]\n</document>`;
  }

  const cut = allowed < document.text.length || document.truncated;
  const body = document.text.slice(0, allowed);
  return `<document name="${document.name}">\n${body}${
    cut ? '\n[…the rest of this file was cut to fit]' : ''
  }\n</document>`;
}

// About three characters per token, leaving room for the chat around it.
export function documentBudgetChars(contextSize: number, maxTokens: number) {
  return Math.max(0, Math.floor((contextSize - maxTokens) * 3 * 0.7));
}
