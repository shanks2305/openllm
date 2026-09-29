import { useEffect, useState } from 'react';

import { memoryStore, type MemoryState } from '../memory/memoryStore';

export function useMemory() {
  const [state, setState] = useState<MemoryState>(() => memoryStore.getState());

  useEffect(() => {
    const unsubscribe = memoryStore.subscribe(() => {
      setState(memoryStore.getState());
    });

    memoryStore.hydrate().catch(() => undefined);
    return unsubscribe;
  }, []);

  return {
    ...state,
    add: (text: string) => memoryStore.add(text),
    update: (id: string, text: string) => memoryStore.update(id, text),
    remove: (id: string) => memoryStore.remove(id),
    clear: () => memoryStore.clear(),
    setEnabled: (enabled: boolean) => memoryStore.setEnabled(enabled),
  };
}
