import { useEffect, useRef } from 'react';
import { useViewerStore, loadViewerFromStorage, saveViewerToStorage } from '../stores/viewerStore';
import { useLayoutStore, loadLayoutFromStorage, saveLayoutToStorage } from '../stores/layoutStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';

export function PersistenceManager() {
  const initTree = useViewerStore((s) => s.initTree);
  const loadDirectory = useViewerStore((s) => s.loadDirectory);

  const isMounted = useRef(false);
  const initPromise = useRef<Promise<void> | null>(null);

  const viewerHydrated = useViewerStore((s) => s.isHydrated);
  const layoutHydrated = useLayoutStore((s) => s.isHydrated);
  const viewerRestoring = useViewerStore((s) => s.isRestoring);
  const layoutRestoring = useLayoutStore((s) => s.isRestoring);

  useEffect(() => {
    isMounted.current = true;
    if (initPromise.current) return;

    const runInit = async () => {
      console.log('[Persistence] >>> Synchronized initialization START');

      useViewerStore.getState().setRestoring(true);
      useLayoutStore.getState().setRestoring(true);
      useMediaPlayerStore.getState().setRestoring(true);

      try {
        console.log('[Persistence] Loading stores from disk...');
        await Promise.all([
          loadLayoutFromStorage(),
          loadViewerFromStorage(),
          useMediaPlayerStore.getState().loadFromStorage(),
        ]);

        console.log('[Persistence] Initializing tree...');
        await initTree();

        const state = useViewerStore.getState();
        const savedPath = state.currentPath;
        const savedSelected = state.selectedPath;

        if (savedPath) {
          console.log('[Persistence] Restoring directory:', savedPath);
          try {
            await loadDirectory(savedPath, {
              pushHistory: false,
              selectedPath: savedSelected
            });
            // Give a moment for tree components to hydrate and listDirectory to settle
            await new Promise(resolve => setTimeout(resolve, 200));
            await useViewerStore.getState().revealPath(savedPath);
            await useViewerStore.getState().initExpandedFolders();
          } catch (e) {
            console.warn('[Persistence] Directory restoration failed:', e);
          }
        }
      } catch (e) {
        console.error('[Persistence] CRITICAL: Initialization aborted due to error:', e);
      } finally {
        await new Promise(resolve => setTimeout(resolve, 1000));
        useViewerStore.getState().setRestoring(false);
        useLayoutStore.getState().setRestoring(false);
        useMediaPlayerStore.getState().setRestoring(false);
        console.log('[Persistence] <<< Initialization complete. Locks RELEASED.');
      }
    };

    initPromise.current = runInit();
  }, [initTree, loadDirectory]);

  // Layout save debouncing
  const layoutState = useLayoutStore();
  const {
    leftPaneWidth, folderPaneHeight, viewMode, binding, scaleMode, catalogMode,
    recursiveMedia, fileListSortBy, fileListSortOrder, fileListColumnOrder,
    fileListColName, fileListColSize, fileListColType, fileListColMtime
  } = layoutState;

  useEffect(() => {
    if (!layoutHydrated || layoutRestoring) return;
    const timer = setTimeout(() => {
      saveLayoutToStorage();
    }, 500);
    return () => clearTimeout(timer);
  }, [
    layoutHydrated, layoutRestoring, leftPaneWidth, folderPaneHeight, viewMode, binding,
    scaleMode, catalogMode, recursiveMedia, fileListSortBy, fileListSortOrder,
    fileListColumnOrder, fileListColName, fileListColSize, fileListColType, fileListColMtime
  ]);

  // Viewer save debouncing 
  const currentPath = useViewerStore((s) => s.currentPath);
  const selectedPath = useViewerStore((s) => s.selectedPath);
  const history = useViewerStore((s) => s.history);
  const historyIndex = useViewerStore((s) => s.historyIndex);
  const favorites = useViewerStore((s) => s.favorites);

  useEffect(() => {
    if (!viewerHydrated || viewerRestoring) return;
    const timer = setTimeout(() => {
      saveViewerToStorage();
    }, 500);
    return () => clearTimeout(timer);
  }, [viewerHydrated, viewerRestoring, currentPath, selectedPath, history, historyIndex, favorites]);

  return null; // Side-effect only component
}
