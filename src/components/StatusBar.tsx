import { memo } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';
import styles from './StatusBar.module.css';

function formatSize(bytes?: number) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const StatusBar = memo(() => {
  const selectedPath = useViewerStore((s) => s.selectedPath);
  const selectedEntry = useViewerStore((s) => s.selectedEntry);
  const getSelectedPosition = useViewerStore((s) => s.getSelectedPosition);
  const imageDimensions = useViewerStore((s) => s.imageDimensions);
  const error = useViewerStore((s) => s.error);
  const scaleMode = useLayoutStore((s) => s.scaleMode);

  const entry = selectedEntry();
  const { pos, total } = getSelectedPosition();
  const dims = selectedPath ? imageDimensions[selectedPath] : null;

  return (
    <div className={styles.statusBar}>
      <div className={`${styles.section} ${styles.main}`}>
        {error ? (
          <span className={styles.error} title={error}>
            ⚠ {error}
          </span>
        ) : (
          <span className={styles.path} title={entry?.path}>
            {entry?.path ?? '-'}
          </span>
        )}
      </div>

      <div className={`${styles.section} ${styles.info}`}>
        {dims && (
          <span className={styles.dims}>
            {dims.w} × {dims.h}
          </span>
        )}
        {entry?.size != null && (
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
