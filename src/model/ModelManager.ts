import RNFS from 'react-native-fs';

import { getCatalogModel, MODEL_CATALOG } from './catalog';
import {
  assertGgufFile,
  copyFile,
  ensureModelsDir,
  fileExists,
  filenameFromUrl,
  getFreeBytes,
  legacyModelPath,
  modelFilePath,
  moveFile,
  readFileSize,
  readManifest,
  removeFileIfExists,
  sanitizeModelId,
  toFsPath,
  writeManifest,
} from './modelStorage';
import type {
  CatalogModel,
  DownloadProgress,
  InstalledModel,
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
  importing: boolean;
};

type Listener = () => void;

class ModelManager {
  private ready = false;
  private hydratePromise: Promise<void> | null = null;
  private manifest: Manifest = { selectedId: null, installed: {} };
  private downloads: Record<string, DownloadProgress> = {};
  private downloadJobs = new Map<string, number>();
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
    const jobId = this.downloadJobs.get(id);

    if (jobId != null) {
      RNFS.stopDownload(jobId);
    }

    this.downloadJobs.delete(id);
    delete this.downloads[id];
    this.emit();
  }

  private async load() {
    await ensureModelsDir();
    this.manifest = await readManifest();
    await this.reconcileFiles();
    await this.migrateLegacyModel();
    this.ready = true;
    this.emit();
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
      this.manifest.selectedId = Object.keys(this.manifest.installed)[0] ?? null;
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

    if (options.expectedBytes) {
      await this.assertDiskSpace(options.expectedBytes);
    }

    const dest = modelFilePath(options.id);
    const part = `${dest}.part`;
    await removeFileIfExists(part);

    this.downloads[options.id] = {
      bytesWritten: 0,
      contentLength: options.expectedBytes ?? 0,
    };
    this.emit();

    const { promise, jobId } = RNFS.downloadFile({
      fromUrl: options.url,
      toFile: part,
      background: true,
      progressDivider: 4,
      headers: {
        Accept: '*/*',
        'User-Agent': 'freeGPT/1.0',
      },
      begin: res => {
        this.downloads[options.id] = {
          bytesWritten: 0,
          contentLength: res.contentLength || options.expectedBytes || 0,
        };
        this.emit();
      },
      progress: res => {
        this.downloads[options.id] = {
          bytesWritten: res.bytesWritten,
          contentLength: res.contentLength,
        };
        this.emit();
      },
    });

    this.downloadJobs.set(options.id, jobId);

    try {
      const result = await promise;

      if (result.statusCode != null && result.statusCode >= 400) {
        throw new Error(`Download failed (${result.statusCode})`);
      }

      await assertGgufFile(part);
      await moveFile(part, dest);
      await this.register({
        id: options.id,
        name: options.name,
        path: dest,
        bytes: await readFileSize(dest),
        source: options.source,
        origin: options.origin,
        downloadedAt: Date.now(),
      });
    } catch (error) {
      await removeFileIfExists(part);
      await removeFileIfExists(dest);

      if (this.isCancelError(error)) {
        return;
      }

      throw error;
    } finally {
      this.downloadJobs.delete(options.id);
      delete this.downloads[options.id];
      this.emit();
    }
  }

  private async register(model: InstalledModel) {
    this.manifest.installed[model.id] = model;

    if (!this.manifest.selectedId) {
      this.manifest.selectedId = model.id;
    }

    await writeManifest(this.manifest);
    this.emit();
  }

  private async dropMissing(id: string) {
    delete this.manifest.installed[id];

    if (this.manifest.selectedId === id) {
      this.manifest.selectedId = Object.keys(this.manifest.installed)[0] ?? null;
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
