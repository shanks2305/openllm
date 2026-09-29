import { useCallback, useEffect, useState } from 'react';

import { modelManager } from '../model/ModelManager';
import type { ModelManagerState } from '../model/ModelManager';

export function useModels() {
  const [state, setState] = useState<ModelManagerState>(() =>
    modelManager.getState(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = modelManager.subscribe(() => {
      setState(modelManager.getState());
    });

    modelManager.hydrate().catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    });

    return unsubscribe;
  }, []);

  const run = useCallback(async (task: () => Promise<void>) => {
    setError(null);
    setBusy(true);

    try {
      await task();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const downloadCatalog = useCallback(
    (id: string) => run(() => modelManager.downloadCatalog(id)),
    [run],
  );

  const downloadFromUrl = useCallback(
    (url: string) => run(() => modelManager.downloadFromUrl(url)),
    [run],
  );

  const importFromLocalPath = useCallback(
    (uri: string, fileName: string) =>
      run(() => modelManager.importFromLocalPath(uri, fileName)),
    [run],
  );

  const select = useCallback(
    (id: string) => run(() => modelManager.select(id)),
    [run],
  );

  const remove = useCallback(
    (id: string) => run(() => modelManager.remove(id)),
    [run],
  );

  const cancelDownload = useCallback((id: string) => {
    modelManager.cancelDownload(id);
  }, []);

  return {
    ...state,
    busy,
    error,
    downloadCatalog,
    downloadFromUrl,
    importFromLocalPath,
    select,
    remove,
    cancelDownload,
  };
}
