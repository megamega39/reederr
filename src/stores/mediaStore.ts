import { create } from 'zustand';
import { DirectoryEntry } from '../types';
import { normalizePath, getSortedEntries, VIDEO_EXT, AUDIO_EXT } from './viewerStore.utils';
import { AnyPath } from '../types/paths';
import { useAppStore } from './appStore';
import { useNavigationStore } from './navigationStore';
import { useSettingsStore } from './settingsStore';
import { getVisibleEntries as calcVisibleEntries } from './layoutCalculator';
import { MediaLoader } from './mediaLoader';
import { useMediaCacheStore } from './mediaCacheStore';
import { PrefetchService } from '../services/PrefetchService';

export interface MediaState {
  imageEntries: DirectoryEntry[];
  selectedPath: AnyPath | null;
  selectedPaths: AnyPath[];
  selectedPathsSet: Set<string>; // For O(1) lookups in render loop
  mediaBlobUrl: string | null;
  mediaBlobUrls: string[];
  mediaType: 'image' | 'video' | 'audio' | null;
  slideshowActive: boolean;
  lastLoadId: number;

  setImageEntries: (entries: DirectoryEntry[]) => void;
  setSelectedPath: (path: AnyPath | null) => void;
  setSelectedPaths: (paths: AnyPath[]) => void;
  setMediaBlobUrl: (url: string | null) => void;
  setMediaBlobUrls: (urls: string[]) => void;
  setMediaType: (t: 'image' | 'video' | 'audio' | null) => void;
  setSlideshowActive: (v: boolean) => void;
  loadMedia: (path: AnyPath | string) => Promise<void>;
  move: (delta: number) => void;
  goPrev: () => void;
  goNext: () => void;
  goPrevPage: () => void;
  goNextPage: () => void;
  goToFirst: () => void;
  goToLast: () => void;
  selectedEntry: () => DirectoryEntry | null;
  prevEntry: () => DirectoryEntry | null;
  nextEntry: () => DirectoryEntry | null;
  getSelectedPosition: () => { pos: number; total: number };
  getPagesPerView: () => number;
  getVisibleEntries: () => DirectoryEntry[];
}

export const useMediaStore = create<MediaState>((set, get) => ({
  imageEntries: [],
  selectedPath: null,
  selectedPaths: [],
  selectedPathsSet: new Set<string>(),
  mediaBlobUrl: null,
  mediaBlobUrls: [],
  mediaType: null,
  slideshowActive: false,
  lastLoadId: 0,

  setImageEntries: (entries: DirectoryEntry[]) => {
    const sorted = getSortedEntries(entries);
    const firstPath = sorted.length > 0 ? sorted[0].path : null;
    const visible = calcVisibleEntries(
      sorted,
      firstPath,
      useMediaCacheStore.getState().imageDimensions,
      useSettingsStore.getState()
    );
    const vPaths = visible.map(e => e.path) as AnyPath[];

    set({
      imageEntries: sorted,
      selectedPath: firstPath,
      selectedPaths: vPaths,
      selectedPathsSet: new Set(vPaths.map(p => normalizePath(p))),
    });
    
    // Prune cache based on new folder entries
    const paths = new Set(sorted.map(e => e.path));
    useMediaCacheStore.getState().pruneCache(paths);
  },

  setSelectedPath: (pathInput: string | null) => {
    const path = pathInput ? normalizePath(pathInput) : null;
    const visible = calcVisibleEntries(
      get().imageEntries,
      path,
      useMediaCacheStore.getState().imageDimensions,
      useSettingsStore.getState()
    );
    const vPaths = visible.map(e => e.path) as AnyPath[];

    set({ 
      selectedPath: path as AnyPath,
      selectedPaths: vPaths,
      selectedPathsSet: new Set(vPaths.map(p => normalizePath(p)))
    });
  },

  setSelectedPaths: (pathsInput: string[]) => {
    const normPaths = pathsInput.map(p => normalizePath(p));
    set({ 
      selectedPaths: normPaths as AnyPath[],
      selectedPathsSet: new Set(normPaths)
    });
  },
  setMediaBlobUrl: (url: string | null) => set({ mediaBlobUrl: url }),
  setMediaBlobUrls: (urls: string[]) => set({ mediaBlobUrls: urls }),
  setMediaType: (t: 'image' | 'video' | 'audio' | null) => set({ mediaType: t }),
  
  setSlideshowActive: (v: boolean) => set({ slideshowActive: v }),

  loadMedia: async (pathInput: AnyPath | string) => {
    if (!pathInput) return;
    const path = normalizePath(pathInput);
    const navStore = useNavigationStore.getState();
    const appStore = useAppStore.getState();
    const cacheStore = useMediaCacheStore.getState();
    
    const currentId = get().lastLoadId + 1;
    set({ lastLoadId: currentId });

    const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
    const isVideo = VIDEO_EXT.includes(ext);
    const isAudio = AUDIO_EXT.includes(ext);
    const isImage = !isVideo && !isAudio;
    const nextMediaType = isVideo ? 'video' : (isAudio ? 'audio' : 'image');
    
    const prevMediaType = get().mediaType;
    const oldUrl = get().mediaBlobUrl;
    const oldUrls = get().mediaBlobUrls;

    appStore.setError(null);

    // Speed optimization: Only clear media if explicitly changing types or if it's a new video/audio
    // This prevents the "blank flash" and redundant cleanup latency for rapid switching
    if (nextMediaType !== prevMediaType || isVideo || isAudio) {
      set({ 
        mediaType: nextMediaType, 
        mediaBlobUrl: null, 
        mediaBlobUrls: [],
        // Keep selectedPaths for images, but clear for video/audio to avoid mixed state
        selectedPaths: isImage ? get().selectedPaths : [path as AnyPath],
        selectedPathsSet: isImage ? get().selectedPathsSet : new Set([path])
      });
    }

    appStore.setLoading((isVideo || isAudio) && useSettingsStore.getState().autoPlay);

    try {
      const { MediaAPI } = await import('../services/api');

      if (isVideo || isAudio) {
        const res = await MediaAPI.getMediaUrl(path as string, true);
        
        if (get().lastLoadId !== currentId) {
          if (res.ok && res.value?.startsWith('media://')) {
            MediaAPI.releaseMediaUrl(res.value);
          }
          return;
        }

        if (!res.ok) {
           appStore.setLoading(false);
           appStore.setError(res.error);
           return;
        }
        
        const url = res.value;
        if (oldUrl && oldUrl.startsWith('media://')) {
          MediaAPI.releaseMediaUrl(oldUrl);
        }
        if (oldUrls.length > 0) {
          oldUrls.filter(u => u.startsWith('media://')).forEach(u => MediaAPI.releaseMediaUrl(u));
        }

        set({ mediaBlobUrl: url, mediaBlobUrls: [], mediaType: nextMediaType });
        appStore.setLoading(false);
      } else {
        const visible = get().getVisibleEntries();
        const visiblePaths = visible.map(e => e.path);

        // Instant update from cache if available
        const cachedUrls = visiblePaths.map(p => cacheStore.getMediaUrl(p)).filter(Boolean) as string[];
        if (cachedUrls.length > 0 && cachedUrls.length === visiblePaths.length) {
          if (get().lastLoadId === currentId) {
            const currentPaths = get().selectedPaths;
            const needsSync = currentPaths.length <= 1 || !currentPaths.includes(path);
            const nextPaths = (needsSync ? visiblePaths : currentPaths) as AnyPath[];
            set({
              mediaBlobUrl: cachedUrls[0],
              mediaBlobUrls: cachedUrls,
              mediaType: 'image',
              selectedPaths: nextPaths,
              selectedPathsSet: new Set(nextPaths.map(p => normalizePath(p))),
            });
          }
        }

        const res = await MediaAPI.getMediaUrls(visiblePaths as string[], true);
        if (get().lastLoadId !== currentId) return;

        if (!res.ok) {
           appStore.setError(res.error);
           return;
        }
        const urls = res.value;
        
        // Update cache
        urls.forEach((url, i) => { if (url) cacheStore.setMediaUrl(visiblePaths[i], url); });

        // Wait for decode only for the primary image
        if (urls.length > 0) await MediaLoader.decodeImage(urls[0]);

        if (get().lastLoadId !== currentId) return;

        if (oldUrl && oldUrl.startsWith('media://')) {
          const { MediaAPI } = await import('../services/api');
          MediaAPI.releaseMediaUrl(oldUrl);
        }
        if (oldUrls.length > 0) {
          const { MediaAPI } = await import('../services/api');
          oldUrls.filter(u => u.startsWith('media://')).forEach(u => MediaAPI.releaseMediaUrl(u));
        }

        const currentPaths = get().selectedPaths;
        const visiblePathsStr = JSON.stringify(visiblePaths);
        const currentPathsStr = JSON.stringify(currentPaths);
        const needsSync = visiblePathsStr !== currentPathsStr || !currentPaths.includes(path as AnyPath);

        const nextPaths = (needsSync ? visiblePaths : currentPaths) as AnyPath[];
        set({ 
          mediaBlobUrl: urls[0] ?? null, 
          mediaBlobUrls: urls, 
          mediaType: 'image', 
          selectedPaths: nextPaths,
          selectedPathsSet: new Set(nextPaths.map(p => normalizePath(p))),
        });
        
        urls.forEach((url: string, i: number) => cacheStore.ensureImageDimension(visiblePaths[i], url));
      }

      // Preloading logic (delegated to PrefetchService)
      const allEntries = isVideo || isAudio ? navStore.entries : get().imageEntries;
      const pagesPerView = isImage ? get().getPagesPerView() : 1;
       PrefetchService.startPrefetch(
        path as string,
        allEntries as any[],
        pagesPerView,
        () => get().lastLoadId !== currentId
      );

    } catch (err) {
      if (get().lastLoadId === currentId) {
        appStore.setLoading(false);
        appStore.setError(err instanceof Error ? err.message : String(err));
        set({ mediaType: null, mediaBlobUrl: null, mediaBlobUrls: [] });
      }
    }
  },

  move: (delta: number) => {
    const { imageEntries: sorted, selectedPath } = get();
    const { wrapNavigation } = useSettingsStore.getState();
    const len = sorted.length;
    if (len === 0) return;
    const idx = sorted.findIndex((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(selectedPath ?? ''));
    const cur = idx < 0 ? 0 : idx;
    
    if (!wrapNavigation) {
      if (delta > 0 && cur === len - 1) {
        useNavigationStore.getState().nextFolder();
        return;
      }
      if (delta < 0 && cur === 0) {
        useNavigationStore.getState().prevFolder();
        return;
      }
    }

    let newIdx: number;
    if (wrapNavigation) newIdx = ((cur + delta) % len + len) % len;
    else newIdx = Math.max(0, Math.min(len - 1, cur + delta));
    
    if (newIdx < 0 || newIdx >= len) return;
    const entry = sorted[newIdx];
    if (normalizePath(entry.path) === normalizePath(selectedPath ?? '')) return;
    get().setSelectedPath(entry.path);
    get().loadMedia(entry.path);
  },

  goPrev: () => get().move(-1),
  goNext: () => get().move(1),
  goPrevPage: () => get().move(-get().getPagesPerView()),
  goNextPage: () => get().move(get().getPagesPerView()),
  goToFirst: () => {
    const { imageEntries: sorted } = get();
    if (sorted.length > 0) { get().setSelectedPath(sorted[0].path); get().loadMedia(sorted[0].path); }
  },
  goToLast: () => {
    const { imageEntries: sorted } = get();
    if (sorted.length > 0) { get().setSelectedPath(sorted[sorted.length - 1].path); get().loadMedia(sorted[sorted.length - 1].path); }
  },

  selectedEntry: () => get().imageEntries.find((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(get().selectedPath ?? '')) ?? null,
  
  prevEntry: () => {
    const { imageEntries: sorted } = get();
    const { wrapNavigation } = useSettingsStore.getState();
    if (sorted.length === 0) return null;
    const idx = sorted.findIndex((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(get().selectedPath ?? ''));
    const cur = idx < 0 ? 0 : idx;
    const len = sorted.length;
    let newIdx = wrapNavigation ? (cur - 1 + len) % len : Math.max(0, cur - 1);
    return newIdx === cur ? null : sorted[newIdx];
  },
  
  nextEntry: () => {
    const { imageEntries: sorted } = get();
    const { wrapNavigation } = useSettingsStore.getState();
    if (sorted.length === 0) return null;
    const idx = sorted.findIndex((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(get().selectedPath ?? ''));
    const cur = idx < 0 ? 0 : idx;
    const len = sorted.length;
    const step = get().getVisibleEntries().length;
    let newIdx = wrapNavigation ? (cur + step) % len : Math.min(len - 1, cur + step);
    return newIdx === cur ? null : sorted[newIdx];
  },

  getSelectedPosition: () => {
    const { imageEntries: sorted } = get();
    const idx = sorted.findIndex((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(get().selectedPath ?? ''));
    return { pos: idx >= 0 ? idx + 1 : 0, total: sorted.length };
  },

  getPagesPerView: () => get().getVisibleEntries().length || 1,

  getVisibleEntries: () => {
    return calcVisibleEntries(
      get().imageEntries,
      get().selectedPath,
      useMediaCacheStore.getState().imageDimensions,
      useSettingsStore.getState()
    );
  },
}));

// Synchronize with settings changes synchronously to prevent flicker during View Mode switching
useSettingsStore.subscribe((state, prevState) => {
  const needsSync = 
    state.viewMode !== prevState.viewMode ||
    state.binding !== prevState.binding ||
    state.autoSpreadCover !== prevState.autoSpreadCover;

  if (needsSync) {
    const store = useMediaStore.getState();
    if (store.mediaType === 'image' && store.selectedPath) {
      const visible = store.getVisibleEntries();
      const nextPaths = visible.map(e => e.path) as AnyPath[];
      useMediaStore.setState({
        selectedPaths: nextPaths,
        selectedPathsSet: new Set(nextPaths.map(p => normalizePath(p))),
      });
    }
  }
});
