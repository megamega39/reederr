import { StateCreator } from 'zustand';
import { MenuAPI } from '../../services/api';
import { ViewerState } from '../viewerStore.types';

export interface AppSlice {
  isHydrated: ViewerState['isHydrated'];
  isRestoring: ViewerState['isRestoring'];
  setHydrated: ViewerState['setHydrated'];
  setRestoring: ViewerState['setRestoring'];
  fileListFilter: ViewerState['fileListFilter'];
  setFileListFilter: ViewerState['setFileListFilter'];
  language: ViewerState['language'];
  setLanguage: ViewerState['setLanguage'];
}

export const createAppSlice: StateCreator<
  ViewerState,
  [],
  [],
  AppSlice
> = (set) => ({
  isHydrated: false,
  isRestoring: false,
  fileListFilter: '',
  language: 'ja',
  setHydrated: (v) => set({ isHydrated: v }),
  setRestoring: (v) => set({ isRestoring: v }),
  setFileListFilter: (v) => set({ fileListFilter: v }),
  setLanguage: (l) => {
    set({ language: l });
    MenuAPI.rebuildMenu(l);
  },
});
