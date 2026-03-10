import { useEffect, useRef, useState } from 'react';
import { useViewerStore, loadViewerFromStorage, saveViewerToStorage } from './stores/viewerStore';
import { useLayoutStore, loadLayoutFromStorage, saveLayoutToStorage } from './stores/layoutStore';
import { useMediaPlayerStore } from './stores/mediaPlayerStore';
import { FolderTree } from './components/FolderTree';
import { FileList } from './components/FileList';
import { MediaView } from './components/MediaView';
import { ViewerToolbar } from './components/ViewerToolbar';
import { NavigationBar } from './components/NavigationBar';
import { StatusBar } from './components/StatusBar';
import { AddressBar } from './components/AddressBar';
import { ResizableDivider } from './components/ResizableDivider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const initTree = useViewerStore((s) => s.initTree);
  const leftPaneWidth = useLayoutStore((s) => s.leftPaneWidth);
  const setLeftPaneWidth = useLayoutStore((s) => s.setLeftPaneWidth);
  const folderPaneHeight = useLayoutStore((s) => s.folderPaneHeight);
  const setFolderPaneHeight = useLayoutStore((s) => s.setFolderPaneHeight);
  const goPrev = useViewerStore((s) => s.goPrev);
  const goNext = useViewerStore((s) => s.goNext);
  const prevEntry = useViewerStore((s) => s.prevEntry);
  const nextEntry = useViewerStore((s) => s.nextEntry);
  const goBack = useViewerStore((s) => s.goBack);
  const goForward = useViewerStore((s) => s.goForward);
  const goUp = useViewerStore((s) => s.goUp);
  const goToFirst = useViewerStore((s) => s.goToFirst);
  const goToLast = useViewerStore((s) => s.goToLast);
  const previewRef = useRef<HTMLDivElement>(null);
  const isPreviewFullscreen = useLayoutStore((s) => s.isPreviewFullscreen);
  const setPreviewFullscreen = useLayoutStore((s) => s.setPreviewFullscreen);
  const loadDirectory = useViewerStore((s) => s.loadDirectory);
  const setViewMode = useLayoutStore((s) => s.setViewMode);
  const viewMode = useLayoutStore((s) => s.viewMode);
  const binding = useLayoutStore((s) => s.binding);
  const setBinding = useLayoutStore((s) => s.setBinding);
  const catalogMode = useLayoutStore((s) => s.catalogMode);
  const setCatalogMode = useLayoutStore((s) => s.setCatalogMode);
  const slideshowActive = useViewerStore((s) => s.slideshowActive);
  const setSlideshowActive = useViewerStore((s) => s.setSlideshowActive);
  const scaleMode = useLayoutStore((s) => s.scaleMode);
  const recursiveMedia = useLayoutStore((s) => s.recursiveMedia);
  const fileListSortBy = useLayoutStore((s) => s.fileListSortBy);
  const fileListSortOrder = useLayoutStore((s) => s.fileListSortOrder);
  const fileListColumnOrder = useLayoutStore((s) => s.fileListColumnOrder);
  const fileListColName = useLayoutStore((s) => s.fileListColName);
  const fileListColSize = useLayoutStore((s) => s.fileListColSize);
  const fileListColType = useLayoutStore((s) => s.fileListColType);
  const fileListColMtime = useLayoutStore((s) => s.fileListColMtime);

  useEffect(() => {
    const unsubscribe = window.reederr.onPreviewFullscreenChanged((fullscreen) => {
      setPreviewFullscreen(fullscreen);
    });
    return unsubscribe;
  }, [setPreviewFullscreen]);

  const handleToggleFullscreen = () => {
    const next = !isPreviewFullscreen;
    window.reederr.setPreviewFullscreen(next);
  };

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

      // Mute all saves immediately
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
            // Auto-reveal the restored path
            await useViewerStore.getState().revealPath(savedPath);
            // Thaw other expanded folders
            await useViewerStore.getState().initExpandedFolders();
          } catch (e) {
            console.warn('[Persistence] Directory restoration failed:', e);
          }
        }
      } catch (e) {
        console.error('[Persistence] CRITICAL: Initialization aborted due to error:', e);
      } finally {
        // Final synchronization delay to let React's state batches settle
        await new Promise(resolve => setTimeout(resolve, 500));

        useViewerStore.getState().setRestoring(false);
        useLayoutStore.getState().setRestoring(false);
        useMediaPlayerStore.getState().setRestoring(false);

        console.log('[Persistence] <<< Initialization complete. Locks RELEASED.');
      }
    };

    initPromise.current = runInit();
  }, [initTree, loadDirectory]);


  // Save layout state on changes (Debounced & Gated by Hydration + Restoring Lock)
  useEffect(() => {
    if (!layoutHydrated || layoutRestoring) return;
    const timer = setTimeout(() => {
      saveLayoutToStorage();
    }, 500);
    return () => clearTimeout(timer);
  }, [
    layoutHydrated,
    layoutRestoring,
    leftPaneWidth,
    folderPaneHeight,
    viewMode,
    binding,
    scaleMode,
    catalogMode,
    recursiveMedia,
    fileListSortBy,
    fileListSortOrder,
    fileListColumnOrder,
    fileListColName,
    fileListColSize,
    fileListColType,
    fileListColMtime,
  ]);

  // Save viewer state on changes (Debounced & Gated by Hydration + Restoring Lock)
  const currentPath = useViewerStore((s) => s.currentPath);
  const selectedPath = useViewerStore((s) => s.selectedPath);
  const history = useViewerStore((s) => s.history);
  const historyIndex = useViewerStore((s) => s.historyIndex);
  const favorites = useViewerStore((s) => s.favorites);
  const expandedPaths = useViewerStore((s) => s.expandedPaths);

  useEffect(() => {
    if (!viewerHydrated || viewerRestoring) return;
    const timer = setTimeout(() => {
      saveViewerToStorage();
    }, 500);
    return () => clearTimeout(timer);
  }, [viewerHydrated, viewerRestoring, currentPath, selectedPath, history, historyIndex, favorites, expandedPaths]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaY > 0 && nextEntry()) {
        e.preventDefault();
        goNext();
      } else if (e.deltaY < 0 && prevEntry()) {
        e.preventDefault();
        goPrev();
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [goNext, goPrev, nextEntry, prevEntry]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.key.toLowerCase();

      // Navigation & Layout
      if (e.altKey) {
        if (key === 'arrowleft') { e.preventDefault(); goBack(); }
        else if (key === 'arrowright') { e.preventDefault(); goForward(); }
        else if (key === 'arrowup') { e.preventDefault(); goUp(); }
      } else {
        // Direct Keys (Leeyes-like defaults)
        if (key === 'z' || key === 'backspace') { e.preventDefault(); goPrev(); }
        else if (key === 'x' || key === ' ' || key === 'enter') { e.preventDefault(); goNext(); }
        else if (key === 'c') { e.preventDefault(); setCatalogMode(!catalogMode); }
        else if (key === 'v') { e.preventDefault(); setViewMode(viewMode === 'single' ? 'spread' : 'single'); }
        else if (key === 'b') { e.preventDefault(); setBinding(binding === 'rtl' ? 'ltr' : 'rtl'); }
        else if (key === 's') { e.preventDefault(); setSlideshowActive(!slideshowActive); }
        else if (key === 'f' || key === 'f11') { e.preventDefault(); handleToggleFullscreen(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goBack, goForward, goUp, goPrev, goNext, setCatalogMode, catalogMode, setViewMode, viewMode, setBinding, binding, setSlideshowActive, slideshowActive]);

  useEffect(() => {
    const unsubs = [
      window.reederr.onMenuNav((action) => {
        switch (action) {
          case 'back': goBack(); break;
          case 'forward': goForward(); break;
          case 'up': goUp(); break;
          case 'first': goToFirst(); break;
          case 'prev': goPrev(); break;
          case 'next': goNext(); break;
          case 'last': goToLast(); break;
        }
      }),
      window.reederr.onMenuViewMode((mode) => {
        setViewMode(mode as 'single' | 'spread' | 'auto');
        saveLayoutToStorage();
      }),
      window.reederr.onMenuBinding((b) => {
        setBinding(b as 'rtl' | 'ltr');
        saveLayoutToStorage();
      }),
      window.reederr.onMenuSettings(() => setShowSettings(true)),
      window.reederr.onMenuFullscreen(() => handleToggleFullscreen()),
      window.reederr.onMenuOpenFile((path) => loadDirectory(path)),
      window.reederr.onMenuOpenFolder((path) => loadDirectory(path)),
      window.reederr.onMenuCopyPath(() => {
        const sel = useViewerStore.getState().selectedPath ?? useViewerStore.getState().currentPath;
        if (sel) navigator.clipboard.writeText(sel).catch(() => { });
      }),
    ];
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slideshow Timer Effect
  const slideshowInterval = useViewerStore((s) => s.slideshowInterval);

  useEffect(() => {
    if (!slideshowActive) return;
    const timer = setInterval(() => {
      goNext();
    }, slideshowInterval * 1000);
    return () => clearInterval(timer);
  }, [slideshowActive, slideshowInterval, goNext]);

  return (
    <ErrorBoundary>
      <div className={`app ${isPreviewFullscreen ? 'is-fullscreen' : ''}`}>
        {/* ヘッダー・ツールバー類 */}
        <div className="app-header-area">
          <NavigationBar />
          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
          <AddressBar />
        </div>

        <div className="app-content">
          <div
            className="app-left"
            style={{ width: leftPaneWidth, minWidth: leftPaneWidth, maxWidth: leftPaneWidth }}
          >
            <div className="app-left-panes">
              <div
                className="app-folder-pane"
                style={{ height: folderPaneHeight, minHeight: folderPaneHeight }}
              >
                <FolderTree />
              </div>
              <ResizableDivider
                orientation="vertical"
                onResize={(delta) => setFolderPaneHeight(folderPaneHeight + delta)}
              />
              <div className="app-file-pane">
                <FileList />
              </div>
            </div>
          </div>

          <ResizableDivider
            orientation="horizontal"
            onResize={(delta) => setLeftPaneWidth(leftPaneWidth + delta)}
          />

          <div
            className="app-right"
            ref={previewRef}
            onDoubleClick={handleToggleFullscreen}
            role="button"
            title="ダブルクリックで表示のみ全画面"
          >
            <ViewerToolbar />
            <MediaView />
          </div>
        </div>

        <StatusBar />
      </div>
    </ErrorBoundary>
  );
}
