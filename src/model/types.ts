export type ModelSource = 'catalog' | 'url' | 'import';

export type CatalogVariant = {
  id: string;
  quant: string;
  sizeBytes: number;
  url: string;
};

export type CatalogProjector = {
  url: string;
  sizeBytes: number;
};

export type CatalogModel = CatalogVariant & {
  name: string;
  description: string;
  variants: CatalogVariant[];
  reasoning?: boolean;
  projector?: CatalogProjector;
};

export type InstalledModel = {
  id: string;
  name: string;
  path: string;
  bytes: number;
  source: ModelSource;
  origin?: string;
  downloadedAt: number;
  contextTrain?: number;
  // Vision encoder (mmproj GGUF) that lets the model read images.
  projectorPath?: string;
};

export type Manifest = {
  selectedId: string | null;
  installed: Record<string, InstalledModel>;
};

export type DownloadProgress = {
  bytesWritten: number;
  contentLength: number;
  label?: string;
};

export type InterruptedDownload = {
  id: string;
  name: string;
  url: string;
  source: ModelSource;
  origin: string;
  expectedBytes: number;
  bytesWritten: number;
};
