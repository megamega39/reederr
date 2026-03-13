import { useEffect, useState, useCallback } from 'react';
import { useViewerStore } from './stores/viewerStore';
import { useLayoutStore } from './stores/layoutStore';
import { useSettingsStore } from './stores/settingsStore';
import { ResizableDivider } from './components/ResizableDivider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PersistenceManager } from './components/PersistenceManager';
import { ToastContainer } from './components/ToastContainer';
import { HoverPreview } from './components/HoverPreview';
import { StatusBar } from './components/StatusBar';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useIpcMenuHandlers } from './hooks/useIpcMenuHandlers';
import { useSystemNotifications } from './hooks/useSystemNotifications';
import { MediaAPI } from './services/api';

// Islands
import { AppHeader } from './components/layout/AppHeader';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppMainView } from './components/layout/AppMainView';

import styles from './App.module.css';
import './styles/variables.css';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // High-frequency state extracted to sub-components
  const setLeftPaneWidth = useLayoutStore((s) => s.setLeftPaneWidth);
  const leftPaneWidth = useLayoutStore((s) => s.leftPaneWidth); 
  const isPreviewFullscreen = useLayoutStore((s) => s.isPreviewFullscreen);
  const setPreviewFullscreen = useLayoutStore((s) => s.setPreviewFullscreen);

  useEffect(() => {
    const unsubscribe = MediaAPI.onPreviewFullscreenChanged((fullscreen) => {
      setPreviewFullscreen(fullscreen);
    });
    return unsubscribe;
  }, [setPreviewFullscreen]);

  useSystemNotifications();

  const handleToggleFullscreen = useCallback(() => {
    MediaAPI.setPreviewFullscreen(!useLayoutStore.getState().isPreviewFullscreen);
  }, []);

  useGlobalKeyboardShortcuts(handleToggleFullscreen, () => setShowHelp(prev => !prev));
  useIpcMenuHandlers(handleToggleFullscreen, setShowSettings, setShowHelp);

  // Slideshow Logic
  const goNext = useViewerStore((s) => s.goNext);
  const slideshowActive = useViewerStore((s) => s.slideshowActive);
  const slideshowInterval = useSettingsStore((s) => s.slideshowInterval);

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
        <AppHeader 
          showSettings={showSettings} 
          setShowSettings={setShowSettings}
          showHelp={showHelp}
          setShowHelp={setShowHelp}
        />

        <div className={styles.appContent}>
          <AppSidebar />

          <ResizableDivider
            orientation="horizontal"
            onResize={(delta) => setLeftPaneWidth(leftPaneWidth + delta)}
          />

          <AppMainView />
        </div>

        <div className={styles.statusBarWrapper}>
          <StatusBar />
        </div>
        
        <HoverPreview />
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}
