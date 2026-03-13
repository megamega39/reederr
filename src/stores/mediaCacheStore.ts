import { create } from 'zustand';

interface MediaCacheState {
  imageDimensions: Record<string, { w: number; h: number }>;
  mediaUrlCache: Record<string, string>;
  
  setImageDimensions: (path: string, dims: { w: number; h: number }) => void;
  setMediaUrl: (path: string, url: string) => void;
  getMediaUrl: (path: string) => string | undefined;
  getDimension: (path: string) => { w: number; h: number } | undefined;
  ensureImageDimension: (path: string, url: string) => void;
  pruneCache: (activePaths: Set<string>) => void;
  clear: () => void;
}

export const useMediaCacheStore = create<MediaCacheState>((set, get) => ({
  imageDimensions: {},
  mediaUrlCache: {},

  setImageDimensions: (path: string, dims: { w: number; h: number }) => {
    const current = get().imageDimensions[path];
    if (current && current.w === dims.w && current.h === dims.h) return;
    set((s) => ({ imageDimensions: { ...s.imageDimensions, [path]: dims } }));
  },

  setMediaUrl: (path: string, url: string) => {
    if (get().mediaUrlCache[path] === url) return;
    set((s) => ({ mediaUrlCache: { ...s.mediaUrlCache, [path]: url } }));
  },

  getMediaUrl: (path: string) => get().mediaUrlCache[path],
  
  getDimension: (path: string) => get().imageDimensions[path],

  ensureImageDimension: (path: string, url: string) => {
    if (get().imageDimensions[path]) return;
    const img = new Image();
    img.onload = () => {
      get().setImageDimensions(path, { w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
  },

  pruneCache: (activePaths: Set<string>) => {
    const { imageDimensions, mediaUrlCache } = get();
    // Only prune if cache grows large
    if (Object.keys(mediaUrlCache).length < 500) return;

    const nextDim = { ...imageDimensions };
    const nextCache = { ...mediaUrlCache };
    let changed = false;

    Object.keys(nextDim).forEach(p => {
      if (!activePaths.has(p)) { delete nextDim[p]; changed = true; }
    });
    Object.keys(nextCache).forEach(p => {
      if (!activePaths.has(p)) { delete nextCache[p]; changed = true; }
    });

    if (changed) set({ imageDimensions: nextDim, mediaUrlCache: nextCache });
  },

  clear: () => set({ imageDimensions: {}, mediaUrlCache: {} }),
}));
