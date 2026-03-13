import { useMemo, useState, useCallback, useEffect, useRef, Fragment, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../stores/appStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useMediaStore } from '../stores/mediaStore';
import { useLayoutStore, saveLayoutToStorage } from '../stores/layoutStore';
import type { FileListSortBy, FileListColumnId } from '../stores/layoutStore';
import { formatSize, formatMtime, getFileType } from '../utils/fileUtils';
import { normalizePath, getParentPath } from '../stores/viewerStore.utils';
import { FileIcon } from './FileIcon';
import styles from './FileList.module.css';
import { FileContextMenu } from './FileContextMenu';
import { FolderContextMenu } from './FolderContextMenu';
import type { DirectoryEntry } from '../types';
import { ColumnResizer } from './ColumnResizer';
import { useFileSorting } from '../hooks/useFileSorting';
import { FileSystemAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useShallow } from 'zustand/react/shallow';
import { FileGridView } from './FileGridView';

export function FileList() {
  const { t } = useTranslation();
  
  const { entries, error, isLoading, loadDirectory, currentPath, goBack } = useNavigationStore(
    useShallow((s) => ({
      entries: s.entries,
      error: s.error,
      isLoading: s.isLoading,
      loadDirectory: s.loadDirectory,
      currentPath: s.currentPath,
      goBack: s.goBack,
    }))
  );

  const { fileListFilter, setFileListFilter } = useAppStore(
    useShallow((s) => ({
      fileListFilter: s.fileListFilter,
      setFileListFilter: s.setFileListFilter,
    }))
  );

  const { selectedPath, selectedPaths, setSelectedPath, setSelectedPaths, loadMedia } = useMediaStore(
    useShallow((s) => ({
      selectedPath: s.selectedPath,
      selectedPaths: s.selectedPaths,
      setSelectedPath: s.setSelectedPath,
      setSelectedPaths: s.setSelectedPaths,
      loadMedia: s.loadMedia,
    }))
  );

  const { sortBy, sortOrder, colName, colSize, colType, colMtime, columnOrder } = useLayoutStore(
    useShallow((s) => ({
      sortBy: s.fileListSortBy,
      sortOrder: s.fileListSortOrder,
      colName: s.fileListColName,
      colSize: s.fileListColSize,
      colType: s.fileListColType,
      colMtime: s.fileListColMtime,
      columnOrder: s.fileListColumnOrder,
    }))
  );

  const { setFileListSort, setColName, setColSize, setColType, setColMtime, setColumnOrder, viewMode, setHoveredItem } = useLayoutStore(
    useShallow((s) => ({
      setFileListSort: s.setFileListSort,
      setColName: s.setFileListColName,
      setColSize: s.setFileListColSize,
      setColType: s.setFileListColType,
      setColMtime: s.setFileListColMtime,
      setColumnOrder: s.setFileListColumnOrder,
      viewMode: s.fileListViewMode,
      setFileListViewMode: s.setFileListViewMode,
      setHoveredItem: s.setHoveredItem,
    }))
  );

  const parentRef = useRef<HTMLDivElement>(null);

  const sortedEntries = useFileSorting(entries);

  const virtualizer = useVirtualizer({
    count: sortedEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 18, // Compact row height
    overscan: 20,
  });

  const lastSelectedIndex = useRef<number>(-1);

  // UX: Delay showing the "Loading" overlay to avoid flickering on fast operations (I/O)
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setTimeout(() => setShowLoading(true), 800);
    } else {
      setShowLoading(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Auto-scroll to selected items (ensures the primary highlighted item is visible)
  useEffect(() => {
    if (!selectedPath) return;
    
    const idx = sortedEntries.findIndex(e => normalizePath(e.path) === normalizePath(selectedPath));
    if (idx < 0) return;
    
    // Proactive "Look-ahead" scrolling: 
    // If moving Down, ensure several items below are visible.
    // If moving Up, ensure several items above are visible.
    const SCROLL_MARGIN = 4;
    if (lastSelectedIndex.current !== -1 && lastSelectedIndex.current !== idx) {
      const isMovingDown = idx > lastSelectedIndex.current;
      const targetIdx = isMovingDown 
        ? Math.min(idx + SCROLL_MARGIN, sortedEntries.length - 1)
        : Math.max(idx - SCROLL_MARGIN, 0);
      
      virtualizer.scrollToIndex(targetIdx, { align: 'auto' });
    } else {
      virtualizer.scrollToIndex(idx, { align: 'auto' });
    }
    
    lastSelectedIndex.current = idx;
  }, [selectedPath, sortedEntries, virtualizer]);

  const colWidthMap: Record<FileListColumnId, number> = useMemo(
    () => ({ name: colName, size: colSize, type: colType, mtime: colMtime }),
    [colName, colSize, colType, colMtime]
  );
  const setColWidthMap: Record<FileListColumnId, (px: number) => void> = useMemo(
    () => ({
      name: (px) => setColName(Math.max(30, px)),
      size: (px) => setColSize(Math.max(30, px)),
      type: (px) => setColType(Math.max(30, px)),
      mtime: (px) => setColMtime(Math.max(30, px)),
    }),
    [setColName, setColSize, setColType, setColMtime]
  );

  const [draggedCol, setDraggedCol] = useState<FileListColumnId | null>(null);
  const handleColDragStart = useCallback(
    (e: React.DragEvent, colId: FileListColumnId) => {
      e.dataTransfer.setData('text/plain', colId);
      e.dataTransfer.effectAllowed = 'move';
      setDraggedCol(colId);
    },
    []
  );
  const handleColDragEnd = useCallback(() => setDraggedCol(null), []);
  const handleColDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  const handleColDrop = useCallback(
    (e: React.DragEvent, targetId: FileListColumnId) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData('text/plain') as FileListColumnId | '';
      setDraggedCol(null);
      if (!sourceId || sourceId === targetId) return;
      const prev = useLayoutStore.getState().fileListColumnOrder;
      const next = [...prev];
      const si = next.indexOf(sourceId);
      const ti = next.indexOf(targetId);
      if (si < 0 || ti < 0) return;
      next.splice(si, 1);
      next.splice(ti, 0, sourceId);
      setColumnOrder(next);
      saveLayoutToStorage();
    },
    [setColumnOrder]
  );

  const handleSelect = (entry: DirectoryEntry | null | undefined, e: React.MouseEvent) => {
    if (!entry?.path) return;
    if (entry.isArchive) {
      loadDirectory(entry.path);
      return;
    }
    if (entry.isDirectory) {
      loadDirectory(entry.path);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedPaths(
        selectedPaths.includes(entry.path)
          ? selectedPaths.filter((p) => p !== entry.path)
          : [...selectedPaths, entry.path]
      );
      setSelectedPath(entry.path);
    } else {
      setSelectedPath(entry.path);
    }
    loadMedia(entry.path);
  };

  const handleDoubleClick = (entry: DirectoryEntry | null | undefined) => {
    if (!entry) return;
    if (entry.isDirectory || entry.isArchive) {
      loadDirectory(entry.path);
    }
  };

  const isVirtual = currentPath?.includes('!') ?? false;
  const [editingPath, setEditingPath] = useState<string | null>(null);

  const startRename = useCallback((path: string) => {
    setEditingPath(path);
  }, []);

  const handleRenameSave = async (oldPath: string, newName: string, isDir: boolean) => {
    try {
      if (!newName || newName === (oldPath.split(/[/\\]/).filter(Boolean).pop() || oldPath)) {
        setEditingPath(null);
        return;
      }
      const result = isDir 
        ? await FileSystemAPI.renameFolder(oldPath, newName)
        : await FileSystemAPI.renameFile(oldPath, newName);
      
      if (result?.ok) {
        window.dispatchEvent(new CustomEvent(isDir ? 'folder-renamed' : 'file-renamed', { detail: { path: oldPath, newName } }));
      } else if (result?.error) {
        alert(result.error);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    setEditingPath(null);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingPath) return; // Disable shortcuts while editing
      if (e.key === 'F2') {
        const sel = sortedEntries.find((x) => x.path === selectedPath);
        if (sel && !isVirtual && !sel.path.includes('!')) {
          e.preventDefault();
          startRename(sel.path);
        }
        return;
      }
      if (e.key !== 'Enter') return;
      const sel = sortedEntries.find((x) => x.path === selectedPath) ?? sortedEntries[0];
      if (sel && (sel.isDirectory || sel.isArchive)) {
        e.preventDefault();
        loadDirectory(sel.path);
      }
    },
    [sortedEntries, selectedPath, loadDirectory, editingPath, isVirtual, startRename]
  );

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: DirectoryEntry } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: DirectoryEntry) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Select the item if it's not already selected (standard Windows behavior)
    if (!selectedPaths.includes(entry.path)) {
      setSelectedPath(entry.path);
      setSelectedPaths([entry.path]);
    }
    
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, [selectedPaths, setSelectedPath, setSelectedPaths]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleFolderExpandFromMenu = useCallback(
    (path: string) => {
      loadDirectory(path);
    },
    [loadDirectory]
  );

  const handleFileDeleted = useCallback(
    () => {
      if (currentPath) loadDirectory(currentPath);
    },
    [currentPath, loadDirectory]
  );

  const handleFileRenamed = useCallback(
    (_oldPath: string, _newName: string) => {
      if (currentPath) loadDirectory(currentPath);
    },
    [currentPath, loadDirectory]
  );

  const COL_CONFIG: Record<FileListColumnId, { label: string; sortBy: FileListSortBy; className: string }> = {
    name: { label: t('fileList.name'), sortBy: 'name', className: 'file-list-col-name' },
    size: { label: t('fileList.size'), sortBy: 'size', className: 'file-list-col-size' },
    type: { label: t('fileList.type'), sortBy: 'type', className: 'file-list-col-type' },
    mtime: { label: t('fileList.date'), sortBy: 'mtime', className: 'file-list-col-mtime' },
  };

  useEffect(() => {
    const refresh = () => {
      if (currentPath) loadDirectory(currentPath);
    };
    window.addEventListener('folder-renamed', refresh);
    window.addEventListener('folder-deleted', refresh);
    window.addEventListener('file-renamed', refresh);
    window.addEventListener('file-deleted', refresh);
    window.addEventListener('folder-created', refresh);
    return () => {
      window.removeEventListener('folder-renamed', refresh);
      window.removeEventListener('folder-deleted', refresh);
      window.removeEventListener('file-renamed', refresh);
      window.removeEventListener('file-deleted', refresh);
      window.removeEventListener('folder-created', refresh);
    };
  }, [currentPath, loadDirectory]);

  return (
    <div className={styles.fileList} onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="file-list-filter-bar">
        <label className="file-list-filter-label">Filter:</label>
        <input
          type="text"
          className="file-list-filter-input"
          value={fileListFilter}
          onChange={(e) => setFileListFilter(e.target.value)}
          placeholder={t('fileList.filter')}
          spellCheck={false}
        />
        {fileListFilter && (
          <button className="file-list-filter-clear" onClick={() => setFileListFilter('')}>×</button>
        )}
      </div>

      {viewMode === 'list' && (
        <>
          <div className={styles.fileListHeader}>
            <div className="file-list-header-row">
              <span className="file-list-col-icon" style={{ width: 24 }} />
              {columnOrder.map((colId) => {
                const cfg = COL_CONFIG[colId];
                const w = colWidthMap[colId];
                const setW = setColWidthMap[colId];
                return (
                  <Fragment key={colId}>
                    <div
                      className={`${styles.colHeader} ${cfg.className ? styles[cfg.className] : ''} ${sortBy === cfg.sortBy ? styles.sorted : ''} ${draggedCol === colId ? styles.dragging : ''}`}
                      style={{ width: w, minWidth: w, position: 'relative' }}
                    >
                      <span
                        className={styles.colHeaderContent}
                        draggable
                        onDragStart={(e) => handleColDragStart(e, colId)}
                        onDragEnd={handleColDragEnd}
                        onDragOver={handleColDragOver}
                        onDrop={(e) => handleColDrop(e, colId)}
                        onClick={() => setFileListSort(cfg.sortBy)}
                        role="button"
                        tabIndex={0}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', height: '100%' }}
                      >
                        {cfg.label}
                        {sortBy === cfg.sortBy && (sortOrder === 'asc' ? ' ▲' : ' ▼')}
                      </span>
                      <ColumnResizer onResize={(d) => setW(w + d)} onResizeEnd={saveLayoutToStorage} />
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div className={styles.content} ref={parentRef}>
            {showLoading && <div className={styles.loadingOverlay}>{t('common.loading')}...</div>}
            {error && (
              <div className={styles.errorOverlay} role="alert">
                <div className={styles.errorContent}>
                  <div className={styles.errorText}>{error}</div>
                  <button 
                    className={styles.errorBackButton} 
                    onClick={(e) => {
                      e.stopPropagation();
                      goBack();
                    }}
                  >
                    {t('common.back')}
                  </button>
                </div>
              </div>
            )}

            <div
              className={styles.itemsVirtualInner}
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const e = sortedEntries[virtualItem.index];
                if (!e) return null;
                return (
                  <FileListItem
                    key={virtualItem.key}
                    virtualItem={virtualItem}
                    entry={e}
                    isSelected={selectedPaths.some(p => normalizePath(p) === normalizePath(e.path))}
                    editingPath={editingPath}
                    columnOrder={columnOrder}
                    colWidthMap={colWidthMap}
                    isVirtual={isVirtual}
                    onSelect={handleSelect}
                    onDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                    onRenameSave={handleRenameSave}
                    onSetEditingPath={setEditingPath}
                    onHover={setHoveredItem}
                  />
                );
              })}
            </div>
            {!isLoading && !error && sortedEntries.length === 0 && (
              <div className={styles.empty}>{t('fileList.empty')}</div>
            )}
          </div>
        </>
      )}

      {viewMode === 'grid' && (
        <FileGridView 
          entries={sortedEntries}
          selectedPath={selectedPath}
          selectedPaths={selectedPaths}
          onSelect={handleSelect}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        />
      )}

      {contextMenu &&
        (contextMenu.entry.isDirectory ? (
          <FolderContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            path={contextMenu.entry.path}
            parentPath={currentPath}
            isVirtual={isVirtual}
            onExpand={() => handleFolderExpandFromMenu(contextMenu.entry.path)}
            onRequestRename={() => {
              const itemPath = contextMenu.entry.path;
              if (isVirtual || itemPath.includes('!') || contextMenu.entry.name.startsWith('7z')) return;
              setSelectedPath(itemPath);
              startRename(itemPath);
              closeContextMenu();
            }}
            onClose={closeContextMenu}
          />
        ) : (
          <FileContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            path={contextMenu.entry.path}
            parentPath={getParentPath(contextMenu.entry.path)}
            isVirtual={isVirtual}
            onRequestRename={() => {
              const itemPath = contextMenu.entry.path;
              if (isVirtual || itemPath.includes('!') || contextMenu.entry.name.startsWith('7z')) return;
              setSelectedPath(itemPath);
              startRename(itemPath);
              closeContextMenu();
            }}
            onClose={closeContextMenu}
            onDeleted={handleFileDeleted}
            onRenamed={handleFileRenamed}
          />
        ))}
    </div>
  );
}
const FileListItem = memo(({
  virtualItem,
  entry,
  isSelected,
  editingPath,
  columnOrder,
  colWidthMap,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onRenameSave,
  onSetEditingPath,
  onHover,
}: {
  virtualItem: any;
  entry: DirectoryEntry;
  isSelected: boolean;
  editingPath: string | null;
  columnOrder: FileListColumnId[];
  colWidthMap: Record<string, number>;
  onSelect: (e: DirectoryEntry, ev: React.MouseEvent) => void;
  onDoubleClick: (e: DirectoryEntry) => void;
  onContextMenu: (ev: React.MouseEvent, e: DirectoryEntry) => void;
  onRenameSave: (oldPath: string, newName: string, isDir: boolean) => void;
  onSetEditingPath: (path: string | null) => void;
  onHover: (path: string | null, pos?: { x: number; y: number }) => void;
}) => {
  const { t } = useTranslation();
  
  return (
    <div
      data-path={entry.path}
      className={`${styles.item} ${isSelected ? styles.selected : ''} ${entry.isArchive ? styles.itemArchive : ''}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualItem.size}px`,
        transform: `translateY(${virtualItem.start}px)`,
      }}
      onClick={(ev) => onSelect(entry, ev)}
      onDoubleClick={() => onDoubleClick(entry)}
      onContextMenu={(ev) => onContextMenu(ev, entry)}
      onMouseEnter={(ev) => onHover(entry.path, { x: ev.clientX, y: ev.clientY })}
      onMouseLeave={() => onHover(null)}
    >
      <span className={styles.itemColIcon}>
        <FileIcon path={entry.path} isDirectory={entry.isDirectory} size={16} />
      </span>
      {columnOrder.map((colId) => {
        const w = colWidthMap[colId];
        return (
          <span
            key={colId}
            className={styles.itemCol}
            style={{ width: w, minWidth: w }}
          >
            {colId === 'name' ? (
              editingPath === entry.path ? (
                <input
                  type="text"
                  className={styles.renameInput}
                  defaultValue={entry.name ?? '-'}
                  autoFocus
                  onClick={(ev) => ev.stopPropagation()}
                  onDoubleClick={(ev) => ev.stopPropagation()}
                  onFocus={(ev) => {
                    const input = ev.target as HTMLInputElement;
                    const val = input.value;
                    if (!entry.isDirectory) {
                      const lastDot = val.lastIndexOf('.');
                      if (lastDot > 0) {
                        input.setSelectionRange(0, lastDot);
                        return;
                      }
                    }
                    input.select();
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') {
                      ev.preventDefault();
                      onRenameSave(entry.path, ev.currentTarget.value.trim(), entry.isDirectory);
                    } else if (ev.key === 'Escape') {
                      ev.preventDefault();
                      onSetEditingPath(null);
                    }
                  }}
                  onBlur={(ev) => onRenameSave(entry.path, ev.target.value.trim(), entry.isDirectory)}
                />
              ) : (
                entry?.name ?? '-'
              )
            ) : colId === 'size' ? (
              entry?.isDirectory ? '' : formatSize(entry?.size)
            ) : colId === 'type' ? (
              getFileType(entry, t)
            ) : colId === 'mtime' ? (
              formatMtime(entry?.mtime)
            ) : null}
          </span>
        );
      })}
    </div>
  );
});
