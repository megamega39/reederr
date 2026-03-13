import { create } from 'zustand';
import { PersistenceAPI, MenuAPI } from '../services/api';

export type ViewMode = 'single' | 'spread' | 'auto';
export type Binding = 'rtl' | 'ltr';
export type ScaleMode = 'fit-window' | 'fit-width' | 'fit-height' | 'original';

export interface SettingsState {
  language: string;
  viewMode: ViewMode;
  binding: Binding;
  autoThreshold: number;
  scaleMode: ScaleMode;
  autoSpreadCover: boolean;
  recursiveMedia: boolean;
  wrapNavigation: boolean;
  slideshowInterval: number;
  autoPlay: boolean;

  setLanguage: (l: string) => void;
  setViewMode: (m: ViewMode) => void;
  setBinding: (b: Binding) => void;
  setAutoThreshold: (t: number) => void;
  setScaleMode: (m: ScaleMode) => void;
  setAutoSpreadCover: (v: boolean) => void;
  setRecursiveMedia: (v: boolean) => void;
  setWrapNavigation: (v: boolean) => void;
  setSlideshowInterval: (v: number) => void;
  setAutoPlay: (v: boolean) => void;

  isHydrated: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: () => void;
}

const SETTINGS_KEY = 'settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'ja',
  viewMode: 'auto',
  binding: 'rtl',
  autoThreshold: 1.35,
  scaleMode: 'fit-window',
  autoSpreadCover: true,
  recursiveMedia: false,
  wrapNavigation: true,
  slideshowInterval: 3,
  autoPlay: true,
  isHydrated: false,

  setLanguage: (l) => {
    set({ language: l });
    MenuAPI.rebuildMenu(l);
    get().saveSettings();
  },
  setViewMode: (m) => {
    set({ viewMode: m });
    get().saveSettings();
  },
  setBinding: (b) => {
    set({ binding: b });
    get().saveSettings();
  },
  setAutoThreshold: (t) => {
    set({ autoThreshold: Math.max(1.1, Math.min(1.8, t)) });
    get().saveSettings();
  },
  setScaleMode: (m) => {
    set({ scaleMode: m });
    get().saveSettings();
  },
  setAutoSpreadCover: (v) => {
    set({ autoSpreadCover: v });
    get().saveSettings();
  },
  setRecursiveMedia: (v) => {
    set({ recursiveMedia: v });
    get().saveSettings();
  },
  setWrapNavigation: (v) => {
    set({ wrapNavigation: v });
    get().saveSettings();
  },
  setSlideshowInterval: (v) => {
    set({ slideshowInterval: Math.max(1, v) });
    get().saveSettings();
  },
  setAutoPlay: (v) => {
    set({ autoPlay: v });
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const raw = await PersistenceAPI.loadStore();
      const data = raw[SETTINGS_KEY] as Partial<SettingsState> | undefined;
      if (data) {
        set((s) => ({
          ...s,
          ...data,
          isHydrated: true,
        }));
        // Rebuild menu with loaded language
        if (data.language) MenuAPI.rebuildMenu(data.language);
      } else {
        set({ isHydrated: true });
      }
    } catch (err) {
      set({ isHydrated: true });
    }
  },

  saveSettings: () => {
    const { isHydrated, loadSettings, saveSettings, ...data } = get();
    if (!isHydrated) return;
    PersistenceAPI.saveStore({
      [SETTINGS_KEY]: data,
    });
  },
}));
