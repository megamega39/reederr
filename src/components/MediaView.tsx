import { useEffect } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { ImageView } from './ImageView';

export function MediaView() {
  const imageBlobUrl = useViewerStore((s) => s.imageBlobUrl);
  const selectedEntry = useViewerStore((s) => s.selectedEntry);
  const goPrev = useViewerStore((s) => s.goPrev);
  const goNext = useViewerStore((s) => s.goNext);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext]);

  const entry = selectedEntry();

  if (!entry) {
    return (
      <div className="media-view empty">
        <div className="media-view-placeholder">画像を選択してください</div>
      </div>
    );
  }

  return (
    <div className="media-view">
      <ImageView src={imageBlobUrl} alt={entry.name} />
    </div>
  );
}
