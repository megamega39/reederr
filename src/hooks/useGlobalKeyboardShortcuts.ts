import { useEffect } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useShortcutStore, ShortcutAction } from '../stores/shortcutStore';

export function useGlobalKeyboardShortcuts(
  handleToggleFullscreen: () => void,
  handleToggleHelp: () => void
) {
  const viewer = useViewerStore();
  const layout = useLayoutStore();
  const { shortcuts } = useShortcutStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'F1') {
        e.preventDefault();
        handleToggleHelp();
        return;
      }

      // Create a string representation of the key combo
      const mods = [];
      if (e.ctrlKey) mods.push('ctrl');
      if (e.shiftKey) mods.push('shift');
      if (e.altKey) mods.push('alt');
      
      const key = e.key.toLowerCase();
      // Handle special naming for space to match our store
      const keyName = key === ' ' ? ' ' : key;
      const combo = mods.length > 0 ? [...mods, keyName].join('+') : keyName;

      // Find the action associated with this combo
      let foundAction: ShortcutAction | null = null;
      for (const [action, keys] of Object.entries(shortcuts)) {
        if (keys.includes(combo)) {
          foundAction = action as ShortcutAction;
          break;
        }
      }

      if (!foundAction) return;

      e.preventDefault();

      switch (foundAction) {
        case 'prevPage': viewer.goPrevPage(); break;
        case 'nextPage': viewer.goNextPage(); break;
        case 'prevFolder': viewer.prevFolder(); break;
        case 'nextFolder': viewer.nextFolder(); break;
        case 'firstPage': viewer.goToFirst(); break;
        case 'lastPage': viewer.goToLast(); break;
        case 'goUp': viewer.goUp(); break;
        case 'goBack': viewer.goBack(); break;
        case 'goForward': viewer.goForward(); break;
        case 'viewModeSingle': layout.setViewMode('single'); break;
        case 'viewModeSpread': layout.setViewMode('spread'); break;
        case 'viewModeAuto': layout.setViewMode('auto'); break;
        case 'viewModeToggle': 
          layout.setViewMode(layout.viewMode === 'single' ? 'spread' : 'single'); 
          break;
        case 'toggleBinding': 
          layout.setBinding(layout.binding === 'rtl' ? 'ltr' : 'rtl'); 
          break;
        case 'setBindingLTR': layout.setBinding('ltr'); break;
        case 'setBindingRTL': layout.setBinding('rtl'); break;
        case 'toggleFullscreen': handleToggleFullscreen(); break;
        case 'toggleSlideshow': viewer.setSlideshowActive(!viewer.slideshowActive); break;
        // Zoom and others might need implementation in layoutStore or similar
        case 'zoomIn': /* zoom in logic */ break;
        case 'zoomOut': /* zoom out logic */ break;
        case 'zoomReset': /* zoom reset logic */ break;
        case 'zoomFit': /* zoom fit logic */ break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    viewer,
    layout,
    shortcuts,
    handleToggleFullscreen
  ]);
}
