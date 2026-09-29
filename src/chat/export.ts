import type { Conversation } from './types';

export function conversationToMarkdown(
  chat: Pick<Conversation, 'title' | 'messages' | 'systemPrompt'>,
  modelName?: string,
) {
  const lines = [`# ${chat.title}`];

  if (modelName) {
    lines.push('', `_Model: ${modelName}_`);
  }

  if (chat.systemPrompt?.trim()) {
    lines.push('', `> Instructions: ${chat.systemPrompt.trim()}`);
  }

  for (const message of chat.messages) {
    const content = message.content.trim();

    if (!content) {
      continue;
    }

    lines.push(
      '',
      message.role === 'user' ? '**You**' : '**Assistant**',
      '',
      content,
    );
  }

  return `${lines.join('\n')}\n`;
}
