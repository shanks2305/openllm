export type SearchableChat = {
  title: string;
  messages: { content: string }[];
};

export type ChatMatch = {
  snippet: string | null;
};

const SNIPPET_RADIUS = 36;

export function matchChat(
  chat: SearchableChat,
  query: string,
): ChatMatch | null {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return { snippet: null };
  }

  if (chat.title.toLowerCase().includes(needle)) {
    return { snippet: null };
  }

  for (const message of chat.messages) {
    const text = message.content.replace(/\s+/g, ' ');
    const at = text.toLowerCase().indexOf(needle);

    if (at >= 0) {
      return { snippet: snippetAround(text, at, needle.length) };
    }
  }

  return null;
}

function snippetAround(text: string, at: number, length: number) {
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + length + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
