import { useEffect } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore, saveLayoutToStorage } from '../stores/layoutStore';
import { MenuAPI } from '../services/api';

export function useIpcMenuHandlers(
  handleToggleFullscreen: () => void,
  setShowSettings: (show: boolean) => void
) {
  const goBack = useViewerStore((s) => s.goBack);
  const goForward = useViewerStore((s) => s.goForward);
  const goUp = useViewerStore((s) => s.goUp);
  const goToFirst = useViewerStore((s) => s.goToFirst);
  const goPrev = useViewerStore((s) => s.goPrev);
  const goNext = useViewerStore((s) => s.goNext);
  const goToLast = useViewerStore((s) => s.goToLast);
  const loadDirectory = useViewerStore((s) => s.loadDirectory);
  const setViewMode = useLayoutStore((s) => s.setViewMode);
  const setBinding = useLayoutStore((s) => s.setBinding);

  useEffect(() => {
    const unsubs = [
      MenuAPI.onMenuNav((action) => {
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
      MenuAPI.onMenuViewMode((mode) => {
        setViewMode(mode as 'single' | 'spread' | 'auto');
        saveLayoutToStorage();
      }),
      MenuAPI.onMenuBinding((b) => {
        setBinding(b as 'rtl' | 'ltr');
        saveLayoutToStorage();
      }),
      MenuAPI.onMenuSettings(() => setShowSettings(true)),
      MenuAPI.onMenuFullscreen(() => handleToggleFullscreen()),
      MenuAPI.onMenuOpenFile((path) => loadDirectory(path)),
      MenuAPI.onMenuOpenFolder((path) => loadDirectory(path)),
      MenuAPI.onMenuCopyPath(() => {
        const sel = useViewerStore.getState().selectedPath ?? useViewerStore.getState().currentPath;
        if (sel) navigator.clipboard.writeText(sel).catch(() => { });
      }),
    ];
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Using empty array for stable mount lifecycle binding
}
