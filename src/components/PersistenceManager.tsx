import { useEffect, useRef } from 'react';
import { useNavigationStore } from '../stores/navigationStore';
import { useMediaStore } from '../stores/mediaStore';
import { useTreeStore } from '../stores/treeStore';
import { useAppStore } from '../stores/appStore';
import { useFavoriteStore } from '../stores/favoriteStore';
import { loadViewerFromStorage, saveViewerToStorage } from '../stores/viewerStore';
import { useLayoutStore, loadLayoutFromStorage, saveLayoutToStorage } from '../stores/layoutStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useShallow } from 'zustand/react/shallow';

export function PersistenceManager() {
  const initTree = useTreeStore((s) => s.initTree);
  const loadDirectory = useNavigationStore((s) => s.loadDirectory);

  const isMounted = useRef(false);
  const initPromise = useRef<Promise<void> | null>(null);

  const viewerHydrated = useAppStore((s) => s.isHydrated);
  const layoutHydrated = useLayoutStore((s) => s.isHydrated);
  const settingsHydrated = useSettingsStore((s) => s.isHydrated);
  
  const viewerRestoring = useAppStore((s) => s.isRestoring);
  const layoutRestoring = useLayoutStore((s) => s.isRestoring);

  useEffect(() => {
    isMounted.current = true;
    if (initPromise.current) return;

    const runInit = async () => {
      useAppStore.getState().setRestoring(true);
      useLayoutStore.getState().setRestoring(true);
      useMediaPlayerStore.getState().setRestoring(true);

      try {
        // Load settings first as others might depend on it
        await useSettingsStore.getState().loadSettings();
        await loadLayoutFromStorage();
        await loadViewerFromStorage();
        await useMediaPlayerStore.getState().loadFromStorage();

        await initTree();

        const savedPath = useNavigationStore.getState().currentPath;
        const savedSelected = useMediaStore.getState().selectedPath;

        if (savedPath) {
          try {
            await loadDirectory(savedPath, {
              pushHistory: false,
              selectedPath: savedSelected ?? undefined
            });
            // Give a moment for tree components to hydrate and listDirectory to settle
            await new Promise(resolve => setTimeout(resolve, 200));
            await useTreeStore.getState().revealPath(savedPath);
            await useTreeStore.getState().initExpandedFolders();
          } catch (e) {
            console.warn('[Persistence] Directory restoration failed:', e);
          }
        }
      } catch (e) {
      } finally {
        await new Promise(resolve => setTimeout(resolve, 1000));
        useAppStore.getState().setRestoring(false);
        useLayoutStore.getState().setRestoring(false);
        useMediaPlayerStore.getState().setRestoring(false);
      }
    };

    initPromise.current = runInit();
  }, [initTree, loadDirectory]);

  // Layout save debouncing
  const {
    leftPaneWidth, folderPaneHeight, fileListSortBy, fileListSortOrder, fileListColumnOrder,
    fileListColName, fileListColSize, fileListColType, fileListColMtime,
    activeTreePrefix
  } = useLayoutStore();

  useEffect(() => {
    if (!layoutHydrated || layoutRestoring) return;
    const timer = setTimeout(() => {
      saveLayoutToStorage();
    }, 500);
    return () => clearTimeout(timer);
  }, [
    layoutHydrated, layoutRestoring, leftPaneWidth, folderPaneHeight, fileListSortBy, fileListSortOrder,
    fileListColumnOrder, fileListColName, fileListColSize, fileListColType, fileListColMtime,
    activeTreePrefix
  ]);

  // Settings save debouncing
  const settings = useSettingsStore();
  const {
    language, viewMode, binding, autoThreshold, scaleMode,
    autoSpreadCover, recursiveMedia, wrapNavigation, slideshowInterval, autoPlay
  } = settings;

  useEffect(() => {
    if (!settingsHydrated) return;
    const timer = setTimeout(() => {
      useSettingsStore.getState().saveSettings();
    }, 500);
    return () => clearTimeout(timer);
  }, [
    settingsHydrated, language, viewMode, binding, autoThreshold, scaleMode,
    autoSpreadCover, recursiveMedia, wrapNavigation, slideshowInterval, autoPlay
  ]);

  // Viewer save debouncing 
  const { currentPath, selectedPath, history, historyIndex } = useNavigationStore(
    useShallow((s) => ({
      currentPath: s.currentPath,
      selectedPath: useMediaStore.getState().selectedPath,
      history: s.history,
      historyIndex: s.historyIndex,
    }))
  );
  const favorites = useFavoriteStore((s) => s.favorites);

  useEffect(() => {
    if (!viewerHydrated || viewerRestoring) return;
    const timer = setTimeout(() => {
      saveViewerToStorage();
    }, 500);
    return () => clearTimeout(timer);
  }, [viewerHydrated, viewerRestoring, currentPath, selectedPath, history, historyIndex, favorites]);

  return null; // Side-effect only component
}
