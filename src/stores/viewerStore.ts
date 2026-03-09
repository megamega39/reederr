import { create } from 'zustand';
import type { DirectoryEntry } from '../types';

interface ViewerState {
  rootPath: string | null;
  currentPath: string | null;
  entries: DirectoryEntry[];
  imageEntries: DirectoryEntry[];
  selectedIndex: number;
  imageBlobUrl: string | null;
  isLoading: boolean;
  error: string | null;

  setRootPath: (path: string | null) => void;
  setCurrentPath: (path: string | null) => void;
  setEntries: (entries: DirectoryEntry[]) => void;
  setImageEntries: (entries: DirectoryEntry[]) => void;
  setSelectedIndex: (index: number) => void;
  setImageBlobUrl: (url: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  loadRoot: () => Promise<void>;
  loadDirectory: (path: string) => Promise<void>;
  loadImage: (path: string) => Promise<void>;
  goPrev: () => void;
  goNext: () => void;

  selectedEntry: () => DirectoryEntry | null;
  prevEntry: () => DirectoryEntry | null;
  nextEntry: () => DirectoryEntry | null;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  rootPath: null,
  currentPath: null,
  entries: [],
  imageEntries: [],
  selectedIndex: -1,
  imageBlobUrl: null,
  isLoading: false,
  error: null,

  setRootPath: (path) => set({ rootPath: path }),
  setCurrentPath: (path) => set({ currentPath: path }),
  setEntries: (entries) => set({ entries }),
  setImageEntries: (entries) =>
    set({ imageEntries: entries, selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  setImageBlobUrl: (url) => set({ imageBlobUrl: url }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  loadRoot: async () => {
    const result = await window.reederr.selectFolder();
    if (result) {
      get().setRootPath(result.path);
      get().setCurrentPath(result.path);
      await get().loadDirectory(result.path);
    }
  },

  loadDirectory: async (path) => {
    const { setEntries, setImageEntries, setLoading, setError } = get();
    setLoading(true);
    setError(null);
    try {
      const entries = await window.reederr.listDirectory(path);
      setEntries(entries);
      const images = entries.filter((e) => !e.isDirectory && !e.isArchive);
      setImageEntries(images);
      if (images.length > 0) {
        await get().loadImage(images[0].path);
      } else {
        get().setImageBlobUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  },

  loadImage: async (path) => {
    const { imageBlobUrl, setImageBlobUrl, setError } = get();
    if (imageBlobUrl) URL.revokeObjectURL(imageBlobUrl);
    setImageBlobUrl(null);
    setError(null);
    try {
      const buf = await window.reederr.readFile(path);
      const blob = new Blob([buf]);
      const url = URL.createObjectURL(blob);
      setImageBlobUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  },

  goPrev: () => {
    const { imageEntries, selectedIndex } = get();
    if (selectedIndex <= 0) return;
    const next = selectedIndex - 1;
    get().setSelectedIndex(next);
    get().loadImage(imageEntries[next].path);
  },

  goNext: () => {
    const { imageEntries, selectedIndex } = get();
    if (selectedIndex >= imageEntries.length - 1) return;
    const next = selectedIndex + 1;
    get().setSelectedIndex(next);
    get().loadImage(imageEntries[next].path);
  },

  selectedEntry: () => {
    const { imageEntries, selectedIndex } = get();
    if (selectedIndex < 0 || selectedIndex >= imageEntries.length) return null;
    return imageEntries[selectedIndex];
  },
  prevEntry: () => {
    const { imageEntries, selectedIndex } = get();
    if (selectedIndex <= 0) return null;
    return imageEntries[selectedIndex - 1];
  },
  nextEntry: () => {
    const { imageEntries, selectedIndex } = get();
    if (selectedIndex < 0 || selectedIndex >= imageEntries.length - 1)
      return null;
    return imageEntries[selectedIndex + 1];
  },
}));
