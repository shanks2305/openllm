import RNFS from 'react-native-fs';

import { dropEmptyBranch, openBranch, switchBranch } from './branches';
import { createId } from './ids';
import { titleFromMessages } from './prompt';
import type {
  Attachment,
  Branch,
  ChatMessage,
  Conversation,
  Project,
  ToolCall,
} from './types';

type Listener = () => void;

type PersistedConversations = {
  activeId: string | null;
  conversations: Conversation[];
  projects?: Project[];
};

export type ConversationState = {
  ready: boolean;
  activeId: string | null;
  conversations: Conversation[];
  projects: Project[];
  saveError: string | null;
};

const storePath = () => `${RNFS.DocumentDirectoryPath}/conversations.json`;

function emptyState(): PersistedConversations {
  return { activeId: null, conversations: [], projects: [] };
}

export class ConversationStore {
  private ready = false;
  private saveError: string | null = null;
  private hydratePromise: Promise<void> | null = null;
  private activeId: string | null = null;
  private conversations: Conversation[] = [];
  private projects: Project[] = [];
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
      projects: [...this.projects].sort((a, b) => a.createdAt - b.createdAt),
      saveError: this.saveError,
    };
  }

  getActive() {
    if (!this.activeId) {
      return null;
    }

    return this.conversations.find(chat => chat.id === this.activeId) ?? null;
  }

  getProject(id: string | undefined) {
    return id ? this.projects.find(project => project.id === id) ?? null : null;
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

  startNew(projectId?: string) {
    const active = this.getActive();
    const project = this.getProject(projectId)?.id;

    if (active && active.messages.length === 0) {
      if (active.projectId !== project) {
        active.projectId = project;
        this.commit(true);
      }

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
      ...(project ? { projectId: project } : {}),
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
    const removed = this.conversations.find(chat => chat.id === id);
    this.conversations = this.conversations.filter(chat => chat.id !== id);

    if (this.activeId === id) {
      const next = [...this.conversations]
        .filter(chat => !chat.archived)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      this.activeId = next?.id ?? null;
    }

    if (removed) {
      deleteImageFiles(removed);
    }

    this.commit(true);
  }

  setMessages(id: string, messages: ChatMessage[]) {
    const chat = this.find(id);

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

  beginBranch(id: string, index: number) {
    const chat = this.find(id);

    if (!chat) {
      return;
    }

    chat.branches = openBranch(chat.branches ?? {}, chat.messages, index);
    this.commit(true);
  }

  switchBranch(id: string, index: number, target: number) {
    const chat = this.find(id);

    if (!chat) {
      return;
    }

    const next = switchBranch(chat.branches ?? {}, chat.messages, index, target);

    if (!next) {
      return;
    }

    chat.branches = next.branches;
    chat.messages = next.messages;
    this.commit(true);
  }

  discardEmptyBranch(id: string) {
    const chat = this.find(id);

    if (!chat) {
      return;
    }

    const next = dropEmptyBranch(chat.branches ?? {}, chat.messages);

    if (!next) {
      return;
    }

    chat.branches = next.branches;
    chat.messages = next.messages;
    this.commit(true);
  }

  setGeneratedTitle(id: string, title: string) {
    const chat = this.find(id);

    if (!chat || chat.titleCustom) {
      return;
    }

    chat.title = title.slice(0, 80);
    chat.titleGenerated = true;
    this.commit(true);
  }

  rename(id: string, title: string) {
    const chat = this.find(id);

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

  setPinned(id: string, pinned: boolean) {
    const chat = this.find(id);

    if (!chat) {
      return;
    }

    chat.pinned = pinned || undefined;

    if (pinned) {
      chat.archived = undefined;
    }

    this.commit(true);
  }

  setArchived(id: string, archived: boolean) {
    const chat = this.find(id);

    if (!chat) {
      return;
    }

    chat.archived = archived || undefined;

    if (archived) {
      chat.pinned = undefined;
    }

    if (archived && this.activeId === id) {
      this.activeId = null;
    }

    this.commit(true);
  }

  moveToProject(id: string, projectId: string | null) {
    const chat = this.find(id);

    if (!chat) {
      return;
    }

    const project = this.getProject(projectId ?? undefined);
    chat.projectId = project?.id;
    this.commit(true);
  }

  createProject(name: string) {
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, 60);

    if (!trimmed) {
      return null;
    }

    const project: Project = {
      id: createId(),
      name: trimmed,
      createdAt: Date.now(),
    };
    this.projects.push(project);
    this.commit(true);
    return project;
  }

  renameProject(id: string, name: string) {
    const project = this.getProject(id);
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, 60);

    if (!project || !trimmed) {
      return;
    }

    project.name = trimmed;
    this.commit(true);
  }

  setProjectInstructions(id: string, instructions: string) {
    const project = this.getProject(id);

    if (!project) {
      return;
    }

    const trimmed = instructions.slice(0, 2000).trim();
    project.instructions = trimmed || undefined;
    this.commit(true);
  }

  removeProject(id: string) {
    this.projects = this.projects.filter(project => project.id !== id);

    for (const chat of this.conversations) {
      if (chat.projectId === id) {
        chat.projectId = undefined;
      }
    }

    this.commit(true);
  }

  setModel(id: string, modelId: string) {
    const chat = this.find(id);

    if (!chat || !modelId) {
      return;
    }

    chat.modelId = modelId;
    chat.updatedAt = Date.now();
    this.commit(true);
  }

  setInstruction(id: string, systemPrompt: string) {
    const chat = this.find(id);

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

  private find(id: string) {
    return this.conversations.find(item => item.id === id);
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
      projects: this.projects,
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
        const projects = Array.isArray(parsed?.projects)
          ? parsed.projects.filter(isProject).map(normalizeProject)
          : [];
        const projectIds = new Set(projects.map(project => project.id));
        const conversations = Array.isArray(parsed?.conversations)
          ? parsed.conversations
              .filter(isConversation)
              .map(chat => normalizeConversation(chat, projectIds))
          : [];
        const withMessages = conversations.filter(chat =>
          chat.messages.some(
            message => message.role === 'user' && message.content.trim(),
          ),
        );
        const openable = withMessages.filter(chat => !chat.archived);

        this.projects = projects;
        this.conversations = withMessages;
        this.activeId = openable.some(chat => chat.id === parsed.activeId)
          ? parsed.activeId
          : openable[0]?.id ?? null;
      } else {
        const empty = emptyState();
        this.activeId = empty.activeId;
        this.conversations = empty.conversations;
        this.projects = empty.projects ?? [];
      }
    } catch {
      this.activeId = null;
      this.conversations = [];
      this.projects = [];
    }

    this.ready = true;
    this.emit();
  }

  private emit() {
    this.listeners.forEach(listener => listener());
  }
}

function deleteImageFiles(chat: Conversation) {
  const paths = new Set<string>();
  const collect = (messages: ChatMessage[]) => {
    for (const message of messages) {
      for (const attachment of message.attachments ?? []) {
        if (attachment.kind === 'image') {
          paths.add(attachment.path);
        }
      }
    }
  };

  collect(chat.messages);
  Object.values(chat.branches ?? {}).forEach(branch =>
    branch.tails.forEach(collect),
  );

  for (const path of paths) {
    Promise.resolve()
      .then(() => RNFS.unlink(path))
      .catch(() => undefined);
  }
}

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const chat = value as Conversation;
  return typeof chat.id === 'string' && Array.isArray(chat.messages);
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const project = value as Project;
  return (
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    project.name.trim().length > 0
  );
}

function normalizeProject(project: Project): Project {
  const instructions =
    typeof project.instructions === 'string'
      ? project.instructions.slice(0, 2000).trim()
      : '';

  return {
    id: project.id,
    name: project.name.trim().slice(0, 60),
    createdAt:
      typeof project.createdAt === 'number' ? project.createdAt : Date.now(),
    ...(instructions ? { instructions } : {}),
  };
}

function normalizeConversation(
  chat: Conversation,
  projectIds: Set<string>,
): Conversation {
  const now = Date.now();

  const systemPrompt =
    typeof chat.systemPrompt === 'string'
      ? chat.systemPrompt.slice(0, 2000).trim()
      : '';
  const branches = normalizeBranches(chat.branches);

  return {
    id: chat.id,
    title:
      typeof chat.title === 'string' && chat.title.trim()
        ? chat.title
        : 'New chat',
    messages: normalizeMessages(chat.messages),
    createdAt: typeof chat.createdAt === 'number' ? chat.createdAt : now,
    updatedAt: typeof chat.updatedAt === 'number' ? chat.updatedAt : now,
    ...(typeof chat.modelId === 'string' && chat.modelId
      ? { modelId: chat.modelId }
      : {}),
    ...(systemPrompt ? { systemPrompt } : {}),
    titleCustom: chat.titleCustom === true,
    titleGenerated: chat.titleGenerated === true,
    ...(chat.pinned === true ? { pinned: true } : {}),
    ...(chat.archived === true ? { archived: true } : {}),
    ...(typeof chat.projectId === 'string' && projectIds.has(chat.projectId)
      ? { projectId: chat.projectId }
      : {}),
    ...(branches ? { branches } : {}),
  };
}

function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter(
      (message): message is ChatMessage =>
        !!message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.id === 'string' &&
        typeof message.content === 'string',
    )
    .map(normalizeMessage);
}

function normalizeBranches(value: unknown): Record<string, Branch> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const branches: Record<string, Branch> = {};

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const branch = raw as Branch | null;

    if (!branch || !Array.isArray(branch.tails)) {
      continue;
    }

    const tails = branch.tails.map(normalizeMessages);

    if (tails.length < 2) {
      continue;
    }

    const active =
      typeof branch.active === 'number' &&
      branch.active >= 0 &&
      branch.active < tails.length
        ? Math.floor(branch.active)
        : tails.length - 1;
    branches[key] = { tails, active };
  }

  return Object.keys(branches).length > 0 ? branches : null;
}

function normalizeAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): Attachment[] => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') {
      return [];
    }

    const name = typeof item.name === 'string' ? item.name : 'Attachment';

    if (item.kind === 'document' && typeof item.text === 'string') {
      return [
        {
          id: item.id,
          kind: 'document',
          name,
          text: item.text,
          ...(item.truncated === true ? { truncated: true } : {}),
        },
      ];
    }

    if (item.kind === 'image' && typeof item.path === 'string') {
      return [{ id: item.id, kind: 'image', name, path: item.path }];
    }

    return [];
  });
}

function normalizeToolCalls(value: unknown): ToolCall[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): ToolCall[] =>
    item &&
    typeof item === 'object' &&
    typeof item.name === 'string' &&
    typeof item.result === 'string'
      ? [
          {
            name: item.name,
            arguments:
              item.arguments && typeof item.arguments === 'object'
                ? item.arguments
                : {},
            result: item.result,
          },
        ]
      : [],
  );
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  const attachments = normalizeAttachments(message.attachments);
  const toolCalls = normalizeToolCalls(message.toolCalls);
  const base: ChatMessage = {
    id: message.id,
    role: message.role,
    content: message.content,
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
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
