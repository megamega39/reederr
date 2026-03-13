import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFavoriteStore } from '../stores/favoriteStore';
import { FileSystemAPI, SystemAPI } from '../services/api';
import { useExternalToolStore } from '../stores/externalToolStore';
import { RenameOverlay } from './RenameOverlay';
import { useTranslation } from '../i18n';
import { useShallow } from 'zustand/react/shallow';

export interface FolderContextMenuProps {
  x: number;
  y: number;
  path: string;
  parentPath: string | null;
  isVirtual: boolean;
  onRequestRename?: () => void;
  onExpand: () => void | Promise<void>;
  onClose: () => void;
}

export function FolderContextMenu({
  x,
  y,
  path,
  parentPath,
  isVirtual,
  onRequestRename,
  onExpand,
  onClose,
}: FolderContextMenuProps) {
  const { t } = useTranslation();
  const externalTools = useExternalToolStore((s) => s.tools);
  const [showRename, setShowRename] = useState(false);
  const [showCreateFolderOverlay, setShowCreateFolderOverlay] = useState(false);

  useEffect(() => {
    const h = () => onClose();
    window.addEventListener('click', h);
    window.addEventListener('contextmenu', h);
    return () => {
      window.removeEventListener('click', h);
      window.removeEventListener('contextmenu', h);
    };
  }, [onClose]);

  const { isFavorite, addFavorite, removeFavorite } = useFavoriteStore(
    useShallow((s) => ({
      isFavorite: s.isFavorite,
      addFavorite: s.addFavorite,
      removeFavorite: s.removeFavorite,
    }))
  );

  const isFav = isFavorite(path);

  const handleToggleFavorite = () => {
    if (isFav) {
      removeFavorite(path);
    } else {
      const name = path.split(/[/\\]/).filter(Boolean).pop() || path;
      addFavorite(path, name);
    }
    onClose();
  };

  const handleOpenInExplorer = () => {
    SystemAPI.openInExplorer(path);
    onClose();
  };

  const handleCopyPath = () => {
    SystemAPI.copyPath(path);
    onClose();
  };

  const handleCopyParentPath = () => {
    SystemAPI.copyParentPath(path);
    onClose();
  };

  const handleShowInExplorer = () => {
    SystemAPI.showInExplorer(path);
    onClose();
  };

  const handleCreateFolder = () => {
    setShowCreateFolderOverlay(true);
  };

  const onCreateFolderSave = async (name: string) => {
    if (!name.trim()) {
      setShowCreateFolderOverlay(false);
      onClose();
      return;
    }
    const result = await FileSystemAPI.createFolder(path, name.trim());
    if (result.ok) {
      window.dispatchEvent(new CustomEvent('folder-created', { detail: { parentPath: path } }));
    } else {
      alert(result.error);
    }
    setShowCreateFolderOverlay(false);
    onClose();
  };

  const handleRename = () => {
    if (onRequestRename) {
      onRequestRename();
    } else {
      setShowRename(true);
    }
  };

  const onRenameSave = async (newName: string) => {
    try {
      if (!newName || newName === (path.split(/[/\\]/).filter(Boolean).pop() || path)) {
        setShowRename(false);
        onClose();
        return;
      }
      const result = await FileSystemAPI.renameFolder(path, newName);
      if (result.ok) {
        window.dispatchEvent(new CustomEvent('folder-renamed', { detail: { path, newName } }));
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    setShowRename(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm(t('dialog.confirmDeleteFolder'))) {
      onClose();
      return;
    }
    const result = await FileSystemAPI.deleteFolder(path);
    if (result.ok) {
      window.dispatchEvent(new CustomEvent('folder-deleted', { detail: { path } }));
    } else {
      alert(result.error);
    }
    onClose();
  };

  const handleExpand = () => {
    onExpand();
    onClose();
  };

  if (isVirtual) return null;

  const menu = (
    <div
      className="folder-context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="folder-context-menu-item" onClick={handleToggleFavorite}>
        {isFav ? t('contextMenu.removeFavorite') : t('contextMenu.addFavorite')}
      </div>
      <div className="folder-context-menu-sep" />
      <div className="folder-context-menu-item" onClick={handleOpenInExplorer}>
        {t('contextMenu.openInExplorer')}
      </div>
      <div className="folder-context-menu-sep" />
      <div className="folder-context-menu-item" onClick={handleCopyPath}>
        {t('contextMenu.copyPath')}
      </div>
      {parentPath && (
        <div className="folder-context-menu-item" onClick={handleCopyParentPath}>
          {t('contextMenu.copyParentPath')}
        </div>
      )}
      <div className="folder-context-menu-item" onClick={handleShowInExplorer}>
        {t('contextMenu.showInExplorer')}
      </div>
      <div className="folder-context-menu-sep" />
      <div className="folder-context-menu-item" onClick={handleCreateFolder}>
        {t('contextMenu.createFolder')}
      </div>
      <div className="folder-context-menu-item" onClick={handleRename}>
        {t('contextMenu.rename')}
      </div>
      <div className="folder-context-menu-item" onClick={handleDelete}>
        {t('contextMenu.delete')}
      </div>
      <div className="folder-context-menu-item" onClick={handleExpand}>
        {t('contextMenu.expand')}
      </div>
      {externalTools.length > 0 && <div className="folder-context-menu-sep" />}
      {externalTools.map((tool) => (
        <div 
          key={tool.id} 
          className="folder-context-menu-item" 
          onClick={async () => {
            const result = await SystemAPI.openWithApp(path, tool.appPath);
            if (!result.ok) alert(result.error);
            onClose();
          }}
        >
          {t('contextMenu.openWith', { name: tool.name })}
        </div>
      ))}
      {showRename && (
        <RenameOverlay
          initialValue={path.split(/[/\\]/).filter(Boolean).pop() || path}
          onSave={onRenameSave}
          onCancel={() => {
            setShowRename(false);
            onClose();
          }}
        />
      )}
      {showCreateFolderOverlay && (
        <RenameOverlay
          title={t('dialog.createFolderTitle')}
          initialValue={t('dialog.newFolderDefaultName')}
          onSave={onCreateFolderSave}
          onCancel={() => {
            setShowCreateFolderOverlay(false);
            onClose();
          }}
        />
      )}
    </div>
  );

  return createPortal(menu, document.body);
}
