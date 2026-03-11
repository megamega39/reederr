import { useEffect, useRef, useState } from 'react';
import { useViewerStore } from './stores/viewerStore';
import { useLayoutStore } from './stores/layoutStore';
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
import { PersistenceManager } from './components/PersistenceManager';
import { ToastContainer } from './components/ToastContainer';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useIpcMenuHandlers } from './hooks/useIpcMenuHandlers';
import { useSystemNotifications } from './hooks/useSystemNotifications';
import { MediaAPI } from './services/api';
import styles from './App.module.css';
import './styles/variables.css';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const leftPaneWidth = useLayoutStore((s) => s.leftPaneWidth);
  const setLeftPaneWidth = useLayoutStore((s) => s.setLeftPaneWidth);
  const folderPaneHeight = useLayoutStore((s) => s.folderPaneHeight);
  const setFolderPaneHeight = useLayoutStore((s) => s.setFolderPaneHeight);
  
  // Navigation actions (slideshow uses goNext)
  const goNext = useViewerStore((s) => s.goNext);
  const prevEntry = useViewerStore((s) => s.prevEntry);
  const nextEntry = useViewerStore((s) => s.nextEntry);
  const goPrevPage = useViewerStore((s) => s.goPrevPage);
  const goNextPage = useViewerStore((s) => s.goNextPage);
  const slideshowActive = useViewerStore((s) => s.slideshowActive);

  const previewRef = useRef<HTMLDivElement>(null);
  
  const isPreviewFullscreen = useLayoutStore((s) => s.isPreviewFullscreen);
  const setPreviewFullscreen = useLayoutStore((s) => s.setPreviewFullscreen);

  useEffect(() => {
    const unsubscribe = MediaAPI.onPreviewFullscreenChanged((fullscreen) => {
      setPreviewFullscreen(fullscreen);
    });
    return unsubscribe;
  }, [setPreviewFullscreen]);

  // Listen for system-level notifications (toasts from main process)
  useSystemNotifications();

  const handleToggleFullscreen = () => {
    const next = !isPreviewFullscreen;
    MediaAPI.setPreviewFullscreen(next);
  };

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaY > 0 && nextEntry()) {
        e.preventDefault();
        goNextPage();
      } else if (e.deltaY < 0 && prevEntry()) {
        e.preventDefault();
        goPrevPage();
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [goNextPage, goPrevPage, nextEntry, prevEntry]);

  useGlobalKeyboardShortcuts(handleToggleFullscreen);
  useIpcMenuHandlers(handleToggleFullscreen, setShowSettings);

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
      <PersistenceManager />
      <div className={`${styles.app} ${isPreviewFullscreen ? styles.appPreviewFullscreen : ''}`}>
        {/* ヘッダー・ツールバー類 */}
        <div className={styles.appHeaderArea}>
          <NavigationBar />
          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
          <AddressBar />
        </div>

      <div className={styles.appContent}>
        <div
          className={styles.appLeft}
          style={{ width: leftPaneWidth, minWidth: leftPaneWidth, maxWidth: leftPaneWidth }}
        >
          <div className={styles.appLeftPanes}>
            <div
              className={styles.appFolderPane}
              style={{ height: folderPaneHeight, minHeight: folderPaneHeight }}
            >
                <FolderTree />
              </div>
              <ResizableDivider
                orientation="vertical"
                onResize={(delta) => setFolderPaneHeight(folderPaneHeight + delta)}
              />
              <div className={styles.appFilePane}>
                <FileList />
              </div>
            </div>
          </div>

          <ResizableDivider
            orientation="horizontal"
            onResize={(delta) => setLeftPaneWidth(leftPaneWidth + delta)}
          />

          <div
            className={styles.appRight}
            ref={previewRef}
            onDoubleClick={handleToggleFullscreen}
            role="button"
            title="ダブルクリックで表示のみ全画面"
          >
            <ViewerToolbar />
            <MediaView />
          </div>
        </div>

        <div className={styles.statusBarWrapper}>
          <StatusBar />
        </div>
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}
