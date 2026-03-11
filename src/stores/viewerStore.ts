import { create } from 'zustand';
import { PersistenceAPI } from '../services/api';
import { ViewerState } from './viewerStore.types';
import { VIEWER_KEY } from './viewerStore.utils';
import { createTreeSlice } from './slices/treeSlice';
import { createMediaSlice } from './slices/mediaSlice';
import { createNavigationSlice } from './slices/navigationSlice';
import { createFavoriteSlice } from './slices/favoriteSlice';
import { createAppSlice } from './slices/appSlice';

/**
 * useViewerStore
 * Unified store that combines multiple logic slices.
 */
export const useViewerStore = create<ViewerState>()((...a) => ({
  ...createAppSlice(...a),
  ...createTreeSlice(...a),
  ...createMediaSlice(...a),
  ...createNavigationSlice(...a),
  ...createFavoriteSlice(...a),
}));

export async function loadViewerFromStorage(): Promise<void> {
  try {
    const raw = await PersistenceAPI.loadStore();
    const data = raw[VIEWER_KEY] as any;
    if (data) {
      console.log('[Persistence] Loaded viewer state:', Object.keys(data));
      useViewerStore.setState(() => ({
        ...(data.currentPath && { currentPath: data.currentPath }),
        ...(data.selectedPath && { selectedPath: data.selectedPath }),
        ...(Array.isArray(data.history) && { history: data.history }),
        ...(data.historyIndex != null && { historyIndex: data.historyIndex }),
        ...(Array.isArray(data.favorites) && { favorites: data.favorites }),
        isHydrated: true,
      }));
    } else {
      useViewerStore.getState().setHydrated(true);
    }
  } catch (err) {
    console.error('[Persistence] Failed to load viewer state:', err);
    useViewerStore.getState().setHydrated(true);
  }
}

export function saveViewerToStorage(): void {
  const state = useViewerStore.getState();
  if (state.isRestoring || !state.isHydrated) {
    console.log('[Persistence] Save skipped (restoring or not hydrated)');
    return;
  }
  const { currentPath, selectedPath, history, historyIndex, favorites } = state;
  const data = {
    currentPath,
    selectedPath,
    history,
    historyIndex,
    favorites,
  };
  console.log('[Persistence] Saving viewer state:', Object.keys(data));
  PersistenceAPI.saveStore({
    [VIEWER_KEY]: data,
  });
}

// Side-effect: Manual persistence trigger for favorites
useViewerStore.subscribe((state, prevState) => {
  if (state.favorites !== prevState.favorites && state.isHydrated && !state.isRestoring) {
    saveViewerToStorage();
  }
});

// Side-effect: Auto-reveal folder tree when path changes
useViewerStore.subscribe((state, prevState) => {
  if (state.currentPath && state.currentPath !== prevState.currentPath && state.isHydrated) {
    // We don't await here to avoid blocking other state updates, 
    // but revealPath internal hydration logic handles sequence.
    state.revealPath(state.currentPath);
  }
});
