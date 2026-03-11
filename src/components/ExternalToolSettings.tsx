import { useState } from 'react';
import { useExternalToolStore } from '../stores/externalToolStore';
import { SystemAPI } from '../services/api';

export function ExternalToolSettings() {
  const { tools, addTool, removeTool } = useExternalToolStore();
  const [newToolName, setNewToolName] = useState('');
  const [newToolPath, setNewToolPath] = useState('');

  const handleAdd = () => {
    if (!newToolName.trim() || !newToolPath.trim()) return;
    addTool({ name: newToolName.trim(), appPath: newToolPath.trim() });
    setNewToolName('');
    setNewToolPath('');
  };

  const handleBrowse = async () => {
    const result = await SystemAPI.selectFile();
    if (result?.path) {
      setNewToolPath(result.path);
    }
  };

  return (
    <div className="external-tool-settings">
      <h3 className="settings-section-title">外部ツール登録</h3>
      <p className="settings-description">コンテキストメニューから起動する外部アプリケーションを登録します。</p>

      <div className="tool-add-form">
        <div className="settings-field">
          <label className="settings-label">ツール名</label>
          <input 
            type="text" 
            className="settings-input" 
            value={newToolName} 
            onChange={(e) => setNewToolName(e.target.value)}
            placeholder="例: Photoshop, メモ帳..."
          />
        </div>
        <div className="settings-field">
          <label className="settings-label">アプリケーションのパス</label>
          <div className="settings-input-group">
            <input 
              type="text" 
              className="settings-input" 
              value={newToolPath} 
              onChange={(e) => setNewToolPath(e.target.value)}
              placeholder="C:\Windows\notepad.exe"
            />
            <button className="settings-btn" onClick={handleBrowse}>参照...</button>
          </div>
        </div>
        <button 
          className="settings-btn settings-btn--apply" 
          onClick={handleAdd}
          disabled={!newToolName.trim() || !newToolPath.trim()}
        >
          追加
        </button>
      </div>

      <div className="tool-list">
        {tools.length === 0 ? (
          <p className="settings-empty-msg">登録されているツールはありません。</p>
        ) : (
          tools.map((tool) => (
            <div key={tool.id} className="tool-item">
              <div className="tool-info">
                <div className="tool-name">{tool.name}</div>
                <div className="tool-path">{tool.appPath}</div>
              </div>
              <button className="tool-remove-btn" onClick={() => removeTool(tool.id)} title="削除">✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
