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
      {validSrcs.map((src, i) => {
        const path = paths?.[i] || src;
        // Use index as key to ensure DOM is reused during src changes, preventing flicker
        return (
          <div key={i} className="image-view-page">
            <img
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
              onError={() => {
                console.error(`[ImageView] Failed to load image: ${path} (src: ${src})`);
              }}
            />
          </div>
        );
      })}
    </div>
  );
});
