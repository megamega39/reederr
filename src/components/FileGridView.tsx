import { useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { normalizePath } from '../stores/viewerStore.utils';
import { FileIcon } from './FileIcon';
import styles from './FileGridView.module.css';
import type { DirectoryEntry } from '../types';
import { FileSystemAPI } from '../services/api';
import { useLayoutStore } from '../stores/layoutStore';

interface FileGridViewProps {
  entries: DirectoryEntry[];
  selectedPath: string | null;
  selectedPaths: string[];
  onSelect: (entry: DirectoryEntry, e: React.MouseEvent) => void;
  onDoubleClick: (entry: DirectoryEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: DirectoryEntry) => void;
}

interface GridItemProps {
  entry: DirectoryEntry;
  isSelected: boolean;
  onSelect: (entry: DirectoryEntry, e: React.MouseEvent) => void;
  onDoubleClick: (entry: DirectoryEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: DirectoryEntry) => void;
}

function GridItem({ entry, isSelected, onSelect, onDoubleClick, onContextMenu }: GridItemProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const setHoveredItem = useLayoutStore((s) => s.setHoveredItem);

  useEffect(() => {
    let active = true;

    const loadThumb = async () => {
      // Basic check for image/archive extensions or directory to avoid unnecessary calls
      const ext = entry.path.split('.').pop()?.toLowerCase();
      const supportThumbs = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'zip', 'rar', '7z', 'cbz', 'cbr'];
      const isSupportable = entry.isDirectory || (ext && supportThumbs.includes(ext));

      if (isSupportable) {
        try {
          const url = await FileSystemAPI.getThumbnail(entry.path, 120, 120);
          if (active && url) {
            setThumbUrl(url);
          }
        } catch (err) {
          // ignore
        }
      }
    };

    loadThumb();
    return () => { active = false; };
  }, [entry.path, entry.isDirectory]);

  const handleMouseEnter = (e: React.MouseEvent) => {
    setHoveredItem(entry.path, { x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  return (
    <div
      className={`${styles.gridItem} ${isSelected ? styles.selected : ''}`}
      onClick={(ev) => onSelect(entry, ev)}
      onDoubleClick={() => onDoubleClick(entry)}
      onContextMenu={(ev) => onContextMenu(ev, entry)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.thumbnailBox}>
        {thumbUrl ? (
          <img src={thumbUrl} className={styles.thumbnailImg} alt="" />
        ) : (
          <FileIcon path={entry.path} isDirectory={entry.isDirectory} size={48} />
        )}
      </div>
      <div className={styles.itemName} title={entry.name}>
        {entry.name}
      </div>
    </div>
  );
}

export function FileGridView({
  entries,
  selectedPaths,
  onSelect,
  onDoubleClick,
  onContextMenu,
}: FileGridViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Simple fixed grid for now. Ideally use a ResizeObserver to calculate columnCount
  const columnCount = 5; 
  const rowCount = Math.ceil(entries.length / columnCount);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160, // Height of each row (increased for margins)
    overscan: 5,
  });

  return (
    <div className={styles.gridContainer} ref={parentRef}>
      <div
        className={styles.gridInner}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowStartIdx = virtualRow.index * columnCount;
          const rowEntries = entries.slice(rowStartIdx, rowStartIdx + columnCount);

          return (
            <div
              key={virtualRow.key}
              className={styles.gridRow}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                gap: '8px',
                padding: '8px',
              }}
            >
              {rowEntries.map((e) => {
                const isSelected = selectedPaths.some(p => normalizePath(p) === normalizePath(e.path));
                return (
                  <GridItem
                    key={e.path}
                    entry={e}
                    isSelected={isSelected}
                    onSelect={onSelect}
                    onDoubleClick={onDoubleClick}
                    onContextMenu={onContextMenu}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
