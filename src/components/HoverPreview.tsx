import { useEffect, useState } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { FileSystemAPI } from '../services/api';
import styles from './HoverPreview.module.css';

export function HoverPreview() {
  const hoveredPath = useLayoutStore((s) => s.hoveredPath);
  const hoveredPosition = useLayoutStore((s) => s.hoveredPosition);
  const { hoverPreviewSize } = useSettingsStore();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // We can't access showHoverPreview directly from useSettingsStore anymore 
    // because it's a separate store. We should continue getting it from layoutStore
    // but the previous edit removed it. Let's fix that.
    const showHoverPreview = useLayoutStore.getState().showHoverPreview;
    
    if (!hoveredPath || !showHoverPreview) {
      setIsVisible(false);
      setThumbUrl(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await FileSystemAPI.getThumbnail(hoveredPath, hoverPreviewSize, hoverPreviewSize);
        if (active && res.ok && res.value) {
          setThumbUrl(res.value);
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
  if (x + hoverPreviewSize + 20 > window.innerWidth) {
    style.left = hoveredPosition.x - hoverPreviewSize - 20;
  }
  if (y + hoverPreviewSize + 40 > window.innerHeight) {
    style.top = hoveredPosition.y - hoverPreviewSize - 40;
  }

  return (
    <div 
      className={styles.hoverPreview} 
      style={{
        ...style,
        ['--preview-size' as any]: `${hoverPreviewSize}px`,
      }}
    >
      <div className={styles.thumbnailContainer}>
        <img src={thumbUrl} className={styles.thumbnail} alt="" />
      </div>
    </div>
  );
}
