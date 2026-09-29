import { useEffect, useState } from 'react';

import { settingsStore } from '../settings/settingsStore';
import type { AppSettings } from '../settings/settingsStore';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() =>
    settingsStore.getState(),
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = settingsStore.subscribe(() => {
      setSettings(settingsStore.getState());
      setSaveError(settingsStore.getSaveError());
    });

    settingsStore.hydrate().catch(() => {
      // Keep defaults when stored settings cannot be read.
    });

    return unsubscribe;
  }, []);

  return {
    ...settings,
    saveError,
    setTemperature: settingsStore.setTemperature,
    setMaxTokens: settingsStore.setMaxTokens,
    setContextSize: settingsStore.setContextSize,
    setTopP: settingsStore.setTopP,
    setRepeatPenalty: settingsStore.setRepeatPenalty,
    setSystemPrompt: settingsStore.setSystemPrompt,
  };
}
