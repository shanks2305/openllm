import RNFS from 'react-native-fs';

export type AppSettings = {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  contextSize: number;
  topP: number;
  topK: number;
  minP: number;
  repeatPenalty: number;
  seed: number;
  stopSequences: string[];
  tools: boolean;
  thinking: boolean;
};

type Listener = () => void;

export const MAX_TOKEN_OPTIONS = [128, 256, 512, 1024, 2048] as const;
export const CONTEXT_SIZE_OPTIONS = [2048, 4096, 8192, 16384, 32768] as const;
export const TOP_K_OPTIONS = [0, 20, 40, 80] as const;
export const LARGE_CONTEXT = 8192;
export const RANDOM_SEED = -1;

const MAX_STOP_SEQUENCES = 8;
const MAX_STOP_LENGTH = 40;

const DEFAULT_SETTINGS: AppSettings = {
  temperature: 0.7,
  maxTokens: 256,
  systemPrompt: '',
  contextSize: 4096,
  topP: 0.9,
  topK: 0,
  minP: 0.05,
  repeatPenalty: 1.1,
  seed: RANDOM_SEED,
  stopSequences: [],
  tools: false,
  thinking: true,
};

export function maxTokensForContext(contextSize: number): number[] {
  const cap = Math.floor(contextSize / 2);
  const allowed = MAX_TOKEN_OPTIONS.filter(option => option <= cap);
  return allowed.length > 0 ? [...allowed] : [MAX_TOKEN_OPTIONS[0]];
}

export function contextOptionsForModel(contextTrain?: number): number[] {
  if (!contextTrain) {
    return CONTEXT_SIZE_OPTIONS.filter(option => option <= LARGE_CONTEXT);
  }

  const allowed = CONTEXT_SIZE_OPTIONS.filter(option => option <= contextTrain);
  return allowed.length > 0 ? allowed : [CONTEXT_SIZE_OPTIONS[0]];
}

export function effectiveContextSize(
  contextSize: number,
  contextTrain?: number,
) {
  const options = contextOptionsForModel(contextTrain);
  const fitting = options.filter(option => option <= contextSize);
  return fitting.length > 0 ? fitting[fitting.length - 1] : options[0];
}

export function parseStopSequences(text: string): string[] {
  const seen = new Set<string>();

  for (const line of text.split('\n')) {
    const value = line.replace(/\\n/g, '\n').slice(0, MAX_STOP_LENGTH);

    if (line.trim() && seen.size < MAX_STOP_SEQUENCES) {
      seen.add(value);
    }
  }

  return [...seen];
}

export function formatStopSequences(stops: string[]) {
  return stops.map(stop => stop.replace(/\n/g, '\\n')).join('\n');
}

const settingsPath = () => `${RNFS.DocumentDirectoryPath}/settings.json`;

function clampTemperature(value: number) {
  const next = Math.round(Math.min(1.5, Math.max(0, value)) * 10) / 10;
  return Number.isFinite(next) ? next : DEFAULT_SETTINGS.temperature;
}

function normalizeMaxTokens(value: number, contextSize: number) {
  const allowed = maxTokensForContext(contextSize);
  return allowed.includes(value) ? value : allowed[allowed.length - 1];
}

function normalizeContext(value: number) {
  return CONTEXT_SIZE_OPTIONS.includes(
    value as (typeof CONTEXT_SIZE_OPTIONS)[number],
  )
    ? value
    : DEFAULT_SETTINGS.contextSize;
}

function clampTopP(value: number) {
  const next = Math.round(Math.min(1, Math.max(0.05, value)) * 20) / 20;
  return Number.isFinite(next) ? next : DEFAULT_SETTINGS.topP;
}

function clampRepeatPenalty(value: number) {
  const next = Math.round(Math.min(1.5, Math.max(1, value)) * 10) / 10;
  return Number.isFinite(next) ? next : DEFAULT_SETTINGS.repeatPenalty;
}

function normalizeTopK(value: number) {
  return TOP_K_OPTIONS.includes(value as (typeof TOP_K_OPTIONS)[number])
    ? value
    : DEFAULT_SETTINGS.topK;
}

function clampMinP(value: number) {
  const next = Math.round(Math.min(0.5, Math.max(0, value)) * 20) / 20;
  return Number.isFinite(next) ? next : DEFAULT_SETTINGS.minP;
}

function normalizeSeed(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return RANDOM_SEED;
  }

  return Math.min(Math.floor(value), 2_147_483_647);
}

function normalizeStops(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_SETTINGS.stopSequences;
  }

  return parseStopSequences(
    formatStopSequences(value.filter(item => typeof item === 'string')),
  );
}

function normalizeSettings(value: Partial<AppSettings>): AppSettings {
  const contextSize = normalizeContext(
    typeof value.contextSize === 'number'
      ? value.contextSize
      : DEFAULT_SETTINGS.contextSize,
  );

  return {
    temperature: clampTemperature(
      typeof value.temperature === 'number'
        ? value.temperature
        : DEFAULT_SETTINGS.temperature,
    ),
    maxTokens: normalizeMaxTokens(
      typeof value.maxTokens === 'number'
        ? value.maxTokens
        : DEFAULT_SETTINGS.maxTokens,
      contextSize,
    ),
    systemPrompt:
      typeof value.systemPrompt === 'string'
        ? value.systemPrompt.slice(0, 2000)
        : '',
    contextSize,
    topP: clampTopP(
      typeof value.topP === 'number' ? value.topP : DEFAULT_SETTINGS.topP,
    ),
    repeatPenalty: clampRepeatPenalty(
      typeof value.repeatPenalty === 'number'
        ? value.repeatPenalty
        : DEFAULT_SETTINGS.repeatPenalty,
    ),
    topK: normalizeTopK(
      typeof value.topK === 'number' ? value.topK : DEFAULT_SETTINGS.topK,
    ),
    minP: clampMinP(
      typeof value.minP === 'number' ? value.minP : DEFAULT_SETTINGS.minP,
    ),
    seed: normalizeSeed(
      typeof value.seed === 'number' ? value.seed : DEFAULT_SETTINGS.seed,
    ),
    stopSequences: normalizeStops(value.stopSequences),
    tools: value.tools === true,
    thinking: value.thinking !== false,
  };
}

class SettingsStore {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private saveError: string | null = null;
  private ready = false;
  private hydratePromise: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private writeChain: Promise<void> = Promise.resolve();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): AppSettings {
    return this.settings;
  }

  getSaveError() {
    return this.saveError;
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

  setTemperature = (value: number) => {
    this.settings = {
      ...this.settings,
      temperature: clampTemperature(value),
    };
    this.persist();
  };

  setMaxTokens = (value: number) => {
    const allowed = maxTokensForContext(this.settings.contextSize);

    if (!allowed.includes(value)) {
      return;
    }

    this.settings = {
      ...this.settings,
      maxTokens: value,
    };
    this.persist();
  };

  setContextSize = (value: number) => {
    const contextSize = normalizeContext(value);
    this.settings = normalizeSettings({
      ...this.settings,
      contextSize,
    });
    this.persist();
  };

  setTopP = (value: number) => {
    this.settings = {
      ...this.settings,
      topP: clampTopP(value),
    };
    this.persist();
  };

  setRepeatPenalty = (value: number) => {
    this.settings = {
      ...this.settings,
      repeatPenalty: clampRepeatPenalty(value),
    };
    this.persist();
  };

  setTopK = (value: number) => {
    this.settings = { ...this.settings, topK: normalizeTopK(value) };
    this.persist();
  };

  setMinP = (value: number) => {
    this.settings = { ...this.settings, minP: clampMinP(value) };
    this.persist();
  };

  setSeed = (value: number) => {
    this.settings = { ...this.settings, seed: normalizeSeed(value) };
    this.persist();
  };

  setStopSequences = (text: string) => {
    this.settings = {
      ...this.settings,
      stopSequences: parseStopSequences(text),
    };
    this.persist();
  };

  setTools = (value: boolean) => {
    this.settings = { ...this.settings, tools: value };
    this.persist();
  };

  setThinking = (value: boolean) => {
    this.settings = { ...this.settings, thinking: value };
    this.persist();
  };

  setSystemPrompt = (value: string) => {
    this.settings = {
      ...this.settings,
      systemPrompt: value.slice(0, 2000),
    };
    this.persist();
  };

  private persist() {
    this.listeners.forEach(listener => listener());
    const snapshot = this.settings;
    this.writeChain = this.writeChain.then(async () => {
      try {
        await RNFS.writeFile(settingsPath(), JSON.stringify(snapshot), 'utf8');

        if (this.saveError) {
          this.saveError = null;
          this.listeners.forEach(listener => listener());
        }
      } catch {
        this.saveError = 'Could not save settings on this device.';
        this.listeners.forEach(listener => listener());
      }
    });
  }

  private async load() {
    try {
      if (await RNFS.exists(settingsPath())) {
        const raw = await RNFS.readFile(settingsPath(), 'utf8');
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        this.settings = normalizeSettings(parsed);
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }

    this.ready = true;
    this.listeners.forEach(listener => listener());
  }
}

export const settingsStore = new SettingsStore();
