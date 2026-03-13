import { useEffect, useState } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { FileSystemAPI } from '../services/api';
import styles from './HoverPreview.module.css';

export function HoverPreview() {
  const hoveredPath = useLayoutStore((s) => s.hoveredPath);
  const hoveredPosition = useLayoutStore((s) => s.hoveredPosition);
  const showHoverPreview = useLayoutStore((s) => s.showHoverPreview);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!hoveredPath || !showHoverPreview) {
      setIsVisible(false);
      setThumbUrl(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const url = await FileSystemAPI.getThumbnail(hoveredPath, 240, 240);
        if (active && url) {
          setThumbUrl(url);
          setIsVisible(true);
        }
      } catch (err) {
        // ignore
      }
    }, 400); // 400ms delay to avoid flickering

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [hoveredPath]);

  if (!hoveredPath || !hoveredPosition || !isVisible || !thumbUrl) {
    return null;
  }

  // Adjust position to stay within window bounds
  const x = hoveredPosition.x + 20;
  const y = hoveredPosition.y + 20;
  
  const style: React.CSSProperties = {
    left: x,
    top: y,
  };

  // Flip if near edge
  if (x + 260 > window.innerWidth) {
    style.left = hoveredPosition.x - 260;
  }
  if (y + 280 > window.innerHeight) {
    style.top = hoveredPosition.y - 280;
  }

  return (
    <div className={styles.hoverPreview} style={style}>
      <div className={styles.thumbnailContainer}>
        <img src={thumbUrl} className={styles.thumbnail} alt="" />
      </div>
    </div>
  );
}
