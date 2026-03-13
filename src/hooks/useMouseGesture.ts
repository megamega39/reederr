import { useState, useRef, useCallback } from 'react';

export type GestureDirection = 'up' | 'down' | 'left' | 'right' | null;

interface GestureHandlers {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function useMouseGesture(handlers: GestureHandlers) {
  const [gestureDirection, setGestureDirection] = useState<GestureDirection>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const isRightDragging = useRef(false);
  const GESTURE_THRESHOLD = 30; // Min pixels to trigger

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { // Right click
      startPos.current = { x: e.clientX, y: e.clientY };
      isRightDragging.current = true;
    }
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isRightDragging.current || !startPos.current) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    if (Math.abs(dx) < GESTURE_THRESHOLD && Math.abs(dy) < GESTURE_THRESHOLD) {
      setGestureDirection(null);
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      setGestureDirection(dx > 0 ? 'right' : 'left');
    } else {
      setGestureDirection(dy > 0 ? 'down' : 'up');
    }
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isRightDragging.current) return;
    
    if (gestureDirection) {
      // Prevent context menu if a gesture was performed
      e.preventDefault();
      e.stopPropagation();

      switch (gestureDirection) {
        case 'up': handlers.onSwipeUp?.(); break;
        case 'down': handlers.onSwipeDown?.(); break;
        case 'left': handlers.onSwipeLeft?.(); break;
        case 'right': handlers.onSwipeRight?.(); break;
      }
    }

    isRightDragging.current = false;
    startPos.current = null;
    setGestureDirection(null);
  }, [gestureDirection, handlers]);

  // We need to prevent context menu if a gesture was performed
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (gestureDirection) {
      e.preventDefault();
    }
  }, [gestureDirection]);

  return {
    gestureDirection,
    gestureHandlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onContextMenu,
    }
  };
}
