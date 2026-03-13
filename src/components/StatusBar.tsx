import { memo, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useMediaStore } from '../stores/mediaStore';
import { useLayoutStore } from '../stores/layoutStore';
import { normalizePath } from '../stores/viewerStore.utils';
import styles from './StatusBar.module.css';
import { useTranslation } from '../i18n';
import { useShallow } from 'zustand/react/shallow';

function formatSize(bytes?: number) {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const StatusBar = memo(() => {
  const { t } = useTranslation();
  
  const { selectedPath, selectedPaths, selectedEntry, getSelectedPosition, imageDimensions } = useMediaStore(
    useShallow((s) => ({
      selectedPath: s.selectedPath,
      selectedPaths: s.selectedPaths,
      selectedEntry: s.selectedEntry,
      getSelectedPosition: s.getSelectedPosition,
      imageDimensions: s.imageDimensions,
    }))
  );

  const { entries } = useNavigationStore(
    useShallow((s) => ({
      entries: s.entries,
    }))
  );

  const { error } = useAppStore(
    useShallow((s) => ({
      error: s.error,
    }))
  );

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
              ? t('statusBar.itemsSelected', { count: selectionStats.count, size: formatSize(selectionStats.size) })
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
          {scaleMode === 'fit-window' && t('statusBar.scaleFitWindow')}
          {scaleMode === 'fit-width' && t('statusBar.scaleFitWidth')}
          {scaleMode === 'fit-height' && t('statusBar.scaleFitHeight')}
          {scaleMode === 'original' && t('statusBar.scaleOriginal')}
        </span>
      </div>

      <div className={`${styles.section} ${styles.pos}`}>
        {pos} / {total}
      </div>
    </div>
  );
});
