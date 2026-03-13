import { useAppStore } from './appStore';
import { useNavigationStore } from './navigationStore';
import { useTreeStore } from './treeStore';
import { useMediaStore } from './mediaStore';
import { useFavoriteStore } from './favoriteStore';
import { PersistenceAPI, FileSystemAPI } from '../services/api';
import { VIEWER_KEY, isMediaEntry } from './viewerStore.utils';

export type ViewerFacade = ReturnType<typeof useAppStore.getState> &
  ReturnType<typeof useNavigationStore.getState> &
  ReturnType<typeof useTreeStore.getState> &
  ReturnType<typeof useMediaStore.getState> &
  ReturnType<typeof useFavoriteStore.getState>;

/**
 * legacy / facade for compatibility
 * We encourage using useAppStore, useNavigationStore, etc. directly.
 */
export function useViewerStore(): ViewerFacade;
export function useViewerStore<T>(selector: (state: ViewerFacade) => T): T;
export function useViewerStore<T>(selector?: (state: ViewerFacade) => T) {
  const app = useAppStore();
  const nav = useNavigationStore();
  const tree = useTreeStore();
  const media = useMediaStore();
  const fav = useFavoriteStore();

  const facade: ViewerFacade = {
    ...app,
    ...nav,
    ...tree,
    ...media,
    ...fav,
  };

  // Guard: if this object is accidentally used as a string (e.g. currentPath.split)
  // we give it a recognizable string value to help debugging,
  // although the actual fix is ensuring the selector works.
  if (typeof (facade as any).toString !== 'function' || (facade as any).toString === Object.prototype.toString) {
    Object.defineProperty(facade, 'toString', {
      value: () => '[ViewerStoreFacadeObject]',
      enumerable: false
    });
  }

  return selector ? selector(facade) : facade;
}

/**
 * Persistence & Side-effects Coordination
 */

export async function loadViewerFromStorage(): Promise<void> {
  try {
    const res = await PersistenceAPI.loadStore();
    if (res.ok) {
      const raw = res.value;
      // Support both new 'viewer' key and legacy 'viewer_state' key for robust restoration.
      const data = (raw[VIEWER_KEY] || raw['viewer_state']) as any;
      
      if (data) {
        if (data.historyIndex != null) useNavigationStore.setState({ historyIndex: data.historyIndex });
        if (Array.isArray(data.favorites)) useFavoriteStore.setState({ favorites: data.favorites });
        
        // Load paths LAST so reveals happen after dependent data is ready
        if (data.currentPath) useNavigationStore.setState({ currentPath: data.currentPath });
        if (data.selectedPath) useMediaStore.setState({ selectedPath: data.selectedPath });

        useAppStore.setState({ isHydrated: true });
      } else {
        useAppStore.setState({ isHydrated: true });
      }
    } else {
      useAppStore.setState({ isHydrated: true });
    }
  } catch (err) {
    useAppStore.setState({ isHydrated: true });
  }
}

export async function saveViewerToStorage(): Promise<void> {
  const appState = useAppStore.getState();
  if (appState.isRestoring || !appState.isHydrated) return;

  const nav = useNavigationStore.getState();
  const media = useMediaStore.getState();
  const fav = useFavoriteStore.getState();

  const data = {
    currentPath: nav.currentPath,
    selectedPath: media.selectedPath,
    history: nav.history,
    historyIndex: nav.historyIndex,
    favorites: fav.favorites,
  };

  await PersistenceAPI.saveStore({
    [VIEWER_KEY]: data,
  });
}

// Coordinate: Favorites change -> Save
useFavoriteStore.subscribe((state, prevState) => {
  if (state.favorites !== prevState.favorites) {
    saveViewerToStorage();
  }
});

// Coordinate: Navigation changed -> Tree Reveal & Watcher
useNavigationStore.subscribe((state, prevState) => {
  if (state.currentPath && state.currentPath !== prevState.currentPath) {
    const appState = useAppStore.getState();
    const strPath = state.currentPath as string;
    const norm = strPath.toLowerCase();
    
    // Skip reveal during restoration to avoid inconsistent states (PC vs Favorites)
    if (!appState.isRestoring && norm !== 'pc' && norm !== 'network') {
      useTreeStore.getState().revealPath(state.currentPath);
    }
    
    if (!strPath.includes('!') && norm !== 'pc' && norm !== 'network') {
      FileSystemAPI.watchDirectory(strPath);
    }
    saveViewerToStorage();
  }
});

// Coordinate: Directory Load result -> Sync other stores
useNavigationStore.subscribe((state, prevState) => {
  if (state.entries !== prevState.entries && state.currentPath) {
    const { entries, currentPath } = state;
    
    // Sync Tree
    useTreeStore.setState((s: any) => ({
      treeChildren: {
        ...s.treeChildren,
        [currentPath as any]: entries
          .filter(e => e.isDirectory || e.isArchive)
          .map(e => ({ name: e.name, path: e.path, isDirectory: e.isDirectory, isArchive: e.isArchive }))
      }
    }));

    // Sync Media
    const mediaEntries = entries.filter(isMediaEntry);
    const mediaStore = useMediaStore.getState();
    
    const pathChanged = currentPath !== prevState.currentPath;
    
    if (mediaEntries.length > 0 && (pathChanged || mediaStore.imageEntries.length === 0)) {
      mediaStore.setImageEntries(mediaEntries);
      const newSelected = useMediaStore.getState().selectedPath;
      if (newSelected) {
        mediaStore.loadMedia(newSelected);
      }
    } else {
      useMediaStore.setState({ imageEntries: mediaEntries });
    }
  }
});

// Global watcher listener
FileSystemAPI.onFileSystemChanged(({ path }) => {
  if (typeof path !== 'string') return;
  const nav = useNavigationStore.getState();
  if (nav.currentPath === path && !nav.isLoading) {
    nav.loadDirectory(path, { pushHistory: false });
  }
});
