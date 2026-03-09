import { useViewerStore } from '../stores/viewerStore';

export function StatusBar() {
  const selectedEntry = useViewerStore((s) => s.selectedEntry);
  const selectedIndex = useViewerStore((s) => s.selectedIndex);
  const imageEntries = useViewerStore((s) => s.imageEntries);

  const entry = selectedEntry();
  const total = imageEntries.length;
  const pos = total > 0 ? selectedIndex + 1 : 0;

  return (
    <div className="status-bar">
      <span className="status-bar-path">{entry?.path ?? '-'}</span>
      <span className="status-bar-pos">
        {pos} / {total}
      </span>
    </div>
  );
}
