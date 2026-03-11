import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSystemAPI, SystemAPI } from '../services/api';
import { useExternalToolStore } from '../stores/externalToolStore';
import { RenameOverlay } from './RenameOverlay';

export interface FileContextMenuProps {
  x: number;
  y: number;
  path: string;
  parentPath: string | null;
  isVirtual?: boolean;
  onRequestRename?: () => void;
  onClose: () => void;
  onDeleted?: (path: string) => void;
  onRenamed?: (oldPath: string, newName: string) => void;
}

export function FileContextMenu({
  x,
  y,
  path,
  parentPath,
  isVirtual,
  onRequestRename,
  onClose,
  onDeleted,
  onRenamed,
}: FileContextMenuProps) {
  const externalTools = useExternalToolStore((s) => s.tools);
  const [showRename, setShowRename] = useState(false);
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener('click', h);
    window.addEventListener('contextmenu', h);
    return () => {
      window.removeEventListener('click', h);
      window.removeEventListener('contextmenu', h);
    };
  }, [onClose]);

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
      const result = await FileSystemAPI.renameFile(path, newName);
      if (result?.ok) {
        onRenamed?.(path, newName);
        window.dispatchEvent(new CustomEvent('file-renamed', { detail: { path, newName } }));
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
    try {
      if (!window.confirm('このファイルをごみ箱に移動しますか？')) {
        onClose();
        return;
      }
      const result = await FileSystemAPI.deleteFile(path);
      if (result?.ok) {
        onDeleted?.(path);
        window.dispatchEvent(new CustomEvent('file-deleted', { detail: { path } }));
      } else if (result?.error) {
        alert(result.error);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    onClose();
  };

  const menu = (
    <div
      className="file-context-menu folder-context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
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
        エクスプローラでファイルを表示
      </div>
      {!isVirtual && (
        <>
          <div className="folder-context-menu-sep" />
          <div className="folder-context-menu-item" onClick={handleRename}>
            名前の変更
          </div>
          <div className="folder-context-menu-item" onClick={handleDelete}>
            削除
          </div>
        </>
      )}
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
    </div>
  );

  return createPortal(menu, document.body);
}
