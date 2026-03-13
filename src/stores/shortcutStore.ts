import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ShortcutAction =
  | 'prevPage'
  | 'nextPage'
  | 'prevFolder'
  | 'nextFolder'
  | 'firstPage'
  | 'lastPage'
  | 'goUp'
  | 'goBack'
  | 'goForward'
  | 'toggleCatalog'
  | 'viewModeSingle'
  | 'viewModeSpread'
  | 'viewModeAuto'
  | 'viewModeToggle'
  | 'toggleBinding'
  | 'setBindingLTR'
  | 'setBindingRTL'
  | 'toggleFullscreen'
  | 'toggleSlideshow'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'
  | 'zoomFit';

export interface ShortcutConfig {
  keys: string[];
  label: string;
}

interface ShortcutState {
  shortcuts: Record<ShortcutAction, string[]>;
  setShortcut: (action: ShortcutAction, keys: string[]) => void;
  resetToDefault: () => void;
}

const DEFAULT_SHORTCUTS: Record<ShortcutAction, string[]> = {
  prevPage: ['z', 'backspace', 'arrowleft', 'shift+ '],
  nextPage: ['x', ' ', 'enter', 'arrowright'],
  prevFolder: ['pageup'],
  nextFolder: ['pagedown'],
  firstPage: ['home'],
  lastPage: ['end'],
  goUp: ['u', 'alt+arrowup'],
  goBack: ['alt+arrowleft'],
  goForward: ['alt+arrowright'],
  toggleCatalog: ['c'],
  viewModeSingle: ['1'],
  viewModeSpread: ['2'],
  viewModeAuto: ['3'],
  viewModeToggle: ['v'],
  toggleBinding: ['b'],
  setBindingLTR: ['l'],
  setBindingRTL: ['r'],
  toggleFullscreen: ['f', 'f11'],
  toggleSlideshow: ['s'],
  zoomIn: ['ctrl+=', 'ctrl+shift+='],
  zoomOut: ['ctrl+-'],
  zoomReset: ['ctrl+0'],
  zoomFit: ['w', 'ctrl+shift+0'],
};

export const ACTION_LABELS: Record<ShortcutAction, string> = {
  prevPage: '前のページ',
  nextPage: '次のページ',
  prevFolder: '前のフォルダ',
  nextFolder: '次のフォルダ',
  firstPage: '最初のページ',
  lastPage: '最後のページ',
  goUp: '上の階層へ',
  goBack: '履歴：戻る',
  goForward: '履歴：進む',
  toggleCatalog: 'カタログ表示切替',
  viewModeSingle: '1ページ表示',
  viewModeSpread: '見開き表示',
  viewModeAuto: '自動見開き',
  viewModeToggle: '単ページ/見開き切替',
  toggleBinding: '綴じ方向切替',
  setBindingLTR: '左綴じに設定',
  setBindingRTL: '右綴じに設定',
  toggleFullscreen: '全画面切替',
  toggleSlideshow: 'スライドショー切替',
  zoomIn: '拡大',
  zoomOut: '縮小',
  zoomReset: '等倍表示',
  zoomFit: 'ウィンドウに合わせる',
};

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set) => ({
      shortcuts: { ...DEFAULT_SHORTCUTS },
      setShortcut: (action, keys) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [action]: keys.map(k => k.toLowerCase()) },
        })),
      resetToDefault: () => set({ shortcuts: { ...DEFAULT_SHORTCUTS } }),
    }),
    {
      name: 'reederr-shortcuts',
    }
  )
);
