import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface RenameOverlayProps {
  initialValue: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
  title?: string;
}

export function RenameOverlay({ initialValue, onSave, onCancel, title = '名前の変更' }: RenameOverlayProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Select the filename part (before extension) if possible
      const lastDot = initialValue.lastIndexOf('.');
      if (lastDot > 0) {
        inputRef.current.setSelectionRange(0, lastDot);
      } else {
        inputRef.current.select();
      }
    }
  }, [initialValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(value.trim());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return createPortal(
    <div className="rename-overlay-backdrop" onClick={onCancel}>
      <div className="rename-overlay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rename-overlay-title">{title}</div>
        <input
          ref={inputRef}
          type="text"
          className="rename-overlay-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="rename-overlay-footer">
          <button className="rename-overlay-btn rename-overlay-btn--cancel" onClick={onCancel}>
            キャンセル
          </button>
          <button 
            className="rename-overlay-btn rename-overlay-btn--save" 
            onClick={() => onSave(value.trim())}
            disabled={!value.trim() || value.trim() === initialValue}
          >
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
