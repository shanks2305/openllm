export type ChatTurn = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type GenerateOptions = {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  repeatPenalty?: number;
  seed?: number;
  stop?: string[];
  contextSize?: number;
};

export type GenerateResult = {
  text: string;
  promptTokens: number;
  reusedTokens: number;
  generatedTokens: number;
  droppedTurns: number;
  gpu: boolean;
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
  ) => Promise<GenerateResult | null>;

  stopGeneration: () => Promise<void>;
};
