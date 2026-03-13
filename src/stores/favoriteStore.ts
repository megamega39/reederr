import { create } from 'zustand';

export interface FavoriteEntry {
  path: string;
  name: string;
}

export interface FavoriteState {
  favorites: FavoriteEntry[];
  addFavorite: (path: string, name: string) => void;
  removeFavorite: (path: string) => void;
  isFavorite: (path: string) => boolean;
  setFavorites: (favorites: FavoriteEntry[]) => void;
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: [],
  addFavorite: (path, name) => {
    const { favorites } = get();
    if (favorites.some((f) => f.path === path)) return;
    set({ favorites: [...favorites, { path, name }] });
  },
  removeFavorite: (path) => {
    set({ favorites: get().favorites.filter((f) => f.path !== path) });
  },
  isFavorite: (path) => get().favorites.some((f) => f.path === path),
  setFavorites: (favorites) => set({ favorites }),
}));
