import { useCallback, useEffect, useRef, useState } from 'react';

type Orientation = 'horizontal' | 'vertical';

interface ResizableDividerProps {
  orientation: Orientation;
  onResize: (delta: number) => void;
  className?: string;
}

export function ResizableDivider({
  orientation,
  onResize,
  className = '',
}: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setIsDragging(true);
      startPos.current = orientation === 'horizontal' ? e.clientX : e.clientY;
    },
    [orientation]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = orientation === 'horizontal' ? e.clientX : e.clientY;
      const delta = orientation === 'horizontal' ? currentPos - startPos.current : currentPos - startPos.current;
      startPos.current = currentPos;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, orientation, onResize]);

  const size = orientation === 'horizontal' ? 8 : 6;
  const cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={`resizable-divider resizable-divider--${orientation} ${className} ${isDragging ? 'dragging' : ''}`}
      style={{
        width: orientation === 'horizontal' ? size : '100%',
        height: orientation === 'vertical' ? size : '100%',
        minWidth: orientation === 'horizontal' ? size : undefined,
        minHeight: orientation === 'vertical' ? size : undefined,
        cursor,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="resizable-divider-line" />
    </div>
  );
}
