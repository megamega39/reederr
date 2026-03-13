import { create } from 'zustand';

export interface AppState {
  isHydrated: boolean;
  isRestoring: boolean;
  isLoading: boolean;
  error: string | null;
  fileListFilter: string;

  setHydrated: (v: boolean) => void;
  setRestoring: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setFileListFilter: (v: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isHydrated: false,
  isRestoring: false,
  isLoading: false,
  error: null,
  fileListFilter: '',

  setHydrated: (v) => set({ isHydrated: v }),
  setRestoring: (v) => set({ isRestoring: v }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (v) => set({ error: v }),
  setFileListFilter: (v) => set({ fileListFilter: v }),
}));
