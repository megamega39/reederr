import { StateCreator } from 'zustand';
import { ViewerState } from '../viewerStore.types';

export interface FavoriteSlice {
  favorites: ViewerState['favorites'];
  addFavorite: ViewerState['addFavorite'];
  removeFavorite: ViewerState['removeFavorite'];
  isFavorite: ViewerState['isFavorite'];
}

export const createFavoriteSlice: StateCreator<
  ViewerState,
  [],
  [],
  FavoriteSlice
> = (set, get) => ({
  favorites: [],
  addFavorite: (path, name) => {
    const { favorites } = get();
    if (favorites.some((f) => f.path === path)) return;
    set({ favorites: [...favorites, { path, name }] });
    // Persistence is handled by PersistenceManager or manual calls in App.tsx
    // The original code called saveViewerToStorage() here. 
    // We will keep the side-effect in the combined store or handle it via a subscriber.
  },
  removeFavorite: (path) => {
    set({ favorites: get().favorites.filter((f) => f.path !== path) });
  },
  isFavorite: (path) => get().favorites.some((f) => f.path === path),
});
