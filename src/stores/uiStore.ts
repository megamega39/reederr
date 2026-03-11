import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface UIState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type, duration };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
