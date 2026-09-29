import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

import type { Manifest } from './types';

type LlamaNative = {
  readFilePrefix?: (path: string, length: number) => Promise<string>;
  appendFile?: (source: string, dest: string) => Promise<boolean>;
  readModelMetadata?: (
    path: string,
  ) => Promise<{ architecture: string; contextTrain: number }>;
};

const Llama = NativeModules.Llama as LlamaNative | undefined;

const GGUF_MAGIC = 'GGUF';
const LEGACY_MODEL_NAME = 'model.gguf';

export const modelsDir = () => `${RNFS.DocumentDirectoryPath}/models`;
export const manifestPath = () => `${modelsDir()}/manifest.json`;
export const legacyModelPath = () =>
  `${RNFS.DocumentDirectoryPath}/${LEGACY_MODEL_NAME}`;

export const emptyManifest = (): Manifest => ({
  selectedId: null,
  installed: {},
});

export function modelFilePath(id: string) {
  return `${modelsDir()}/${id}.gguf`;
}

export function partialModelPath(id: string) {
  return `${modelFilePath(id)}.part`;
}

export function partialMetaPath(id: string) {
  return `${partialModelPath(id)}.json`;
}

export function partialRestPath(id: string) {
  return `${partialModelPath(id)}.rest`;
}

export function storageNote(sizeBytes: number) {
  if (sizeBytes >= 1_800_000_000) {
    return 'Plan on about 2 GB of disk and extra RAM.';
  }

  if (sizeBytes >= 1_000_000_000) {
    return 'Needs a device with more free storage and RAM.';
  }

  return '';
}

export async function appendFile(source: string, dest: string) {
  const llama = NativeModules.Llama as LlamaNative | undefined;

  if (!llama?.appendFile) {
    throw new Error('Resume is unavailable until the iOS app is rebuilt');
  }

  await llama.appendFile(source, dest);
}

export function toFsPath(uri: string) {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.replace('file://', ''));
  }

  return uri;
}

export async function ensureModelsDir() {
  const dir = modelsDir();

  if (!(await RNFS.exists(dir))) {
    await RNFS.mkdir(dir);
  }
}

export async function fileExists(path: string) {
  return RNFS.exists(path);
}

export async function readManifest(): Promise<Manifest> {
  await ensureModelsDir();

  if (!(await RNFS.exists(manifestPath()))) {
    return emptyManifest();
  }

  try {
    const raw = await RNFS.readFile(manifestPath(), 'utf8');
    const parsed = JSON.parse(raw) as Manifest;

    if (!parsed || typeof parsed !== 'object') {
      return emptyManifest();
    }

    return {
      selectedId: parsed.selectedId ?? null,
      installed: parsed.installed ?? {},
    };
  } catch {
    return emptyManifest();
  }
}

export async function writeManifest(manifest: Manifest) {
  await ensureModelsDir();
  await RNFS.writeFile(
    manifestPath(),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
}

export async function getFreeBytes() {
  const info = await RNFS.getFSInfo();
  return info.freeSpace;
}

export async function readFileSize(path: string) {
  const stat = await RNFS.stat(path);
  return Number(stat.size);
}

async function readFilePrefix(path: string, length: number) {
  // RNFS.read() uses NSInteger on iOS, which the RN 0.87 bridge cannot convert.
  if (Platform.OS === 'ios' && Llama?.readFilePrefix) {
    return Llama.readFilePrefix(path, length);
  }

  return RNFS.read(path, length, 0, 'ascii');
}

export async function assertGgufFile(path: string) {
  const exists = await RNFS.exists(path);

  if (!exists) {
    throw new Error('Model file is missing');
  }

  const header = await readFilePrefix(path, 4);

  if (header !== GGUF_MAGIC) {
    throw new Error('That file is not a valid GGUF model');
  }
}

export async function readTrainedContext(path: string) {
  const llama = NativeModules.Llama as LlamaNative | undefined;

  if (!llama?.readModelMetadata) {
    return null;
  }

  try {
    const { contextTrain } = await llama.readModelMetadata(path);
    return contextTrain > 0 ? contextTrain : null;
  } catch {
    return null;
  }
}

export async function removeFileIfExists(path: string) {
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

export async function moveFile(from: string, to: string) {
  await removeFileIfExists(to);
  await RNFS.moveFile(from, to);
}

export async function copyFile(from: string, to: string) {
  await removeFileIfExists(to);
  await RNFS.copyFile(from, to);
}

export function sanitizeModelId(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/\.gguf$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.slice(0, 80) || `model-${Date.now()}`;
}

export function filenameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    return decodeURIComponent(last);
  } catch {
    return '';
  }
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return 'Unknown size';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  const digits = unit === 0 || size >= 10 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unit]}`;
}
