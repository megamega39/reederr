import { useEffect } from 'react';
import { useMouseGesture } from './useMouseGesture';
import { MediaAPI } from '../services/api';

interface NavigationActions {
  goPrevPage: () => void;
  goNextPage: () => void;
  goNext: () => void;
  goBack: () => void;
  nextEntry: () => any;
  prevEntry: () => any;
  toggleLoop: () => void;
  changePlaybackRate: (delta: number) => void;
  resetPlaybackRate: () => void;
  isPreviewFullscreen: boolean;
  error: string | null;
  isLoading: boolean;
  mediaType: 'image' | 'video' | 'audio' | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function useMediaViewNavigation({
  goPrevPage,
  goNextPage,
  goNext,
  goBack,
  nextEntry,
  prevEntry,
  toggleLoop,
  changePlaybackRate,
  resetPlaybackRate,
  isPreviewFullscreen,
  error,
  isLoading,
  mediaType,
  containerRef,
}: NavigationActions) {
  
  const handleToggleFullscreen = () => {
    MediaAPI.setPreviewFullscreen(!isPreviewFullscreen);
  };

  const { gestureDirection, gestureHandlers } = useMouseGesture({
    onSwipeLeft: goPrevPage,
    onSwipeRight: goNextPage,
    onSwipeUp: handleToggleFullscreen,
    onSwipeDown: goBack,
  });

  // Keyboard Navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault(); goPrevPage(); break;
        case 'ArrowRight':
        case ' ':
        case 'Spacebar':
          e.preventDefault(); goNextPage(); break;
        case 'Backspace':
          e.preventDefault(); goPrevPage(); break;
        case 'l':
        case 'L':
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault(); toggleLoop();
          }
          break;
        case ']':
          e.preventDefault(); changePlaybackRate(0.1); break;
        case '[':
          e.preventDefault(); changePlaybackRate(-0.1); break;
        case '\\':
        case '¥':
          e.preventDefault(); resetPlaybackRate(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrevPage, goNextPage, toggleLoop, changePlaybackRate, resetPlaybackRate]);

  // Wheel Navigation (Smooth/Responsive)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const accumulator = { val: 0, lastTime: Date.now() };
    const pendingTurns = { val: 0, isProcessing: false };
    const WHEEL_THRESHOLD = 100;
    const MAX_QUEUE = 10;

    const processQueue = () => {
      if (pendingTurns.val === 0) {
        pendingTurns.isProcessing = false;
        return;
      }
      let moved = false;
      if (pendingTurns.val > 0) {
        if (nextEntry()) { goNextPage(); moved = true; }
        pendingTurns.val--;
      } else if (pendingTurns.val < 0) {
        if (prevEntry()) { goPrevPage(); moved = true; }
        pendingTurns.val++;
      }

      if (moved || pendingTurns.val !== 0) {
        requestAnimationFrame(processQueue);
      } else {
        pendingTurns.isProcessing = false;
      }
    };

    const handler = (e: WheelEvent) => {
      if (error || isLoading) return;
      const now = Date.now();
      if (now - accumulator.lastTime > 500) accumulator.val = 0;
      accumulator.lastTime = now;

      const dy = e.deltaY;
      const dx = e.deltaX;
      const delta = Math.abs(dy) > Math.abs(dx) ? dy : dx;

      if ((delta > 0 && accumulator.val < 0) || (delta < 0 && accumulator.val > 0)) {
        accumulator.val = 0;
      }
      accumulator.val += delta;

      let added = false;
      while (Math.abs(accumulator.val) >= WHEEL_THRESHOLD) {
        if (accumulator.val >= WHEEL_THRESHOLD) {
          if (pendingTurns.val < MAX_QUEUE) pendingTurns.val++;
          accumulator.val -= WHEEL_THRESHOLD;
          added = true;
        } else {
          if (pendingTurns.val > -MAX_QUEUE) pendingTurns.val--;
          accumulator.val += WHEEL_THRESHOLD;
          added = true;
        }
      }

      if (added) {
        e.preventDefault();
        if (!pendingTurns.isProcessing) {
          pendingTurns.isProcessing = true;
          requestAnimationFrame(processQueue);
        }
      }
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => {
      el.removeEventListener('wheel', handler);
      pendingTurns.val = 0;
    };
  }, [mediaType, error, isLoading, goNextPage, goPrevPage, nextEntry, prevEntry]);

  return { gestureDirection, gestureHandlers, handleToggleFullscreen };
}
