import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useViewerStore } from '../stores/viewerStore';
import { FileSystemAPI, SystemAPI } from '../services/api';
import { useExternalToolStore } from '../stores/externalToolStore';
import { RenameOverlay } from './RenameOverlay';

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

  const isFav = useViewerStore((s) => s.isFavorite(path));
  const addFavorite = useViewerStore((s) => s.addFavorite);
  const removeFavorite = useViewerStore((s) => s.removeFavorite);

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
    if (result?.ok) {
      window.dispatchEvent(new CustomEvent('folder-created', { detail: { parentPath: path } }));
    } else if (result?.error) {
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
      if (result?.ok) {
        window.dispatchEvent(new CustomEvent('folder-renamed', { detail: { path, newName } }));
      } else if (result?.error) {
        alert(result.error);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    setShowRename(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm('このフォルダをごみ箱に移動しますか？')) {
      onClose();
      return;
    }
    const result = await FileSystemAPI.deleteFolder(path);
    if (result?.ok) {
      window.dispatchEvent(new CustomEvent('folder-deleted', { detail: { path } }));
    } else if (result?.error) {
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
        {isFav ? '☆ お気に入りから解除' : '⭐ お気に入りに追加'}
      </div>
      <div className="folder-context-menu-sep" />
      <div className="folder-context-menu-item" onClick={handleOpenInExplorer}>
        エクスプローラで開く
      </div>
      <div className="folder-context-menu-sep" />
      <div className="folder-context-menu-item" onClick={handleCopyPath}>
        パスをコピー
      </div>
      {parentPath && (
        <div className="folder-context-menu-item" onClick={handleCopyParentPath}>
          親フォルダのパスをコピー
        </div>
      )}
      <div className="folder-context-menu-item" onClick={handleShowInExplorer}>
        エクスプローラでフォルダを表示
      </div>
      <div className="folder-context-menu-sep" />
      <div className="folder-context-menu-item" onClick={handleCreateFolder}>
        フォルダの作成
      </div>
      <div className="folder-context-menu-item" onClick={handleRename}>
        名前の変更
      </div>
      <div className="folder-context-menu-item" onClick={handleDelete}>
        削除
      </div>
      <div className="folder-context-menu-item" onClick={handleExpand}>
        展開
      </div>
      {externalTools.length > 0 && <div className="folder-context-menu-sep" />}
      {externalTools.map((tool) => (
        <div 
          key={tool.id} 
          className="folder-context-menu-item" 
          onClick={() => {
            SystemAPI.openWithApp(path, tool.appPath);
            onClose();
          }}
        >
          {tool.name} で開く
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
          title="フォルダの作成"
          initialValue="新しいフォルダ"
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
