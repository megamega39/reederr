import { create } from 'zustand';
import { PersistenceAPI } from '../services/api';

const MEDIA_PLAYER_KEY = 'mediaPlayer';

export interface MediaPlayerSettings {
  loopEnabled: boolean;
  playbackRate: number;
  preservesPitch: boolean;
}

interface MediaPlayerState extends MediaPlayerSettings {
  setLoopEnabled: (v: boolean) => void;
  setPlaybackRate: (v: number) => void;
  setPreservesPitch: (v: boolean) => void;
  toggleLoop: () => void;
  changePlaybackRate: (delta: number) => void;
  resetPlaybackRate: () => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => void;
  isHydrated: boolean;
  setHydrated: (v: boolean) => void;
  isRestoring: boolean;
  setRestoring: (v: boolean) => void;
}

const clampRate = (v: number) => Math.max(0.25, Math.min(4, v));

export const useMediaPlayerStore = create<MediaPlayerState>((set, get) => ({
  loopEnabled: false,
  playbackRate: 1,
  preservesPitch: true,
  isHydrated: false,
  isRestoring: false,

  setHydrated: (v) => set({ isHydrated: v }),
  setRestoring: (v) => set({ isRestoring: v }),

  setLoopEnabled: (v) => {
    set({ loopEnabled: v });
    get().saveToStorage();
  },

  setPlaybackRate: (v) => {
    set({ playbackRate: clampRate(v) });
    get().saveToStorage();
  },

  setPreservesPitch: (v) => {
    set({ preservesPitch: v });
    get().saveToStorage();
  },

  toggleLoop: () => {
    set((s) => ({ loopEnabled: !s.loopEnabled }));
    get().saveToStorage();
  },

  changePlaybackRate: (delta) => {
    set((s) => ({ playbackRate: clampRate(s.playbackRate + delta) }));
    get().saveToStorage();
  },

  resetPlaybackRate: () => {
    set({ playbackRate: 1 });
    get().saveToStorage();
  },

  loadFromStorage: async () => {
    try {
      console.log('[Persistence:MediaPlayer] loading state...');
      const raw = await PersistenceAPI.loadStore();
      const state = raw[MEDIA_PLAYER_KEY] as Partial<MediaPlayerSettings> | undefined;
      if (state) {
        console.log('[Persistence:MediaPlayer] Loaded state:', Object.keys(state));
        set((s) => ({
          loopEnabled: typeof state.loopEnabled === 'boolean' ? state.loopEnabled : s.loopEnabled,
          playbackRate: typeof state.playbackRate === 'number' ? clampRate(state.playbackRate) : s.playbackRate,
          preservesPitch: typeof state.preservesPitch === 'boolean' ? state.preservesPitch : s.preservesPitch,
          isHydrated: true,
        }));
      } else {
        set({ isHydrated: true });
      }
    } catch (err) {
      console.error('[Persistence:MediaPlayer] Failed to load state:', err);
      set({ isHydrated: true });
    }
  },

  saveToStorage: () => {
    const state = get();
    if (state.isRestoring || !state.isHydrated) {
      console.log('[Persistence:MediaPlayer] Media save skipped (restoring or not hydrated)');
      return;
    }

    // Using a simple timeout for debounce within the store to keep it simple
    // but App.tsx level is usually better for complex stores.
    // For this simple one, we'll just guard it.
    const { loopEnabled, playbackRate, preservesPitch } = state;
    const stateToSave = { loopEnabled, playbackRate, preservesPitch };
    console.log('[Persistence:MediaPlayer] Saving state...', stateToSave);
    PersistenceAPI.saveStore({
      [MEDIA_PLAYER_KEY]: stateToSave,
    });
  },
}));
