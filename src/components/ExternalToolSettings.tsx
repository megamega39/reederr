import { useState } from 'react';
import { useExternalToolStore } from '../stores/externalToolStore';
import { SystemAPI } from '../services/api';
import { useTranslation } from '../i18n';

export function ExternalToolSettings() {
  const { t } = useTranslation();
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
      <h3 className="settings-section-title">{t('settings.externalToolsTitle')}</h3>
      <p className="settings-description">{t('settings.toolDesc')}</p>

      <div className="tool-add-form">
        <div className="settings-field">
          <label className="settings-label">{t('settings.toolName')}</label>
          <input 
            type="text" 
            className="settings-input" 
            value={newToolName} 
            onChange={(e) => setNewToolName(e.target.value)}
            placeholder={t('settings.toolPlaceholderName')}
          />
        </div>
        <div className="settings-field">
          <label className="settings-label">{t('settings.toolPath')}</label>
          <div className="settings-input-group">
            <input 
              type="text" 
              className="settings-input" 
              value={newToolPath} 
              onChange={(e) => setNewToolPath(e.target.value)}
              placeholder={t('settings.toolPlaceholderPath')}
            />
            <button className="settings-btn" onClick={handleBrowse}>{t('settings.toolBrowse')}</button>
          </div>
        </div>
        <button 
          className="settings-btn settings-btn--apply" 
          onClick={handleAdd}
          disabled={!newToolName.trim() || !newToolPath.trim()}
        >
          {t('settings.toolAdd')}
        </button>
      </div>

      <div className="tool-list">
        {tools.length === 0 ? (
          <p className="settings-empty-msg">{t('settings.toolEmpty')}</p>
        ) : (
          tools.map((tool) => (
            <div key={tool.id} className="tool-item">
              <div className="tool-info">
                <div className="tool-name">{tool.name}</div>
                <div className="tool-path">{tool.appPath}</div>
              </div>
              <button className="tool-remove-btn" onClick={() => removeTool(tool.id)} title={t('settings.toolDelete')}>✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
