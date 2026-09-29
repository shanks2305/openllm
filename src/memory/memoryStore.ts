import RNFS from 'react-native-fs';

import { createId } from '../chat/ids';

export type MemoryItem = {
  id: string;
  text: string;
  createdAt: number;
};

export type MemoryState = {
  enabled: boolean;
  items: MemoryItem[];
  saveError: string | null;
};

type Listener = () => void;

export const MAX_MEMORY_ITEMS = 50;
export const MAX_MEMORY_LENGTH = 300;

const memoryPath = () => `${RNFS.DocumentDirectoryPath}/memory.json`;

function cleanText(text: string) {
  return text.trim().replace(/\s+/g, ' ').slice(0, MAX_MEMORY_LENGTH);
}

export class MemoryStore {
  private enabled = true;
  private items: MemoryItem[] = [];
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

  getState(): MemoryState {
    return {
      enabled: this.enabled,
      items: this.items,
      saveError: this.saveError,
    };
  }

  async hydrate() {
    if (this.ready) {
      return;
    }

    if (!this.hydratePromise) {
      this.hydratePromise = this.load();
    }

    try {
      await this.hydratePromise;
    } finally {
      this.hydratePromise = null;
    }
  }

  // Returns false when the fact is empty, already saved, or memory is full.
  add(text: string): boolean {
    const value = cleanText(text);

    if (!value || this.items.length >= MAX_MEMORY_ITEMS) {
      return false;
    }

    const key = value.toLowerCase();

    if (this.items.some(item => item.text.toLowerCase() === key)) {
      return false;
    }

    this.items = [
      ...this.items,
      { id: createId(), text: value, createdAt: Date.now() },
    ];
    this.persist();
    return true;
  }

  update(id: string, text: string) {
    const value = cleanText(text);

    if (!value) {
      this.remove(id);
      return;
    }

    this.items = this.items.map(item =>
      item.id === id ? { ...item, text: value } : item,
    );
    this.persist();
  }

  remove(id: string) {
    this.items = this.items.filter(item => item.id !== id);
    this.persist();
  }

  clear() {
    this.items = [];
    this.persist();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.persist();
  }

  private persist() {
    this.emit();
    const snapshot = { enabled: this.enabled, items: this.items };
    this.writeChain = this.writeChain.then(async () => {
      try {
        await RNFS.writeFile(memoryPath(), JSON.stringify(snapshot), 'utf8');

        if (this.saveError) {
          this.saveError = null;
          this.emit();
        }
      } catch {
        this.saveError = 'Could not save memory on this device.';
        this.emit();
      }
    });
  }

  private async load() {
    try {
      if (await RNFS.exists(memoryPath())) {
        const parsed = JSON.parse(await RNFS.readFile(memoryPath(), 'utf8'));
        this.enabled = parsed?.enabled !== false;
        this.items = Array.isArray(parsed?.items)
          ? parsed.items
              .filter(
                (item: MemoryItem) =>
                  item &&
                  typeof item.id === 'string' &&
                  typeof item.text === 'string' &&
                  item.text.trim(),
              )
              .slice(0, MAX_MEMORY_ITEMS)
              .map((item: MemoryItem) => ({
                id: item.id,
                text: cleanText(item.text),
                createdAt:
                  typeof item.createdAt === 'number' ? item.createdAt : 0,
              }))
          : [];
      }
    } catch {
      this.enabled = true;
      this.items = [];
    }

    this.ready = true;
    this.emit();
  }

  private emit() {
    this.listeners.forEach(listener => listener());
  }
}

export const memoryStore = new MemoryStore();
