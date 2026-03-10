import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface FileContextMenuProps {
  x: number;
  y: number;
  path: string;
  parentPath: string | null;
  onClose: () => void;
  onDeleted?: (path: string) => void;
  onRenamed?: (oldPath: string, newName: string) => void;
}

export function FileContextMenu({
  x,
  y,
  path,
  parentPath,
  onClose,
  onDeleted,
  onRenamed,
}: FileContextMenuProps) {
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener('click', h);
    window.addEventListener('contextmenu', h);
    return () => {
      window.removeEventListener('click', h);
      window.removeEventListener('contextmenu', h);
    };
  }, [onClose]);

  const api = window.reederr;

  const handleOpenInExplorer = () => {
    api?.openInExplorer?.(path);
    onClose();
  };

  const handleCopyPath = () => {
    api?.copyPath?.(path);
    onClose();
  };

  const handleCopyParentPath = () => {
    api?.copyParentPath?.(path);
    onClose();
  };

  const handleShowInExplorer = () => {
    api?.showInExplorer?.(path);
    onClose();
  };

  const handleRename = async () => {
    const parts = path.split(/[/\\]/);
    const currentName = parts[parts.length - 1];
    const newName = window.prompt('新しい名前を入力してください', currentName);
    if (!newName?.trim() || newName === currentName) {
      onClose();
      return;
    }
    const result = await api?.renameFile?.(path, newName.trim());
    if (result?.ok) {
      onRenamed?.(path, newName.trim());
    } else if (result?.error) {
      alert(result.error);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm('このファイルをごみ箱に移動しますか？')) {
      onClose();
      return;
    }
    const result = await api?.deleteFile?.(path);
    if (result?.ok) {
      onDeleted?.(path);
    } else if (result?.error) {
      alert(result.error);
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
      <div className="folder-context-menu-sep" />
      <div className="folder-context-menu-item" onClick={handleRename}>
        名前の変更
      </div>
      <div className="folder-context-menu-item" onClick={handleDelete}>
        削除
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}
