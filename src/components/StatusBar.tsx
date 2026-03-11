import { memo, useMemo } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';
import { normalizePath } from '../stores/viewerStore.utils';
import styles from './StatusBar.module.css';

function formatSize(bytes?: number) {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const StatusBar = memo(() => {
  const selectedPath = useViewerStore((s) => s.selectedPath);
  const selectedPaths = useViewerStore((s) => s.selectedPaths);
  const entries = useViewerStore((s) => s.entries);
  const selectedEntry = useViewerStore((s) => s.selectedEntry);
  const getSelectedPosition = useViewerStore((s) => s.getSelectedPosition);
  const imageDimensions = useViewerStore((s) => s.imageDimensions);
  const error = useViewerStore((s) => s.error);
  const scaleMode = useLayoutStore((s) => s.scaleMode);

  const entry = selectedEntry();
  const { pos, total } = getSelectedPosition();
  const dims = selectedPath ? imageDimensions[selectedPath] : null;

  // Calculate multi-selection stats
  const selectionStats = useMemo(() => {
    if (selectedPaths.length <= 1) return null;
    let totalSize = 0;
    selectedPaths.forEach(path => {
      const norm = normalizePath(path);
      const e = entries.find(x => normalizePath(x.path) === norm);
      if (e && e.size != null && e.size > 0) {
        totalSize += e.size;
      }
    });
    return {
      count: selectedPaths.length,
      size: totalSize
    };
  }, [selectedPaths, entries]);

  return (
    <div className={styles.statusBar}>
      <div className={`${styles.section} ${styles.main}`}>
        {error ? (
          <span className={styles.error} title={error}>
            ⚠ {error}
          </span>
        ) : (
          <span className={styles.path} title={entry?.path}>
            {selectionStats 
              ? `${selectionStats.count} 個のオブジェクトを選択 (${formatSize(selectionStats.size)})` 
              : (entry?.path ?? '-')}
          </span>
        )}
      </div>

      <div className={`${styles.section} ${styles.info}`}>
        {!selectionStats && dims && (
          <span className={styles.dims}>
            {dims.w} × {dims.h}
          </span>
        )}
        {!selectionStats && entry?.size != null && (
          <span className={styles.size}>
            {formatSize(entry.size)}
          </span>
        )}
        <span className={styles.scale}>
          {scaleMode === 'fit-window' && 'ウィンドウに合わせる'}
          {scaleMode === 'fit-width' && '幅に合わせる'}
          {scaleMode === 'fit-height' && '高さに合わせる'}
          {scaleMode === 'original' && '等倍'}
        </span>
      </div>

      <div className={`${styles.section} ${styles.pos}`}>
        {pos} / {total}
      </div>
    </div>
  );
});
