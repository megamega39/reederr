import { create } from 'zustand';
import { PersistenceAPI, FileSystemAPI } from '../services/api';
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
    const data = raw[VIEWER_KEY] as {
      currentPath?: string;
      selectedPath?: string;
      history?: any[];
      historyIndex?: number;
      favorites?: any[];
    };
    if (data) {
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

// Side-effect: Directory Watching
useViewerStore.subscribe((state, prevState) => {
  if (state.currentPath && state.currentPath !== prevState.currentPath && state.isHydrated) {
    // Only watch real physical directories
    if (!state.currentPath.includes('!') && state.currentPath !== 'pc' && state.currentPath !== 'network') {
      FileSystemAPI.watchDirectory(state.currentPath);
    }
  }
});

// Initial global listener for file system changes
FileSystemAPI.onFileSystemChanged(({ path }) => {
  const state = useViewerStore.getState();
  if (state.currentPath === path && !state.isLoading) {
    console.log('[Watcher] Current directory changed, refreshing...', path);
    state.loadDirectory(path, { pushHistory: false });
  }
});
