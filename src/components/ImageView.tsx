import { memo } from 'react';
import { useLayoutStore } from '../stores/layoutStore';

interface ImageViewProps {
  srcs: (string | null)[];
  alt: string;
  onDimensions?: (path: string, w: number, h: number) => void;
  paths?: string[];
}

export const ImageView = memo(({ srcs, alt, onDimensions, paths }: ImageViewProps) => {
  const validSrcs = srcs.filter((s): s is string => !!s);

  const scaleMode = useLayoutStore((s) => s.scaleMode);
  const isSpread = validSrcs.length > 1;

  return (
    <div className={`image-view image-view--${isSpread ? 'spread' : 'single'} scale-${scaleMode}`}>
      {validSrcs.length === 0 ? (
        <div className="image-view-loading">
          <span>読み込み中...</span>
        </div>
      ) : (
        validSrcs.map((src, i) => {
          const path = paths?.[i] || src;
          // React needs a highly unique key to avoid DOM recycling crashes (removeChild error)
          const uniqueKey = `${path}-${i}-${src}`;
          return (
            <div key={uniqueKey} className="image-view-page">
              <img
                key={`img-${uniqueKey}`}
                src={src}
                alt={alt}
                className="image-view-img"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const w = img.naturalWidth;
                  const h = img.naturalHeight;
                  if (paths?.[i] && onDimensions && w > 0 && h > 0) {
                    onDimensions(paths[i], w, h);
                  }
                }}
              />
            </div>
          );
        })
      )}
    </div>
  );
});
