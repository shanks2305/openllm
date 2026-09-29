import RNFS from 'react-native-fs';

export type AppSettings = {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
};

type Listener = () => void;

export const MAX_TOKEN_OPTIONS = [128, 256, 512, 1024] as const;

const DEFAULT_SETTINGS: AppSettings = {
  temperature: 0.7,
  maxTokens: 256,
  systemPrompt: '',
};

const settingsPath = () => `${RNFS.DocumentDirectoryPath}/settings.json`;

function clampTemperature(value: number) {
  const next = Math.round(Math.min(1.5, Math.max(0, value)) * 10) / 10;
  return Number.isFinite(next) ? next : DEFAULT_SETTINGS.temperature;
}

function normalizeMaxTokens(value: number) {
  return MAX_TOKEN_OPTIONS.includes(value as (typeof MAX_TOKEN_OPTIONS)[number])
    ? value
    : DEFAULT_SETTINGS.maxTokens;
}

class SettingsStore {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
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
    this.settings = {
      ...this.settings,
      maxTokens: normalizeMaxTokens(value),
    };
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
        await RNFS.writeFile(
          settingsPath(),
          JSON.stringify(snapshot),
          'utf8',
        );
      } catch {
        // Keep the in-memory settings if the write fails.
      }
    });
  }

  private async load() {
    try {
      if (await RNFS.exists(settingsPath())) {
        const raw = await RNFS.readFile(settingsPath(), 'utf8');
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        this.settings = {
          temperature: clampTemperature(
            typeof parsed.temperature === 'number'
              ? parsed.temperature
              : DEFAULT_SETTINGS.temperature,
          ),
          maxTokens: normalizeMaxTokens(
            typeof parsed.maxTokens === 'number'
              ? parsed.maxTokens
              : DEFAULT_SETTINGS.maxTokens,
          ),
          systemPrompt:
            typeof parsed.systemPrompt === 'string'
              ? parsed.systemPrompt.slice(0, 2000)
              : '',
        };
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }

    this.ready = true;
    this.listeners.forEach(listener => listener());
  }
}

export const settingsStore = new SettingsStore();
