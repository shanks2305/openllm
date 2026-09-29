export type MessageStats = {
  tokensPerSecond: number | null;
  timeToFirstTokenMs: number | null;
  tokens: number;
  gpu: boolean;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  stats?: MessageStats;
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
};
