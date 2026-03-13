import { create } from 'zustand';
import { DirectoryEntry } from '../types';
import { normalizePath, getSortedEntries, VIDEO_EXT, AUDIO_EXT } from './viewerStore.utils';
import { useAppStore } from './appStore';
import { useNavigationStore } from './navigationStore';
import { useSettingsStore } from './settingsStore';
import { getVisibleEntries as calcVisibleEntries } from './layoutCalculator';
import { MediaLoader } from './mediaLoader';

export interface MediaState {
  imageEntries: DirectoryEntry[];
  selectedPath: string | null;
  selectedPaths: string[];
  mediaBlobUrl: string | null;
  mediaBlobUrls: string[];
  mediaType: 'image' | 'video' | 'audio' | null;
  imageDimensions: Record<string, { w: number; h: number }>;
  mediaUrlCache: Record<string, string>;
  slideshowActive: boolean;
  lastLoadId: number;

  setImageEntries: (entries: DirectoryEntry[]) => void;
  setSelectedPath: (path: string | null) => void;
  setSelectedPaths: (paths: string[]) => void;
  setMediaBlobUrl: (url: string | null) => void;
  setMediaBlobUrls: (urls: string[]) => void;
  setMediaType: (t: 'image' | 'video' | 'audio' | null) => void;
  ensureImageDimension: (path: string, url: string) => void;
  setImageDimensions: (path: string, dims: { w: number; h: number }) => void;
  setSlideshowActive: (v: boolean) => void;
  loadMedia: (path: string) => Promise<void>;
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
  pruneCache: () => void;
}

// No internalState needed as we moved it to store state (lastLoadId)

export const useMediaStore = create<MediaState>((set, get) => ({
  imageEntries: [],
  selectedPath: null,
  selectedPaths: [],
  mediaBlobUrl: null,
  mediaBlobUrls: [],
  mediaType: null,
  imageDimensions: {},
  mediaUrlCache: {},
  slideshowActive: false,
  lastLoadId: 0,

  setImageEntries: (entries: DirectoryEntry[]) => {
    const sorted = getSortedEntries(entries);
    set({
      imageEntries: sorted,
      selectedPath: sorted.length > 0 ? sorted[0].path : null,
      selectedPaths: sorted.length > 0 ? [sorted[0].path] : [],
    });
    get().pruneCache();
  },
  setSelectedPath: (path: string | null) =>
    set({
      selectedPath: path,
    }),
  setSelectedPaths: (paths: string[]) => set({ selectedPaths: paths }),
  setMediaBlobUrl: (url: string | null) => set({ mediaBlobUrl: url }),
  setMediaBlobUrls: (urls: string[]) => set({ mediaBlobUrls: urls }),
  setMediaType: (t: 'image' | 'video' | 'audio' | null) => set({ mediaType: t }),
  
  ensureImageDimension: (path: string, url: string) => {
    const { imageDimensions, setImageDimensions } = get();
    if (imageDimensions[path]) return;
    const img = new Image();
    img.onload = () => {
      setImageDimensions(path, { w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
  },

  setImageDimensions: (path: string, dims: { w: number; h: number }) => {
    const current = get().imageDimensions[path];
    if (current && current.w === dims.w && current.h === dims.h) return;
    set((s) => ({ imageDimensions: { ...s.imageDimensions, [path]: dims } }));
  },
    
  setSlideshowActive: (v: boolean) => set({ slideshowActive: v }),

  loadMedia: async (path: string) => {
    if (!path) return;
    const navStore = useNavigationStore.getState();
    const appStore = useAppStore.getState();
    
    // Increment local ID for this specific load call
    const currentId = get().lastLoadId + 1;
    set({ lastLoadId: currentId });

    const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
    const isVideo = VIDEO_EXT.includes(ext);
    const isAudio = AUDIO_EXT.includes(ext);
    const isImage = !isVideo && !isAudio;
    const nextMediaType = isVideo ? 'video' : (isAudio ? 'audio' : 'image');
    const oldUrl = get().mediaBlobUrl;
    const oldUrls = get().mediaBlobUrls;

    // Reset error state
    appStore.setError(null);

    // If it's a video/audio, show loading spinner immediately.
    // If it's an image, we usually want immediate display from cache if possible,
    // so we don't set loading to true yet.
    // Eagerly update mediaType and clear old content so the UI switches to the correct view immediately.
    // We only do this if the type has changed OR if it's a video/audio (to show loading).
    // For images, we try to preserve the previous image until the new one is ready if it's fluid navigation.
    if (nextMediaType !== get().mediaType || isVideo || isAudio) {
      set({ 
        mediaType: nextMediaType, 
        mediaBlobUrl: null, 
        mediaBlobUrls: [],
        selectedPaths: isImage ? get().selectedPaths : [] 
      });
    }

    if (isVideo || isAudio) {
      appStore.setLoading(true);
    } else {
      appStore.setLoading(false);
    }

    try {
      const { MediaAPI } = await import('../services/api');

      if (isVideo || isAudio) {
        const res = await MediaAPI.getMediaUrl(path, true);
        
        // Guard check: only proceed if this is still the latest request
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

        set({ 
          mediaBlobUrl: url, 
          mediaBlobUrls: [], 
          mediaType: nextMediaType 
        });
        appStore.setLoading(false);
      } else {
        const visible = get().getVisibleEntries();
        const visiblePaths = visible.map(e => e.path);

        // Instant update from cache if available
        const cache = get().mediaUrlCache;
        const cachedUrls = visiblePaths.map(p => cache[p]).filter(Boolean);
        if (cachedUrls.length > 0 && cachedUrls.length === visiblePaths.length) {
          if (get().lastLoadId === currentId) {
            const currentPaths = get().selectedPaths;
            const needsSync = currentPaths.length <= 1 || !currentPaths.includes(path);
            set({
              mediaBlobUrl: cachedUrls[0],
              mediaBlobUrls: cachedUrls,
              mediaType: 'image',
              selectedPaths: needsSync ? visiblePaths : currentPaths,
            });
          }
          // We don't return here so we can still verify with backend/prefetch
        }
        const res = await MediaAPI.getMediaUrls(visiblePaths, true);
        
        // Guard check
        if (get().lastLoadId !== currentId) return;

        if (!res.ok) {
           appStore.setError(res.error);
           return;
        }
        const urls = res.value;
        
        // Update cache
        const newCache = { ...get().mediaUrlCache };
        urls.forEach((url, i) => { if (url) newCache[visiblePaths[i]] = url; });
        set({ mediaUrlCache: newCache });

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
        const needsSync = currentPaths.length <= 1 || !currentPaths.includes(path);

        set({ 
          mediaBlobUrl: urls[0] ?? null, 
          mediaBlobUrls: urls, 
          mediaType: 'image', 
          selectedPaths: needsSync ? visiblePaths : currentPaths,
        });
        
        urls.forEach((url: string, i: number) => get().ensureImageDimension(visiblePaths[i], url));
      }

      // Preloading logic
      const allEntries = isVideo || isAudio ? navStore.entries : get().imageEntries;
      const curIdx = allEntries.findIndex((e: DirectoryEntry) => e.path === path);
      if (curIdx >= 0 && get().lastLoadId === currentId) {
        const pagesPerView = isImage ? get().getPagesPerView() : 1;
        const preloadLookahead = pagesPerView * 15; 
        const preloadLookbehind = pagesPerView * 5; 

        const preloads: DirectoryEntry[] = [];
        for (let i = pagesPerView; i < pagesPerView + preloadLookahead; i++) {
          const idx = curIdx + i;
          if (idx < allEntries.length) preloads.push(allEntries[idx]);
        }
        for (let i = 1; i <= preloadLookbehind; i++) {
          const idx = curIdx - i;
          if (idx >= 0) preloads.push(allEntries[idx]);
        }

        const checkCancelled = () => get().lastLoadId !== currentId;

        for (let i = 0; i < preloads.length; i += 5) {
          MediaLoader.preloadBatch(
            preloads.slice(i, i + 5),
            (p, url) => {
               const cache = get().mediaUrlCache;
               if (!cache[p]) set(s => ({ mediaUrlCache: { ...s.mediaUrlCache, [p]: url } }));
            },
            (p, url) => get().ensureImageDimension(p, url),
            checkCancelled
          );
        }
      }
    } catch (err) {
      if (get().lastLoadId === currentId) {
        appStore.setLoading(false);
        appStore.setError(err instanceof Error ? err.message : String(err));
        // Reset mediaType to null on fatal error to avoid stuck UI
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
  goPrevPage: () => {
    const step = get().getPagesPerView();
    get().move(-step);
  },
  goNextPage: () => {
    const step = get().getPagesPerView();
    get().move(step);
  },
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

  getPagesPerView: () => {
    const visible = get().getVisibleEntries();
    return visible.length || 1;
  },

  getVisibleEntries: () => {
    return calcVisibleEntries(
      get().imageEntries,
      get().selectedPath,
      get().imageDimensions,
      useSettingsStore.getState()
    );
  },

  pruneCache: () => {
    const { imageEntries, imageDimensions, mediaUrlCache } = get();
    if (Object.keys(mediaUrlCache).length < 500) return;

    const entryPaths = new Set(imageEntries.map(e => e.path));
    const nextDim = { ...imageDimensions };
    const nextCache = { ...mediaUrlCache };
    let changed = false;

    Object.keys(nextDim).forEach(p => {
      if (!entryPaths.has(p)) { delete nextDim[p]; changed = true; }
    });
    Object.keys(nextCache).forEach(p => {
      if (!entryPaths.has(p)) { delete nextCache[p]; changed = true; }
    });

    if (changed) set({ imageDimensions: nextDim, mediaUrlCache: nextCache });
  },
}));
