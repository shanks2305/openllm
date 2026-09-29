import RNFS from 'react-native-fs';

import { createId } from './ids';
import { titleFromMessages } from './prompt';
import type { ChatMessage, Conversation } from './types';

type Listener = () => void;

type PersistedConversations = {
  activeId: string | null;
  conversations: Conversation[];
};

export type ConversationState = {
  ready: boolean;
  activeId: string | null;
  conversations: Conversation[];
  saveError: string | null;
};

const storePath = () => `${RNFS.DocumentDirectoryPath}/conversations.json`;

function emptyState(): PersistedConversations {
  return { activeId: null, conversations: [] };
}

export class ConversationStore {
  private ready = false;
  private saveError: string | null = null;
  private hydratePromise: Promise<void> | null = null;
  private activeId: string | null = null;
  private conversations: Conversation[] = [];
  private listeners = new Set<Listener>();
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): ConversationState {
    return {
      ready: this.ready,
      activeId: this.activeId,
      conversations: [...this.conversations].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
      saveError: this.saveError,
    };
  }

  getActive() {
    if (!this.activeId) {
      return null;
    }

    return this.conversations.find(chat => chat.id === this.activeId) ?? null;
  }

  async hydrate() {
    if (this.ready) {
      return;
    }

    if (this.hydratePromise) {
      await this.hydratePromise;
      return;
    }

    this.hydratePromise = this.load();

    try {
      await this.hydratePromise;
    } finally {
      this.hydratePromise = null;
    }
  }

  startNew() {
    const active = this.getActive();

    if (active && active.messages.length === 0) {
      return active;
    }

    const now = Date.now();
    const chat: Conversation = {
      id: createId(),
      title: 'New chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
      titleCustom: false,
    };

    this.conversations.push(chat);
    this.activeId = chat.id;
    this.commit(true);
    return chat;
  }

  open(id: string) {
    if (!this.conversations.some(chat => chat.id === id)) {
      return;
    }

    this.activeId = id;
    this.commit(true);
  }

  remove(id: string) {
    this.conversations = this.conversations.filter(chat => chat.id !== id);

    if (this.activeId === id) {
      const next = [...this.conversations].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      )[0];
      this.activeId = next?.id ?? null;
    }

    this.commit(true);
  }

  setMessages(id: string, messages: ChatMessage[]) {
    const chat = this.conversations.find(item => item.id === id);

    if (!chat) {
      return;
    }

    chat.messages = messages;

    if (!chat.titleCustom && !chat.titleGenerated) {
      chat.title = titleFromMessages(messages);
    }

    chat.updatedAt = Date.now();
    this.commit(false);
  }

  setGeneratedTitle(id: string, title: string) {
    const chat = this.conversations.find(item => item.id === id);

    if (!chat || chat.titleCustom) {
      return;
    }

    chat.title = title.slice(0, 80);
    chat.titleGenerated = true;
    this.commit(true);
  }

  rename(id: string, title: string) {
    const chat = this.conversations.find(item => item.id === id);

    if (!chat) {
      return;
    }

    const trimmed = title.trim().replace(/\s+/g, ' ');

    if (!trimmed) {
      chat.titleCustom = false;
      chat.titleGenerated = false;
      chat.title = titleFromMessages(chat.messages);
    } else {
      chat.titleCustom = true;
      chat.title = trimmed.slice(0, 80);
    }

    chat.updatedAt = Date.now();
    this.commit(true);
  }

  setModel(id: string, modelId: string) {
    const chat = this.conversations.find(item => item.id === id);

    if (!chat || !modelId) {
      return;
    }

    chat.modelId = modelId;
    chat.updatedAt = Date.now();
    this.commit(true);
  }

  setInstruction(id: string, systemPrompt: string) {
    const chat = this.conversations.find(item => item.id === id);

    if (!chat) {
      return;
    }

    const trimmed = systemPrompt.slice(0, 2000).trim();
    chat.systemPrompt = trimmed || undefined;
    chat.updatedAt = Date.now();
    this.commit(true);
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    await this.enqueueWrite();
  }

  private commit(immediate: boolean) {
    this.dirty = true;
    this.emit();

    if (immediate) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }

      this.enqueueWrite().catch(() => undefined);
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.enqueueWrite().catch(() => undefined);
    }, 400);
  }

  private enqueueWrite() {
    this.writeChain = this.writeChain.then(() => this.writeIfDirty());
    return this.writeChain;
  }

  private async writeIfDirty() {
    if (!this.dirty) {
      return;
    }

    this.dirty = false;
    const payload: PersistedConversations = {
      activeId: this.activeId,
      conversations: this.conversations,
    };

    try {
      await RNFS.writeFile(storePath(), JSON.stringify(payload), 'utf8');

      if (this.saveError) {
        this.saveError = null;
        this.emit();
      }
    } catch {
      this.dirty = true;
      this.saveError = 'Could not save this chat on the device.';
      this.emit();
    }
  }

  private async load() {
    try {
      if (await RNFS.exists(storePath())) {
        const raw = await RNFS.readFile(storePath(), 'utf8');
        const parsed = JSON.parse(raw) as PersistedConversations;
        const conversations = Array.isArray(parsed?.conversations)
          ? parsed.conversations
              .filter(isConversation)
              .map(normalizeConversation)
          : [];
        const withMessages = conversations.filter(chat =>
          chat.messages.some(
            message => message.role === 'user' && message.content.trim(),
          ),
        );

        this.conversations = withMessages;
        this.activeId = withMessages.some(chat => chat.id === parsed.activeId)
          ? parsed.activeId
          : withMessages[0]?.id ?? null;
      } else {
        const empty = emptyState();
        this.activeId = empty.activeId;
        this.conversations = empty.conversations;
      }
    } catch {
      this.activeId = null;
      this.conversations = [];
    }

    this.ready = true;
    this.emit();
  }

  private emit() {
    this.listeners.forEach(listener => listener());
  }
}

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const chat = value as Conversation;
  return typeof chat.id === 'string' && Array.isArray(chat.messages);
}

function normalizeConversation(chat: Conversation): Conversation {
  const now = Date.now();

  const systemPrompt =
    typeof chat.systemPrompt === 'string'
      ? chat.systemPrompt.slice(0, 2000).trim()
      : '';

  return {
    id: chat.id,
    title:
      typeof chat.title === 'string' && chat.title.trim()
        ? chat.title
        : 'New chat',
    messages: chat.messages
      .filter(
        message =>
          !!message &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.id === 'string' &&
          typeof message.content === 'string',
      )
      .map(normalizeMessage),
    createdAt: typeof chat.createdAt === 'number' ? chat.createdAt : now,
    updatedAt: typeof chat.updatedAt === 'number' ? chat.updatedAt : now,
    ...(typeof chat.modelId === 'string' && chat.modelId
      ? { modelId: chat.modelId }
      : {}),
    ...(systemPrompt ? { systemPrompt } : {}),
    titleCustom: chat.titleCustom === true,
    titleGenerated: chat.titleGenerated === true,
  };
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  const base: ChatMessage = {
    id: message.id,
    role: message.role,
    content: message.content,
  };
  const stats = message.stats;

  if (
    message.role !== 'assistant' ||
    !stats ||
    typeof stats !== 'object' ||
    typeof stats.tokens !== 'number'
  ) {
    return base;
  }

  return {
    ...base,
    stats: {
      tokens: stats.tokens,
      gpu: stats.gpu === true,
      tokensPerSecond:
        typeof stats.tokensPerSecond === 'number' ? stats.tokensPerSecond : null,
      timeToFirstTokenMs:
        typeof stats.timeToFirstTokenMs === 'number'
          ? stats.timeToFirstTokenMs
          : null,
    },
  };
}

export const conversationStore = new ConversationStore();
