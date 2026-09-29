import { NativeEventEmitter, NativeModules } from 'react-native';

import { modelManager } from '../model/ModelManager';
import { fileExists } from '../model/modelStorage';
import type {
  ChatTurn,
  GenerateOptions,
  GenerateResult,
  LlamaEngine,
  LoadModelOptions,
} from './LlamaEngine';

type LlamaNativeModule = {
  loadModel: (
    path: string,
    contextSize: number,
    batchSize: number,
    microBatchSize: number,
  ) => Promise<{
    contextSize: number;
    batchSize: number;
    microBatchSize: number;
  }>;
  loadProjector?: (path: string) => Promise<{ vision: boolean }>;
  unloadProjector?: () => Promise<void>;
  generate: (
    prompt: string,
    options: Required<Omit<GenerateOptions, 'contextSize'>>,
  ) => Promise<GenerateResult>;
  stop: () => Promise<void>;
};

const Llama = NativeModules.Llama as LlamaNativeModule | undefined;

export class NativeLlamaEngine implements LlamaEngine {
  private loadedPath: string | null = null;
  private loadedContext = 0;
  private loadedProjector: string | null = null;
  private projectorError: string | null = null;
  private loadPromise: Promise<void> | null = null;

  async loadModel(options?: LoadModelOptions): Promise<void> {
    const path = await modelManager.getActivePath();
    const projector = await modelManager.getActiveProjectorPath();
    const contextSize = options?.contextSize ?? 4096;

    if (!path) {
      throw new Error('No model selected. Add one in Settings → Models.');
    }

    const isLoaded = () =>
      this.loadedPath === path &&
      this.loadedContext === contextSize &&
      this.loadedProjector === projector;

    if (isLoaded()) {
      return;
    }

    if (this.loadPromise) {
      await this.loadPromise;

      if (isLoaded()) {
        return;
      }
    }

    this.loadPromise = (async () => {
      if (!Llama) {
        throw new Error('Llama native module is unavailable');
      }

      if (this.loadedPath !== path || this.loadedContext !== contextSize) {
        if (!(await fileExists(path))) {
          throw new Error(`Model does not exist: ${path}`);
        }

        this.loadedPath = null;
        this.loadedContext = 0;
        this.loadedProjector = null;
        await Llama.loadModel(path, contextSize, 512, 512);
        this.loadedPath = path;
        this.loadedContext = contextSize;
      }

      await this.syncProjector(projector);
    })();

    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  // A broken projector should not stop text chat, so the failure is kept and
  // only reported when a message actually carries an image.
  private async syncProjector(projector: string | null) {
    this.projectorError = null;

    if (!Llama?.loadProjector || !Llama.unloadProjector) {
      this.loadedProjector = projector;
      this.projectorError = projector
        ? 'This build does not include image support'
        : null;
      return;
    }

    if (!projector) {
      if (this.loadedProjector) {
        await Llama.unloadProjector();
      }
      this.loadedProjector = null;
      return;
    }

    try {
      await Llama.loadProjector(projector);
    } catch (error) {
      this.projectorError =
        error instanceof Error ? error.message : 'Vision encoder failed to load';
    }

    this.loadedProjector = projector;
  }

  async generate(
    messages: ChatTurn[],
    onToken: (token: string) => void,
    options?: GenerateOptions,
  ): Promise<GenerateResult> {
    if (!Llama) {
      throw new Error('Llama native module is unavailable');
    }

    await this.loadModel({ contextSize: options?.contextSize });

    const hasImages = messages.some(message => message.images?.length);

    if (hasImages && this.projectorError) {
      throw new Error(`Can't read images: ${this.projectorError}`);
    }

    const payload = JSON.stringify(
      messages
        .filter(message => message.content.trim().length > 0)
        .map(message => ({
          role: message.role,
          content: message.content,
          ...(message.images?.length ? { images: message.images } : {}),
        })),
    );

    const emitter = new NativeEventEmitter(NativeModules.Llama);
    let streamed = '';
    const subscription = emitter.addListener(
      'LlamaToken',
      (event: { token?: string }) => {
        if (event.token) {
          streamed += event.token;
          onToken(event.token);
        }
      },
    );

    try {
      const result = await Llama.generate(payload, {
        maxTokens: options?.maxTokens ?? 256,
        temperature: options?.temperature ?? 0.7,
        topP: options?.topP ?? 0.9,
        topK: options?.topK ?? 0,
        minP: options?.minP ?? 0.05,
        repeatPenalty: options?.repeatPenalty ?? 1.1,
        seed: options?.seed ?? -1,
        stop: options?.stop ?? [],
      });

      if (streamed.length === 0 && result.text.length > 0) {
        onToken(result.text);
      }

      return result;
    } finally {
      subscription.remove();
    }
  }

  async stopGeneration(): Promise<void> {
    if (!Llama) {
      return;
    }

    await Llama.stop();
  }
}
