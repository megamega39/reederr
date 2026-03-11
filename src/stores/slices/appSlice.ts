import { StateCreator } from 'zustand';
import { ViewerState } from '../viewerStore.types';

export interface AppSlice {
  isHydrated: ViewerState['isHydrated'];
  isRestoring: ViewerState['isRestoring'];
  setHydrated: ViewerState['setHydrated'];
  setRestoring: ViewerState['setRestoring'];
  fileListFilter: ViewerState['fileListFilter'];
  setFileListFilter: ViewerState['setFileListFilter'];
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
  setHydrated: (v) => set({ isHydrated: v }),
  setRestoring: (v) => set({ isRestoring: v }),
  setFileListFilter: (v) => set({ fileListFilter: v }),
});
