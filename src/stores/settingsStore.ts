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
  gridThumbnailSize: number;
  hoverPreviewSize: number;

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
  setGridThumbnailSize: (v: number) => void;
  setHoverPreviewSize: (v: number) => void;

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
  gridThumbnailSize: 160,
  hoverPreviewSize: 320,
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
  setGridThumbnailSize: (v) => {
    set({ gridThumbnailSize: Math.max(80, Math.min(500, v)) });
    get().saveSettings();
  },
  setHoverPreviewSize: (v) => {
    set({ hoverPreviewSize: Math.max(160, Math.min(500, v)) });
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const res = await PersistenceAPI.loadStore();
      if (res.ok) {
        const raw = res.value;
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
      } else {
        set({ isHydrated: true });
      }
    } catch (err) {
      set({ isHydrated: true });
    }
  },

  saveSettings: () => {
    const state = get();
    if (!state.isHydrated) return;
    
    // Pick ONLY data fields. Structured clone (IPC) fails if functions are included.
    const data = {
      language: state.language,
      viewMode: state.viewMode,
      binding: state.binding,
      autoThreshold: state.autoThreshold,
      scaleMode: state.scaleMode,
      autoSpreadCover: state.autoSpreadCover,
      recursiveMedia: state.recursiveMedia,
      wrapNavigation: state.wrapNavigation,
      slideshowInterval: state.slideshowInterval,
      autoPlay: state.autoPlay,
      gridThumbnailSize: state.gridThumbnailSize,
      hoverPreviewSize: state.hoverPreviewSize,
    };

    PersistenceAPI.saveStore({
      [SETTINGS_KEY]: data,
    });
  },
}));
