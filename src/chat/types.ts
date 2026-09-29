export type MessageStats = {
  tokensPerSecond: number | null;
  timeToFirstTokenMs: number | null;
  tokens: number;
  gpu: boolean;
};

export type DocumentAttachment = {
  id: string;
  kind: 'document';
  name: string;
  text: string;
  truncated?: boolean;
};

export type ImageAttachment = {
  id: string;
  kind: 'image';
  name: string;
  path: string;
};

export type Attachment = DocumentAttachment | ImageAttachment;

export type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  stats?: MessageStats;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
};

// Every version of the conversation that followed one message. The active
// version is live in `Conversation.messages`, so its stored copy may be stale.
export type Branch = {
  tails: ChatMessage[][];
  active: number;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  modelId?: string;
  systemPrompt?: string;
  titleCustom?: boolean;
  titleGenerated?: boolean;
  pinned?: boolean;
  archived?: boolean;
  projectId?: string;
  branches?: Record<string, Branch>;
};

export type Project = {
  id: string;
  name: string;
  instructions?: string;
  createdAt: number;
};
