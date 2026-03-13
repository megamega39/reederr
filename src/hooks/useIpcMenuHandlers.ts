import { useEffect } from 'react';
import { useNavigationStore } from '../stores/navigationStore';
import { useMediaStore } from '../stores/mediaStore';
import { useLayoutStore, saveLayoutToStorage } from '../stores/layoutStore';
import { MenuAPI } from '../services/api';
import { useShallow } from 'zustand/react/shallow';

export function useIpcMenuHandlers(
  handleToggleFullscreen: () => void,
  setShowSettings: (show: boolean) => void,
  setShowHelp: (show: boolean) => void
) {
  const { goBack, goForward, goUp, loadDirectory } = useNavigationStore(
    useShallow((s) => ({
      goBack: s.goBack,
      goForward: s.goForward,
      goUp: s.goUp,
      loadDirectory: s.loadDirectory,
    }))
  );

  const { goToFirst, goPrev, goNext, goToLast } = useMediaStore(
    useShallow((s) => ({
      goToFirst: s.goToFirst,
      goPrev: s.goPrev,
      goNext: s.goNext,
      goToLast: s.goToLast,
    }))
  );

  const { setViewMode, setBinding } = useLayoutStore(
    useShallow((s) => ({
      setViewMode: s.setViewMode,
      setBinding: s.setBinding,
    }))
  );

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
        const sel = useMediaStore.getState().selectedPath ?? useNavigationStore.getState().currentPath;
        if (sel) navigator.clipboard.writeText(sel).catch(() => { });
      }),
      MenuAPI.onMenuHelp(() => setShowHelp(true)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [goBack, goForward, goUp, goToFirst, goPrev, goNext, goToLast, loadDirectory, setViewMode, setBinding, handleToggleFullscreen, setShowSettings, setShowHelp]);
}
