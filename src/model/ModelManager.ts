import RNFS from 'react-native-fs';

import { getCatalogModel, MODEL_CATALOG } from './catalog';
import {
  appendFile,
  assertGgufFile,
  copyFile,
  ensureModelsDir,
  fileExists,
  filenameFromUrl,
  getFreeBytes,
  legacyModelPath,
  modelFilePath,
  modelsDir,
  moveFile,
  partialMetaPath,
  partialModelPath,
  partialRestPath,
  readFileSize,
  readManifest,
  readTrainedContext,
  removeFileIfExists,
  sanitizeModelId,
  toFsPath,
  writeManifest,
} from './modelStorage';
import type {
  CatalogModel,
  DownloadProgress,
  InstalledModel,
  InterruptedDownload,
  Manifest,
  ModelSource,
} from './types';

export type ModelManagerState = {
  ready: boolean;
  catalog: CatalogModel[];
  installed: InstalledModel[];
  selectedId: string | null;
  selectedModel: InstalledModel | null;
  downloads: Record<string, DownloadProgress>;
  interrupted: InterruptedDownload[];
  importing: boolean;
};

type Listener = () => void;

class ModelManager {
  private ready = false;
  private hydratePromise: Promise<void> | null = null;
  private manifest: Manifest = { selectedId: null, installed: {} };
  private downloads: Record<string, DownloadProgress> = {};
  private interrupted: InterruptedDownload[] = [];
  private downloadJobs = new Map<string, number>();
  private downloadPolls = new Map<string, ReturnType<typeof setInterval>>();
  private cancelled = new Set<string>();
  private importing = false;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): ModelManagerState {
    return {
      ready: this.ready,
      catalog: MODEL_CATALOG,
      installed: Object.values(this.manifest.installed).sort(
        (a, b) => b.downloadedAt - a.downloadedAt,
      ),
      selectedId: this.manifest.selectedId,
      selectedModel: this.getSelectedModel(),
      downloads: this.downloads,
      interrupted: this.interrupted.filter(item => !this.downloads[item.id]),
      importing: this.importing,
    };
  }

  getSelectedModel() {
    const id = this.manifest.selectedId;
    return id ? this.manifest.installed[id] ?? null : null;
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

  async getActivePath() {
    await this.hydrate();
    const selected = this.getSelectedModel();

    if (!selected) {
      return null;
    }

    if (!(await fileExists(selected.path))) {
      await this.dropMissing(selected.id);
      return null;
    }

    return selected.path;
  }

  async downloadCatalog(id: string) {
    const model = getCatalogModel(id);

    if (!model) {
      throw new Error('Unknown recommended model');
    }

    await this.download({
      id: model.id,
      name: model.name,
      url: model.url,
      source: 'catalog',
      origin: model.id,
      expectedBytes: model.sizeBytes,
    });
  }

  async downloadFromUrl(rawUrl: string) {
    const url = rawUrl.trim();
    this.assertHttpsGgufUrl(url);

    const filename = filenameFromUrl(url);
    const id = this.uniqueId(sanitizeModelId(filename || `url-${Date.now()}`));

    await this.download({
      id,
      name: filename.replace(/\.gguf$/i, '') || id,
      url,
      source: 'url',
      origin: url,
    });
  }

  async importFromLocalPath(uri: string, fileName: string) {
    await this.hydrate();
    await ensureModelsDir();

    const sourcePath = toFsPath(uri);
    const baseName = fileName || sourcePath.split('/').pop() || 'imported.gguf';

    if (!baseName.toLowerCase().endsWith('.gguf')) {
      throw new Error('Please choose a .gguf model file');
    }

    this.importing = true;
    this.emit();

    const id = this.uniqueId(sanitizeModelId(baseName));
    const dest = modelFilePath(id);
    const part = `${dest}.part`;

    try {
      const size = await readFileSize(sourcePath);
      await this.assertDiskSpace(size);
      await copyFile(sourcePath, part);
      await assertGgufFile(part);
      await moveFile(part, dest);
      await this.register({
        id,
        name: baseName.replace(/\.gguf$/i, ''),
        path: dest,
        bytes: await readFileSize(dest),
        source: 'import',
        origin: baseName,
        downloadedAt: Date.now(),
      });

      if (sourcePath !== dest) {
        await removeFileIfExists(sourcePath);
      }
    } catch (error) {
      await removeFileIfExists(part);
      await removeFileIfExists(dest);
      throw error;
    } finally {
      this.importing = false;
      this.emit();
    }
  }

  async select(id: string) {
    await this.hydrate();

    if (!this.manifest.installed[id]) {
      throw new Error('Model is not installed');
    }

    this.manifest.selectedId = id;
    await writeManifest(this.manifest);
    this.emit();
  }

  async remove(id: string) {
    await this.hydrate();

    this.cancelDownload(id);

    const installed = this.manifest.installed[id];

    if (installed) {
      await removeFileIfExists(installed.path);
      delete this.manifest.installed[id];
    }

    if (this.manifest.selectedId === id) {
      const next = Object.keys(this.manifest.installed)[0] ?? null;
      this.manifest.selectedId = next;
    }

    await writeManifest(this.manifest);
    this.emit();
  }

  cancelDownload(id: string) {
    this.cancelled.add(id);
    const jobId = this.downloadJobs.get(id);

    if (jobId != null) {
      RNFS.stopDownload(jobId);
    }

    this.downloadJobs.delete(id);
    delete this.downloads[id];
    this.stopPoll(id);
    this.removePartial(id)
      .finally(() => {
        this.interrupted = this.interrupted.filter(item => item.id !== id);
        this.emit();
      })
      .catch(() => undefined);
    this.emit();
  }

  async resume(id: string) {
    await this.hydrate();
    const item = this.interrupted.find(entry => entry.id === id);

    if (!item) {
      throw new Error('That download is no longer on this device');
    }

    await this.download({
      id: item.id,
      name: item.name,
      url: item.url,
      source: item.source,
      origin: item.origin,
      expectedBytes: item.expectedBytes || undefined,
    });
  }

  async discardPartial(id: string) {
    this.cancelDownload(id);
    await this.removePartial(id);
    this.interrupted = this.interrupted.filter(item => item.id !== id);
    this.emit();
  }

  private async load() {
    await ensureModelsDir();
    this.manifest = await readManifest();
    await this.reconcileFiles();
    await this.migrateLegacyModel();
    await this.discoverInterrupted();
    this.ready = true;
    this.emit();
    this.backfillMetadata().catch(() => undefined);
  }

  private async backfillMetadata() {
    let changed = false;

    for (const model of Object.values(this.manifest.installed)) {
      if (model.contextTrain) {
        continue;
      }

      const contextTrain = await readTrainedContext(model.path);

      if (contextTrain && this.manifest.installed[model.id]) {
        this.manifest.installed[model.id] = { ...model, contextTrain };
        changed = true;
      }
    }

    if (changed) {
      await writeManifest(this.manifest);
      this.emit();
    }
  }

  private async reconcileFiles() {
    let changed = false;

    for (const [id, model] of Object.entries(this.manifest.installed)) {
      if (!(await fileExists(model.path))) {
        delete this.manifest.installed[id];
        changed = true;
      }
    }

    if (
      this.manifest.selectedId &&
      !this.manifest.installed[this.manifest.selectedId]
    ) {
      this.manifest.selectedId =
        Object.keys(this.manifest.installed)[0] ?? null;
      changed = true;
    }

    if (changed) {
      await writeManifest(this.manifest);
    }
  }

  private async migrateLegacyModel() {
    const legacy = legacyModelPath();

    if (!(await fileExists(legacy))) {
      return;
    }

    const alreadyImported = Object.values(this.manifest.installed).some(
      model => model.origin === 'model.gguf' || model.id === 'legacy-model',
    );

    if (alreadyImported) {
      return;
    }

    const id = this.uniqueId('legacy-model');
    const dest = modelFilePath(id);

    try {
      await assertGgufFile(legacy);
      await moveFile(legacy, dest);
      await this.register({
        id,
        name: 'Imported model',
        path: dest,
        bytes: await readFileSize(dest),
        source: 'import',
        origin: 'model.gguf',
        downloadedAt: Date.now(),
      });
    } catch {
      // Leave the legacy file in place if it is not a valid GGUF.
    }
  }

  private async download(options: {
    id: string;
    name: string;
    url: string;
    source: ModelSource;
    origin: string;
    expectedBytes?: number;
  }) {
    await this.hydrate();
    await ensureModelsDir();

    if (this.manifest.installed[options.id]) {
      await this.select(options.id);
      return;
    }

    if (this.downloads[options.id]) {
      return;
    }

    const dest = modelFilePath(options.id);
    const part = partialModelPath(options.id);
    const rest = partialRestPath(options.id);
    let offset = 0;

    if (await fileExists(part)) {
      offset = await readFileSize(part);
    }

    const remaining =
      options.expectedBytes && offset > 0
        ? Math.max(0, options.expectedBytes - offset)
        : options.expectedBytes;

    if (remaining) {
      await this.assertDiskSpace(remaining);
    }

    if (offset === 0) {
      await removeFileIfExists(part);
    }

    await removeFileIfExists(rest);
    await RNFS.writeFile(
      partialMetaPath(options.id),
      JSON.stringify({
        id: options.id,
        name: options.name,
        url: options.url,
        source: options.source,
        origin: options.origin,
        expectedBytes: options.expectedBytes ?? 0,
      }),
      'utf8',
    );
    this.interrupted = this.interrupted.filter(item => item.id !== options.id);
    this.cancelled.delete(options.id);

    this.downloads[options.id] = {
      bytesWritten: offset,
      contentLength: options.expectedBytes ?? 0,
    };
    this.emit();

    const headers: Record<string, string> = {
      Accept: '*/*',
      'User-Agent': 'freeGPT/1.0',
    };
    let expectedTotal = options.expectedBytes ?? 0;

    if (offset > 0) {
      headers.Range = `bytes=${offset}-`;
      this.pollPartial(options.id, offset, rest, expectedTotal);
    }

    const { promise, jobId } = RNFS.downloadFile({
      fromUrl: options.url,
      toFile: offset > 0 ? rest : part,
      background: true,
      progressDivider: 4,
      headers,
      begin: res => {
        const incoming = res.contentLength || 0;

        if (!expectedTotal && incoming > 0) {
          expectedTotal = offset > 0 ? offset + incoming : incoming;
        }

        this.downloads[options.id] = {
          bytesWritten: offset,
          contentLength: expectedTotal || incoming,
        };
        this.emit();
      },
      progress: res => {
        this.downloads[options.id] = {
          bytesWritten: offset + res.bytesWritten,
          contentLength:
            options.expectedBytes ||
            (offset > 0 ? offset + res.contentLength : res.contentLength),
        };
        this.emit();
      },
    });

    this.downloadJobs.set(options.id, jobId);
    let moved = false;

    try {
      const result = await promise;
      const status = result.statusCode ?? 0;

      if (this.cancelled.has(options.id)) {
        return;
      }

      if (status === 416 && offset > 0) {
        // The partial file already covers the remote resource.
      } else if (status >= 400) {
        throw new Error(`Download failed (${status})`);
      } else if (offset > 0 && status === 206) {
        await appendFile(rest, part);
        await removeFileIfExists(rest);
      } else if (offset > 0 && status === 200) {
        await moveFile(rest, part);
      } else if (offset > 0) {
        throw new Error(`Download failed (${status})`);
      }

      const finalSize = await readFileSize(part);

      if (expectedTotal > 0 && finalSize + 4096 < expectedTotal) {
        throw new Error('Download stopped before the file finished');
      }

      try {
        await assertGgufFile(part);
      } catch (error) {
        await this.removePartial(options.id);
        throw new Error(
          error instanceof Error
            ? `${error.message} Start the download again.`
            : 'That download was not a valid GGUF model. Start it again.',
        );
      }

      await moveFile(part, dest);
      moved = true;
      await removeFileIfExists(partialMetaPath(options.id));
      await this.register({
        id: options.id,
        name: options.name,
        path: dest,
        bytes: await readFileSize(dest),
        source: options.source,
        origin: options.origin,
        downloadedAt: Date.now(),
      });
      this.interrupted = this.interrupted.filter(
        item => item.id !== options.id,
      );
    } catch (error) {
      if (moved) {
        await removeFileIfExists(dest);
      }

      await removeFileIfExists(rest);

      if (this.cancelled.has(options.id) || this.isCancelError(error)) {
        await this.removePartial(options.id);
        return;
      }

      if (await fileExists(part)) {
        const bytesWritten = await readFileSize(part);
        this.rememberInterrupted(options, bytesWritten);
      }

      const reason = error instanceof Error ? error.message : 'Download failed';
      const resumable = await fileExists(part);
      throw new Error(
        resumable ? `${reason} You can resume it from Models.` : reason,
      );
    } finally {
      this.cancelled.delete(options.id);
      this.downloadJobs.delete(options.id);
      delete this.downloads[options.id];
      this.stopPoll(options.id);
      this.emit();
    }
  }

  private async discoverInterrupted() {
    try {
      if (typeof RNFS.readDir !== 'function') {
        return;
      }

      const entries = await RNFS.readDir(modelsDir());
      const found: InterruptedDownload[] = [];

      for (const entry of entries) {
        if (!entry.name.endsWith('.gguf.part.json')) {
          continue;
        }

        try {
          const raw = await RNFS.readFile(entry.path, 'utf8');
          const parsed = JSON.parse(raw) as {
            id?: string;
            name?: string;
            url?: string;
            source?: ModelSource;
            origin?: string;
            expectedBytes?: number;
          };

          if (!parsed.id || !parsed.url || !parsed.name) {
            continue;
          }

          if (this.manifest.installed[parsed.id]) {
            await this.removePartial(parsed.id);
            continue;
          }

          const part = partialModelPath(parsed.id);

          if (!(await fileExists(part))) {
            await removeFileIfExists(entry.path);
            continue;
          }

          found.push({
            id: parsed.id,
            name: parsed.name,
            url: parsed.url,
            source: parsed.source ?? 'url',
            origin: parsed.origin ?? parsed.url,
            expectedBytes: parsed.expectedBytes ?? 0,
            bytesWritten: await readFileSize(part),
          });
        } catch {
          // Skip a metadata file that cannot be read.
        }
      }

      this.interrupted = found;
    } catch {
      this.interrupted = [];
    }
  }

  private rememberInterrupted(
    options: {
      id: string;
      name: string;
      url: string;
      source: ModelSource;
      origin: string;
      expectedBytes?: number;
    },
    bytesWritten: number,
  ) {
    this.interrupted = [
      ...this.interrupted.filter(item => item.id !== options.id),
      {
        id: options.id,
        name: options.name,
        url: options.url,
        source: options.source,
        origin: options.origin,
        expectedBytes: options.expectedBytes ?? 0,
        bytesWritten,
      },
    ];
  }

  private pollPartial(
    id: string,
    offset: number,
    rest: string,
    expectedBytes: number,
  ) {
    this.stopPoll(id);
    const timer = setInterval(() => {
      readFileSize(rest)
        .then(extra => {
          if (!this.downloads[id]) {
            return;
          }

          this.downloads[id] = {
            bytesWritten: offset + extra,
            contentLength: expectedBytes || this.downloads[id].contentLength,
          };
          this.emit();
        })
        .catch(() => undefined);
    }, 500);
    this.downloadPolls.set(id, timer);
  }

  private stopPoll(id: string) {
    const timer = this.downloadPolls.get(id);

    if (timer) {
      clearInterval(timer);
      this.downloadPolls.delete(id);
    }
  }

  private async removePartial(id: string) {
    await removeFileIfExists(partialModelPath(id));
    await removeFileIfExists(partialMetaPath(id));
    await removeFileIfExists(partialRestPath(id));
  }

  private async register(model: InstalledModel) {
    const contextTrain = await readTrainedContext(model.path);
    this.manifest.installed[model.id] = contextTrain
      ? { ...model, contextTrain }
      : model;

    if (!this.manifest.selectedId) {
      this.manifest.selectedId = model.id;
    }

    await writeManifest(this.manifest);
    this.emit();
  }

  private async dropMissing(id: string) {
    delete this.manifest.installed[id];

    if (this.manifest.selectedId === id) {
      this.manifest.selectedId =
        Object.keys(this.manifest.installed)[0] ?? null;
    }

    await writeManifest(this.manifest);
    this.emit();
  }

  private uniqueId(base: string) {
    if (!this.manifest.installed[base]) {
      return base;
    }

    let index = 2;
    while (this.manifest.installed[`${base}-${index}`]) {
      index += 1;
    }
    return `${base}-${index}`;
  }

  private async assertDiskSpace(needed: number) {
    if (needed <= 0) {
      return;
    }

    const free = await getFreeBytes();
    const padded = needed * 1.1;

    if (free < padded) {
      throw new Error('Not enough free storage for this model');
    }
  }

  private assertHttpsGgufUrl(url: string) {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new Error('That does not look like a valid URL');
    }

    if (parsed.protocol !== 'https:') {
      throw new Error('Only HTTPS download links are supported');
    }

    const filename = filenameFromUrl(url);

    if (!filename.toLowerCase().endsWith('.gguf')) {
      throw new Error('The link must point to a .gguf file');
    }
  }

  private isCancelError(error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error ?? '');
    const lower = message.toLowerCase();
    return lower.includes('cancel') || lower.includes('abort');
  }

  private emit() {
    this.listeners.forEach(listener => listener());
  }
}

export const modelManager = new ModelManager();
