import { useState, useEffect, useCallback } from 'react';
import { useViewerStore } from '../stores/viewerStore';

export function AddressBar() {
  const currentPath = useViewerStore((s) => s.currentPath);
  const loadDirectory = useViewerStore((s) => s.loadDirectory);

  const [inputValue, setInputValue] = useState('');

  // Sync input value when externally navigating
  useEffect(() => {
    setInputValue(currentPath ?? '');
  }, [currentPath]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue !== currentPath) {
      loadDirectory(inputValue);
    }
  }, [inputValue, currentPath, loadDirectory]);

  return (
    <div className="address-bar">
      <span className="address-bar-label">アドレス(A)</span>
      <form className="address-bar-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="address-bar-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          spellCheck={false}
        />
        <button type="button" className="address-bar-go-btn" onClick={() => handleSubmit()} title="移動">
          →
        </button>
      </form>
    </div>
  );
}
