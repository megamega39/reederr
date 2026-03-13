import React, { useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { normalizePath } from '../stores/viewerStore.utils';
import { FileIcon } from './FileIcon';
import styles from './FileGridView.module.css';
import type { DirectoryEntry } from '../types';
import { FileSystemAPI } from '../services/api';
import { useSettingsStore } from '../stores/settingsStore';

interface FileGridViewProps {
  entries: DirectoryEntry[];
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
  thumbnailSize: number;
}

const GridItem = React.memo(({ entry, isSelected, onSelect, onDoubleClick, onContextMenu, thumbnailSize }: GridItemProps) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    const loadThumb = async () => {
      const ext = entry.path.split('.').pop()?.toLowerCase();
      const supportThumbs = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'zip', 'rar', '7z', 'cbz', 'cbr'];
      const isSupportable = entry.isDirectory || (ext && supportThumbs.includes(ext));

      if (isSupportable) {
        try {
          // Pass abort signal if API supports it, otherwise rely on 'active' flag
          const res = await FileSystemAPI.getThumbnail(entry.path, thumbnailSize, thumbnailSize);
          if (active && res.ok && res.value) {
            setThumbUrl(res.value);
          }
        } catch (err) {
          // ignore
        }
      }
    };

    loadThumb();
    return () => { 
      active = false;
      abortController.abort();
    };
  }, [entry.path, entry.isDirectory, thumbnailSize]);

  return (
    <div
      className={`${styles.gridItem} ${isSelected ? styles.selected : ''}`}
      onClick={(ev) => onSelect(entry, ev)}
      onDoubleClick={() => onDoubleClick(entry)}
      onContextMenu={(ev) => onContextMenu(ev, entry)}
    >
      <div className={styles.thumbnailBox}>
        {thumbUrl ? (
          <img src={thumbUrl} className={styles.thumbnailImg} alt="" loading="lazy" />
        ) : (
          <FileIcon path={entry.path} isDirectory={entry.isDirectory} size={48} />
        )}
      </div>
      <div className={styles.itemName} title={entry.name}>
        {entry.name}
      </div>
    </div>
  );
});

GridItem.displayName = 'GridItem';

export function FileGridView({
  entries,
  selectedPaths,
  onSelect,
  onDoubleClick,
  onContextMenu,
}: FileGridViewProps) {
  const { gridThumbnailSize } = useSettingsStore();
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Dynamic column calculation
  useEffect(() => {
    if (!parentRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(parentRef.current);
    setContainerWidth(parentRef.current.clientWidth);

    return () => observer.disconnect();
  }, []);

  const effectiveSize = gridThumbnailSize || 160;
  
  // Use a more aggressive calculation to fit more columns.
  // containerWidth is already the inner width (contentRect.width).
  // We want to fit N items of (effectiveSize + small_overhead).
  // Overhead per item is approx 16px (padding) + 8px (gap) = 24px.
  // But we can be tighter: let's use 12px overhead for the math to allow close fits.
  const columnCount = Math.max(1, Math.floor(containerWidth / (effectiveSize + 12)));
  const rowCount = Math.ceil(entries.length / columnCount);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => effectiveSize + 60, // size + padding(16) + text(~34) + margin(8)
    overscan: 3,
  });

  const virtualRows = virtualizer.getVirtualItems();
  
  // Force re-measure when thumbnail size changes to update row heights correctly
  useEffect(() => {
    virtualizer.measure();
  }, [effectiveSize, virtualizer]);

  return (
    <div 
      className={styles.gridContainer} 
      ref={parentRef} 
      tabIndex={0}
      style={{
        ['--thumb-size' as any]: `${gridThumbnailSize || 160}px`,
      }}
    >
      <div
        className={styles.gridInner}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualRows.map((virtualRow) => {
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
                padding: '0 8px',
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
                    thumbnailSize={gridThumbnailSize}
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
