import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useViewerStore } from '../stores/viewerStore';

export interface FolderContextMenuProps {
  x: number;
  y: number;
  path: string;
  parentPath: string | null;
  isVirtual: boolean;
  onExpand: () => void | Promise<void>;
  onClose: () => void;
}

export function FolderContextMenu({
  x,
  y,
  path,
  parentPath,
  isVirtual,
  onExpand,
  onClose,
}: FolderContextMenuProps) {
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

  const handleCreateFolder = async () => {
    const name = window.prompt('新しいフォルダ名を入力してください');
    if (!name?.trim()) {
      onClose();
      return;
    }
    const result = await api?.createFolder?.(path, name.trim());
    if (result?.ok) {
      window.dispatchEvent(new CustomEvent('folder-created', { detail: { parentPath: path } }));
    } else if (result?.error) {
      alert(result.error);
    }
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
    const result = await api?.renameFolder?.(path, newName.trim());
    if (result?.ok) {
      window.dispatchEvent(new CustomEvent('folder-renamed', { detail: { path, newName } }));
    } else if (result?.error) {
      alert(result.error);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!window.confirm('このフォルダをごみ箱に移動しますか？')) {
      onClose();
      return;
    }
    const result = await api?.deleteFolder?.(path);
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
      <div className="folder-context-menu-sep" />
      <div className="folder-context-menu-item" onClick={handleExpand}>
        展開
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}
