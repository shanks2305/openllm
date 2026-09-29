export type ModelSource = 'catalog' | 'url' | 'import';

export type CatalogModel = {
  id: string;
  name: string;
  description: string;
  quant: string;
  sizeBytes: number;
  url: string;
};

export type InstalledModel = {
  id: string;
  name: string;
  path: string;
  bytes: number;
  source: ModelSource;
  origin?: string;
  downloadedAt: number;
};

export type Manifest = {
  selectedId: string | null;
  installed: Record<string, InstalledModel>;
};

export type DownloadProgress = {
  bytesWritten: number;
  contentLength: number;
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
