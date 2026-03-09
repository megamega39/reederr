import { useViewerStore } from '../stores/viewerStore';

export function FolderTree() {
  const rootPath = useViewerStore((s) => s.rootPath);

  return (
    <div className="folder-tree">
      <div className="folder-tree-header">フォルダ</div>
      <div className="folder-tree-content">
        {rootPath ? (
          <div className="folder-tree-item folder-tree-item-root">{rootPath}</div>
        ) : (
          <div className="folder-tree-empty">フォルダを選択してください</div>
        )}
      </div>
    </div>
  );
}
