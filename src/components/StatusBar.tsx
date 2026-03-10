import { memo } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';

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
    <div className="status-bar">
      <div className="status-bar-section main">
        {error ? (
          <span className="status-bar-error" title={error}>
            ⚠ {error}
          </span>
        ) : (
          <span className="status-bar-path" title={entry?.path}>
            {entry?.path ?? '-'}
          </span>
        )}
      </div>

      <div className="status-bar-section info">
        {dims && (
          <span className="status-bar-dims">
            {dims.w} × {dims.h}
          </span>
        )}
        {entry?.size != null && (
          <span className="status-bar-size">
            {formatSize(entry.size)}
          </span>
        )}
        <span className="status-bar-scale">
          {scaleMode === 'fit-window' && 'ウィンドウに合わせる'}
          {scaleMode === 'fit-width' && '幅に合わせる'}
          {scaleMode === 'fit-height' && '高さに合わせる'}
          {scaleMode === 'original' && '等倍'}
        </span>
      </div>

      <div className="status-bar-section pos">
        {pos} / {total}
      </div>
    </div>
  );
});
