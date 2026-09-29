import RNFS from 'react-native-fs';

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
};

const storePath = () => `${RNFS.DocumentDirectoryPath}/conversations.json`;

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState(): PersistedConversations {
  return { activeId: null, conversations: [] };
}

class ConversationStore {
  private ready = false;
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
    chat.title = titleFromMessages(messages);
    chat.updatedAt = Date.now();
    this.commit(false);
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
    } catch {
      this.dirty = true;
    }
  }

  private async load() {
    try {
      if (await RNFS.exists(storePath())) {
        const raw = await RNFS.readFile(storePath(), 'utf8');
        const parsed = JSON.parse(raw) as PersistedConversations;
        const conversations = Array.isArray(parsed?.conversations)
          ? parsed.conversations.filter(isConversation).map(normalizeConversation)
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

  return {
    id: chat.id,
    title: typeof chat.title === 'string' ? chat.title : 'New chat',
    messages: chat.messages.filter(
      message =>
        !!message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.id === 'string' &&
        typeof message.content === 'string',
    ),
    createdAt: typeof chat.createdAt === 'number' ? chat.createdAt : now,
    updatedAt: typeof chat.updatedAt === 'number' ? chat.updatedAt : now,
  };
}

export const conversationStore = new ConversationStore();
