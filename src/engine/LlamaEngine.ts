export type ChatTurn = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type GenerateOptions = {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  contextSize?: number;
};

export type LoadModelOptions = {
  contextSize?: number;
};

export type LlamaEngine = {
  loadModel: (options?: LoadModelOptions) => Promise<void>;

  generate: (
    messages: ChatTurn[],
    onToken: (token: string) => void,
    options?: GenerateOptions,
  ) => Promise<void>;

  stopGeneration: () => Promise<void>;
};
