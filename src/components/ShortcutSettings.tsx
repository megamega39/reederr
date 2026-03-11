import { useState, useEffect } from 'react';
import { useShortcutStore, ShortcutAction, ACTION_LABELS } from '../stores/shortcutStore';

export function ShortcutSettings() {
  const { shortcuts, setShortcut, resetToDefault } = useShortcutStore();
  const [editingAction, setEditingAction] = useState<ShortcutAction | null>(null);

  useEffect(() => {
    if (!editingAction) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const mods = [];
      if (e.ctrlKey) mods.push('ctrl');
      if (e.shiftKey) mods.push('shift');
      if (e.altKey) mods.push('alt');

      const key = e.key.toLowerCase();
      if (['control', 'shift', 'alt', 'meta'].includes(key)) return;

      const keyName = key === ' ' ? ' ' : key;
      const combo = mods.length > 0 ? [...mods, keyName].join('+') : keyName;

      // Add the new combo to the action
      const currentKeys = shortcuts[editingAction] || [];
      if (!currentKeys.includes(combo)) {
        setShortcut(editingAction, [...currentKeys, combo]);
      }
      setEditingAction(null);
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [editingAction, shortcuts, setShortcut]);

  const handleRemove = (action: ShortcutAction, keyToRemove: string) => {
    const currentKeys = shortcuts[action] || [];
    setShortcut(action, currentKeys.filter(k => k !== keyToRemove));
  };

  return (
    <div className="shortcut-settings">
      <div className="shortcut-settings-header">
        <h3 className="settings-section-title">ショートカットキー設定</h3>
        <button className="settings-btn settings-btn--secondary" onClick={resetToDefault}>初期設定に戻す</button>
      </div>
      
      <div className="shortcut-list">
        {(Object.keys(ACTION_LABELS) as ShortcutAction[]).map((action) => (
          <div key={action} className="shortcut-item">
            <div className="shortcut-label">{ACTION_LABELS[action]}</div>
            <div className="shortcut-keys">
              {shortcuts[action]?.map((key) => (
                <div key={key} className="shortcut-key-tag">
                  <span>{key === ' ' ? 'Space' : key}</span>
                  <button className="shortcut-key-remove" onClick={() => handleRemove(action, key)}>✕</button>
                </div>
              ))}
              <button 
                className={`shortcut-add-btn ${editingAction === action ? 'editing' : ''}`}
                onClick={() => setEditingAction(action)}
              >
                {editingAction === action ? '記号を入力...' : '+ 追加'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingAction && (
        <div className="shortcut-recording-overlay">
          <div className="shortcut-recording-modal">
            <p>キーを押してください...</p>
            <p className="shortcut-recording-hint">（Escでキャンセル）</p>
            <button className="settings-btn" onClick={() => setEditingAction(null)}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}
