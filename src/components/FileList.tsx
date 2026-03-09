import { useViewerStore } from '../stores/viewerStore';

export function FileList() {
  const imageEntries = useViewerStore((s) => s.imageEntries);
  const selectedIndex = useViewerStore((s) => s.selectedIndex);
  const setSelectedIndex = useViewerStore((s) => s.setSelectedIndex);
  const loadImage = useViewerStore((s) => s.loadImage);
  const isLoading = useViewerStore((s) => s.isLoading);

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    loadImage(imageEntries[index].path);
  };

  return (
    <div className="file-list">
      <div className="file-list-header">ファイル</div>
      <div className="file-list-content">
        {isLoading ? (
          <div className="file-list-loading">読み込み中...</div>
        ) : imageEntries.length === 0 ? (
          <div className="file-list-empty">画像がありません</div>
        ) : (
          <ul className="file-list-items">
            {imageEntries.map((e, i) => (
              <li
                key={e.path}
                className={`file-list-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(i)}
              >
                {e.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
