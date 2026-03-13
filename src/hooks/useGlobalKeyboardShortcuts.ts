import { useEffect } from 'react';
import { useNavigationStore } from '../stores/navigationStore';
import { useMediaStore } from '../stores/mediaStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useShortcutStore, ShortcutAction } from '../stores/shortcutStore';

export function useGlobalKeyboardShortcuts(
  handleToggleFullscreen: () => void,
  handleToggleHelp: () => void
) {
  const nav = useNavigationStore();
  const media = useMediaStore();
  const settings = useSettingsStore();
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
        case 'prevPage': media.goPrevPage(); break;
        case 'nextPage': media.goNextPage(); break;
        case 'prevFolder': nav.prevFolder(); break;
        case 'nextFolder': nav.nextFolder(); break;
        case 'firstPage': media.goToFirst(); break;
        case 'lastPage': media.goToLast(); break;
        case 'goUp': nav.goUp(); break;
        case 'goBack': nav.goBack(); break;
        case 'goForward': nav.goForward(); break;
        case 'viewModeSingle': settings.setViewMode('single'); break;
        case 'viewModeSpread': settings.setViewMode('spread'); break;
        case 'viewModeAuto': settings.setViewMode('auto'); break;
        case 'viewModeToggle': 
          settings.setViewMode(settings.viewMode === 'single' ? 'spread' : 'single'); 
          break;
        case 'toggleBinding': 
          settings.setBinding(settings.binding === 'rtl' ? 'ltr' : 'rtl'); 
          break;
        case 'setBindingLTR': settings.setBinding('ltr'); break;
        case 'setBindingRTL': settings.setBinding('rtl'); break;
        case 'toggleFullscreen': handleToggleFullscreen(); break;
        case 'toggleSlideshow': media.setSlideshowActive(!media.slideshowActive); break;
        // Zoom and others might need implementation in layoutStore or similar
        // TODO: Implement zoom logic in layoutStore (needs coordination with Renderer/CSS Zoom)
        case 'zoomIn': /* zoom in logic */ break;
        case 'zoomOut': /* zoom out logic */ break;
        case 'zoomReset': /* zoom reset logic */ break;
        case 'zoomFit': /* zoom fit logic */ break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    nav,
    media,
    settings,
    shortcuts,
    handleToggleFullscreen,
    handleToggleHelp
  ]);
}
