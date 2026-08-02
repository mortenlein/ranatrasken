import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// Relative imports reach into the web app's source tree; see metro.config.js.
import type { LocalizedText } from '../../../src/data/destinations';

export type Language = 'nb' | 'en';

interface AppState {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (text: LocalizedText) => string;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('nb');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const value = useMemo<AppState>(
    () => ({
      language,
      setLanguage,
      t: (text) => text[language],
      selectedId,
      setSelectedId,
    }),
    [language, selectedId]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
