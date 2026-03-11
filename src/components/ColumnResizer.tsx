import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './FileList.module.css';

interface Props {
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  className?: string;
}

export function ColumnResizer({
  onResize,
  onResizeEnd,
  className,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    startX.current = e.clientX;
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      onResize(e.clientX - startX.current);
      startX.current = e.clientX;
    };
    const handleMouseUp = () => {
      setDragging(false);
      onResizeEnd?.();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onResize, onResizeEnd]);

  return (
    <div
      className={`${styles.colResizer} ${className ?? ''}`}
      onMouseDown={handleMouseDown}
    />
  );
}
