import { useEffect, useState } from 'react';

import { settingsStore } from '../settings/settingsStore';
import type { AppSettings } from '../settings/settingsStore';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() =>
    settingsStore.getState(),
  );

  useEffect(() => {
    const unsubscribe = settingsStore.subscribe(() => {
      setSettings(settingsStore.getState());
    });

    settingsStore.hydrate().catch(() => {
      // Keep defaults when stored settings cannot be read.
    });

    return unsubscribe;
  }, []);

  return {
    ...settings,
    setTemperature: settingsStore.setTemperature,
    setMaxTokens: settingsStore.setMaxTokens,
    setSystemPrompt: settingsStore.setSystemPrompt,
  };
}
