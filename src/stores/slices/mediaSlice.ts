import { StateCreator } from 'zustand';
import { ViewerState } from '../viewerStore.types';
import { normalizePath, getSortedEntries } from '../viewerStore.utils';
import { useLayoutStore } from '../layoutStore';
import { DirectoryEntry } from '../../types';

export interface MediaSlice {
  entries: ViewerState['entries'];
  imageEntries: ViewerState['imageEntries'];
  selectedPath: ViewerState['selectedPath'];
  selectedPaths: ViewerState['selectedPaths'];
  mediaBlobUrl: ViewerState['mediaBlobUrl'];
  mediaBlobUrls: ViewerState['mediaBlobUrls'];
  mediaType: ViewerState['mediaType'];
  currentLoadId: ViewerState['currentLoadId'];
  isLoading: ViewerState['isLoading'];
  error: ViewerState['error'];
  imageDimensions: ViewerState['imageDimensions'];
  wrapNavigation: ViewerState['wrapNavigation'];
  slideshowActive: ViewerState['slideshowActive'];
  slideshowInterval: ViewerState['slideshowInterval'];
  
  setEntries: ViewerState['setEntries'];
  setImageEntries: (entries: DirectoryEntry[]) => void;
  setWrapNavigation: (v: boolean) => void;
  setSelectedPath: (path: string | null) => void;
  setSelectedPaths: (paths: string[]) => void;
  setMediaBlobUrl: (url: string | null) => void;
  setMediaBlobUrls: (urls: string[]) => void;
  setMediaType: (t: 'image' | 'video' | 'audio' | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  ensureImageDimension: (path: string, url: string) => void;
  setImageDimensions: (path: string, dims: { w: number; h: number }) => void;
  setSlideshowActive: (v: boolean) => void;
  setSlideshowInterval: (v: number) => void;
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
}

export const createMediaSlice: StateCreator<
  ViewerState,
  [],
  [],
  MediaSlice
> = (set, get) => ({
  entries: [],
  imageEntries: [],
  selectedPath: null,
  selectedPaths: [],
  mediaBlobUrl: null,
  mediaBlobUrls: [],
  mediaType: null,
  currentLoadId: 0,
  isLoading: false,
  error: null,
  imageDimensions: {},
  wrapNavigation: true,
  slideshowActive: false,
  slideshowInterval: 3,

  setEntries: (entries: DirectoryEntry[]) => set({ entries }),
  setImageEntries: (entries: DirectoryEntry[]) =>
    set({
      imageEntries: entries,
      selectedPath: entries.length > 0 ? entries[0].path : null,
      selectedPaths: entries.length > 0 ? [entries[0].path] : [],
    }),
  setWrapNavigation: (v: boolean) => set({ wrapNavigation: v }),
  setSelectedPath: (path: string | null) =>
    set({
      selectedPath: path,
      selectedPaths: path ? [path] : [],
    }),
  setSelectedPaths: (paths: string[]) => set({ selectedPaths: paths }),
  setMediaBlobUrl: (url: string | null) => set({ mediaBlobUrl: url }),
  setMediaBlobUrls: (urls: string[]) => set({ mediaBlobUrls: urls }),
  setMediaType: (t: 'image' | 'video' | 'audio' | null) => set({ mediaType: t }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
  
  ensureImageDimension: (path: string, url: string) => {
    const { imageDimensions, setImageDimensions } = get();
    if (imageDimensions[path]) return;
    const img = new Image();
    img.onload = () => {
      setImageDimensions(path, { w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
  },

  setImageDimensions: (path: string, dims: { w: number; h: number }) =>
    set((s: ViewerState) => ({ imageDimensions: { ...s.imageDimensions, [path]: dims } })),
    
  setSlideshowActive: (v: boolean) => set({ slideshowActive: v }),
  setSlideshowInterval: (v: number) => set({ slideshowInterval: Math.max(1, v) }),

  loadMedia: async (path: string) => {
    if (!path) return;
    const loadId = Math.random();
    set({ currentLoadId: loadId });

    const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
    const videoExt = ['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v'];
    const audioExt = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
    const isVideo = videoExt.includes(ext);
    const isAudio = audioExt.includes(ext);
    const isImage = !isVideo && !isAudio;

    const createUrl = (p: string) => `reederr://get-media?path=${encodeURIComponent(p)}`;

    try {
      const oldUrl = get().mediaBlobUrl;
      const { MediaAPI } = await import('../../services/api');

      if (isVideo || isAudio) {
        set({ isLoading: true });
        const url = await MediaAPI.getMediaUrl(path);
        if (get().currentLoadId !== loadId) {
          if (url.startsWith('media://')) MediaAPI.releaseMediaUrl(url);
          return;
        }
        
        // Release old temp file if it was a media:// URL
        if (oldUrl && oldUrl.startsWith('media://')) {
          MediaAPI.releaseMediaUrl(oldUrl);
        }

        set({ mediaBlobUrl: url, mediaBlobUrls: [], mediaType: isVideo ? 'video' : 'audio', error: null, isLoading: false });
      } else {
        const visible = get().getVisibleEntries();
        const urls = visible.map((ent: DirectoryEntry) => createUrl(ent.path));
        if (get().currentLoadId !== loadId) return;
        
        // If switching from video/audio to image, release the old media URL
        if (oldUrl && oldUrl.startsWith('media://')) {
          MediaAPI.releaseMediaUrl(oldUrl);
        }

        const visiblePaths = visible.map((e: DirectoryEntry) => e.path);
        // Only override selectedPaths if we're not in a manual multi-select that already includes the current path
        const currentPaths = get().selectedPaths;
        const needsSync = currentPaths.length <= 1 || !currentPaths.includes(path);

        set({ 
          mediaBlobUrl: urls[0] ?? null, 
          mediaBlobUrls: urls, 
          mediaType: 'image', 
          selectedPaths: needsSync ? visiblePaths : currentPaths,
          error: null 
        });
        visible.forEach((ent: DirectoryEntry) => get().ensureImageDimension(ent.path, createUrl(ent.path)));
      }

      // Preloading logic with concurrency control
      const allEntries = isVideo || isAudio ? get().entries : get().imageEntries;
      const curIdx = allEntries.findIndex((e: DirectoryEntry) => e.path === path);
      if (curIdx >= 0) {
        const pagesPerView = isImage ? get().getPagesPerView() : 1;
        const preloadCount = pagesPerView * 3; // Preload a bit more
        const preloads = [];
        for (let i = pagesPerView; i < pagesPerView + preloadCount; i++) {
          const idx = curIdx + i;
          if (idx < allEntries.length) preloads.push(allEntries[idx]);
        }

        // Limit parallel decodes to 2
        let decodingCount = 0;
        const MAX_DECODE = 2;

        const processPreload = async (ent: DirectoryEntry) => {
          if (get().currentLoadId !== loadId) return;
          const e = ent.path.slice(ent.path.lastIndexOf('.')).toLowerCase();
          if (videoExt.includes(e) || audioExt.includes(e)) return;

          const url = createUrl(ent.path);
          get().ensureImageDimension(ent.path, url);

          if (decodingCount >= MAX_DECODE) {
             // Just set src for browser cache if decoding is busy
             const img = new Image();
             img.src = url;
             return;
          }

          decodingCount++;
          const img = new Image();
          img.src = url;
          try {
            await img.decode();
          } catch {
            // Ignore decode errors
          } finally {
            decodingCount--;
          }
        };

        preloads.forEach((ent: DirectoryEntry) => processPreload(ent));
      }
    } catch (err) {
      if (get().currentLoadId === loadId) {
        get().setError(err instanceof Error ? err.message : String(err));
      }
    }
  },

  move: (delta: number) => {
    const { imageEntries, selectedPath, wrapNavigation } = get();
    const sorted = getSortedEntries(imageEntries);
    const len = sorted.length;
    if (len === 0) return;
    const idx = sorted.findIndex((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(selectedPath ?? ''));
    const cur = idx < 0 ? 0 : idx;
    
    if (!wrapNavigation) {
      if (delta > 0 && cur === len - 1) {
        get().nextFolder();
        return;
      }
      if (delta < 0 && cur === 0) {
        get().prevFolder();
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
    const sorted = getSortedEntries(get().imageEntries);
    if (sorted.length > 0) { get().setSelectedPath(sorted[0].path); get().loadMedia(sorted[0].path); }
  },
  goToLast: () => {
    const sorted = getSortedEntries(get().imageEntries);
    if (sorted.length > 0) { get().setSelectedPath(sorted[sorted.length - 1].path); get().loadMedia(sorted[sorted.length - 1].path); }
  },

  selectedEntry: () => get().imageEntries.find((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(get().selectedPath ?? '')) ?? null,
  
  prevEntry: () => {
    const sorted = getSortedEntries(get().imageEntries);
    if (sorted.length === 0) return null;
    const idx = sorted.findIndex((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(get().selectedPath ?? ''));
    const cur = idx < 0 ? 0 : idx;
    const len = sorted.length;
    let newIdx = get().wrapNavigation ? (cur - 1 + len) % len : Math.max(0, cur - 1);
    return newIdx === cur ? null : sorted[newIdx];
  },
  
  nextEntry: () => {
    const sorted = getSortedEntries(get().imageEntries);
    if (sorted.length === 0) return null;
    const idx = sorted.findIndex((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(get().selectedPath ?? ''));
    const cur = idx < 0 ? 0 : idx;
    const len = sorted.length;
    const step = get().getVisibleEntries().length;
    let newIdx = get().wrapNavigation ? (cur + step) % len : Math.min(len - 1, cur + step);
    return newIdx === cur ? null : sorted[newIdx];
  },

  getSelectedPosition: () => {
    const sorted = getSortedEntries(get().imageEntries);
    const idx = sorted.findIndex((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(get().selectedPath ?? ''));
    return { pos: idx >= 0 ? idx + 1 : 0, total: sorted.length };
  },

  getPagesPerView: () => get().getVisibleEntries().length,

  getVisibleEntries: () => {
    const { imageEntries, selectedPath, imageDimensions } = get();
    const { viewMode, binding, autoSpreadCover } = useLayoutStore.getState();
    const sorted = getSortedEntries(imageEntries);
    const idx = sorted.findIndex((e: DirectoryEntry) => normalizePath(e.path) === normalizePath(selectedPath ?? ''));
    if (idx < 0) return [];

    let isDouble = false;
    const hasNext = idx + 1 < sorted.length;

    if (viewMode === 'spread') isDouble = hasNext;
    else if (viewMode === 'auto') {
      if (idx === 0 && autoSpreadCover) isDouble = false;
      else {
        const curDims = imageDimensions[sorted[idx].path];
        if (curDims && curDims.w > curDims.h) isDouble = false;
        else if (hasNext) {
          const nextDims = imageDimensions[sorted[idx + 1].path];
          isDouble = !(nextDims && nextDims.w > nextDims.h);
        }
      }
    }

    if (!isDouble) return [sorted[idx]];
    return binding === 'rtl' ? [sorted[idx + 1], sorted[idx]] : [sorted[idx], sorted[idx + 1]];
  },
});
