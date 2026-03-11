import { useMemo, useState, useCallback, useEffect, useRef, Fragment } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';
import type { FileListSortBy, FileListColumnId } from '../stores/layoutStore';
import { saveLayoutToStorage } from '../stores/layoutStore';
import { FileSystemAPI } from '../services/api';
import { normalizePath } from '../stores/viewerStore.utils';
import { FileIcon } from './FileIcon';
import styles from './FileList.module.css';
import { FileContextMenu } from './FileContextMenu';
import { FolderContextMenu } from './FolderContextMenu';
import type { DirectoryEntry } from '../types';

function getParentPath(p: string): string | null {
  const m = p.match(/^(.+)[/\\][^/\\]*$/);
  return m ? m[1] : null;
}

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  if (bytes < 1024 * 1024) {
    const kb = Math.round(bytes / 1024);
    return `${kb.toLocaleString()} KB`;
  }
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  return `${mb} MB`;
}

function formatMtime(ms?: number): string {
  if (ms == null) return '-';
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${day} ${h}:${mi}`;
}

function getFileType(entry: DirectoryEntry | null | undefined): string {
  if (!entry) return 'ファイル';
  if (entry.isDirectory) return 'フォルダ';
  if (entry.isArchive) {
    const dotIdx = (entry.name ?? '').lastIndexOf('.');
    const ext = (dotIdx >= 0 ? entry.name.slice(dotIdx + 1) : '').toUpperCase();
    return ext ? `${ext} アーカイブ` : 'アーカイブ';
  }
  const dotIdx = (entry.name ?? '').lastIndexOf('.');
  const ext = (dotIdx >= 0 ? '.' + (entry.name ?? '').slice(dotIdx + 1) : '').toLowerCase();
  const typeMap: Record<string, string> = {
    '.jpg': 'JPG ファイル',
    '.jpeg': 'JPEG ファイル',
    '.png': 'PNG ファイル',
    '.gif': 'GIF ファイル',
    '.webp': 'WebP ファイル',
    '.bmp': 'BMP ファイル',
    '.mp4': 'MP4 ファイル',
    '.webm': 'WebM ファイル',
    '.avi': 'AVI ファイル',
    '.mkv': 'MKV ファイル',
    '.mov': 'MOV ファイル',
    '.wmv': 'WMV ファイル',
    '.m4a': 'M4A ファイル',
    '.m4v': 'M4V ファイル',
    '.mp3': 'MP3 オーディオ',
    '.wav': 'WAV オーディオ',
    '.ogg': 'OGG オーディオ',
    '.flac': 'FLAC オーディオ',
    '.aac': 'AAC オーディオ',
  };
  return typeMap[ext] ?? (ext ? `${ext.slice(1).toUpperCase()} ファイル` : 'ファイル');
}

function ColumnResizer({
  onResize,
  onResizeEnd,
  className,
}: {
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    startX.current = e.clientX;
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      onResize(e.clientX - startX.current);
      startX.current = e.clientX;
    };
    const handleMouseUp = () => {
      setDragging(false);
      onResizeEnd?.();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onResize, onResizeEnd]);

  return (
    <div
      className={`${styles.colResizer} ${className ?? ''}`}
      onMouseDown={handleMouseDown}
    />
  );
}

export function FileList() {
  const entries = useViewerStore((s) => s.entries) ?? [];
  const error = useViewerStore((s) => s.error);
  const selectedPath = useViewerStore((s) => s.selectedPath);
  const selectedPaths = useViewerStore((s) => s.selectedPaths);
  const setSelectedPath = useViewerStore((s) => s.setSelectedPath);
  const setSelectedPaths = useViewerStore((s) => s.setSelectedPaths);
  const isLoading = useViewerStore((s) => s.isLoading);
  const loadMedia = useViewerStore((s) => s.loadMedia);
  const loadDirectory = useViewerStore((s) => s.loadDirectory);

  const sortBy = useLayoutStore((s) => s.fileListSortBy);
  const sortOrder = useLayoutStore((s) => s.fileListSortOrder);
  const setFileListSort = useLayoutStore((s) => s.setFileListSort);
  const colName = useLayoutStore((s) => s.fileListColName);
  const colSize = useLayoutStore((s) => s.fileListColSize);
  const colType = useLayoutStore((s) => s.fileListColType);
  const colMtime = useLayoutStore((s) => s.fileListColMtime);
  const setColName = useLayoutStore((s) => s.setFileListColName);
  const setColSize = useLayoutStore((s) => s.setFileListColSize);
  const setColType = useLayoutStore((s) => s.setFileListColType);
  const setColMtime = useLayoutStore((s) => s.setFileListColMtime);
  const columnOrder = useLayoutStore((s) => s.fileListColumnOrder);
  const setColumnOrder = useLayoutStore((s) => s.setFileListColumnOrder);

  const parentRef = useRef<HTMLDivElement>(null);

  const fileListFilter = useViewerStore((s) => s.fileListFilter);
  const setFileListFilter = useViewerStore((s) => s.setFileListFilter);
  const sortedEntries = useMemo(() => {
    const safe = entries.filter((e): e is DirectoryEntry => 
      e != null && 
      typeof e === 'object' && 
      typeof (e as DirectoryEntry).name === 'string' && 
      typeof (e as DirectoryEntry).path === 'string'
    );
    
    // Apply Junk/Temp Filter
    let filtered = safe.filter((e) => {
      const name = e.name;
      // Hide common junk/temp artifacts
      if (name === '__MACOSX' || name === '.DS_Store' || name.startsWith('._')) return false;
      if (name.startsWith('~') || name.startsWith('7z')) return false;
      return true;
    });
    // Apply Quick Filter
    if (fileListFilter) {
      const lower = fileListFilter.toLowerCase().normalize('NFKC');
      filtered = filtered.filter((e) => 
        e.name.toLowerCase().normalize('NFKC').includes(lower)
      );
    }

    const mul = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if ((a?.isDirectory ?? false) !== (b?.isDirectory ?? false)) return a?.isDirectory ? -1 : 1;
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = (a?.name ?? '').localeCompare(b?.name ?? '', undefined, { sensitivity: 'base' });
      } else if (sortBy === 'size') {
        cmp = (a?.size ?? 0) - (b?.size ?? 0);
      } else if (sortBy === 'mtime') {
        cmp = (a?.mtime ?? 0) - (b?.mtime ?? 0);
      } else {
        cmp = getFileType(a).localeCompare(getFileType(b));
      }
      return cmp * mul;
    });
  }, [entries, sortBy, sortOrder, fileListFilter]);

  const virtualizer = useVirtualizer({
    count: sortedEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20, // .file-list-item height is 20px
    overscan: 20,
  });

  // Auto-scroll to selected items (ensures the primary highlighted item is visible)
  useEffect(() => {
    if (!selectedPath) return;
    
    const idx = sortedEntries.findIndex(e => normalizePath(e.path) === normalizePath(selectedPath));
    if (idx < 0) return;
    
    // Scroll to the primary selection with alignment 'auto'
    virtualizer.scrollToIndex(idx, { align: 'auto' });
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

  const currentPath = useViewerStore((s) => s.currentPath);
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
    name: { label: '名前', sortBy: 'name', className: 'file-list-col-name' },
    size: { label: 'サイズ', sortBy: 'size', className: 'file-list-col-size' },
    type: { label: '種類', sortBy: 'type', className: 'file-list-col-type' },
    mtime: { label: '更新日時', sortBy: 'mtime', className: 'file-list-col-mtime' },
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
    <div className="file-list" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="file-list-filter-bar">
        <label className="file-list-filter-label">Filter:</label>
        <input
          type="text"
          className="file-list-filter-input"
          value={fileListFilter}
          onChange={(e) => setFileListFilter(e.target.value)}
          placeholder=""
          spellCheck={false}
        />
        {fileListFilter && (
          <button className="file-list-filter-clear" onClick={() => setFileListFilter('')}>×</button>
        )}
      </div>
      <div className="file-list-header">
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
        {isLoading && <div className={styles.loadingOverlay}>読み込み中...</div>}
        {error && <div className={styles.errorOverlay} role="alert">{error}</div>}

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
              <div
                key={virtualItem.key}
                data-path={e.path}
                className={`${styles.item} ${selectedPaths.some(p => normalizePath(p) === normalizePath(e.path)) ? styles.selected : ''} ${e.isArchive ? styles.itemArchive : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                onClick={(ev) => handleSelect(e, ev)}
                onDoubleClick={() => handleDoubleClick(e)}
                onContextMenu={(ev) => handleContextMenu(ev, e)}
              >
                <span className={styles.itemColIcon}>
                  <FileIcon path={e.path} isDirectory={e.isDirectory} size={16} />
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
                        editingPath === e.path ? (
                          <input
                            type="text"
                            className={styles.renameInput}
                            defaultValue={e.name ?? '-'}
                            autoFocus
                            onClick={(ev) => ev.stopPropagation()}
                            onDoubleClick={(ev) => ev.stopPropagation()}
                            onFocus={(ev) => {
                              const input = ev.target;
                              const val = input.value;
                              if (!e.isDirectory) {
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
                                handleRenameSave(e.path, ev.currentTarget.value.trim(), e.isDirectory);
                              } else if (ev.key === 'Escape') {
                                ev.preventDefault();
                                setEditingPath(null);
                              }
                            }}
                            onBlur={(ev) => handleRenameSave(e.path, ev.target.value.trim(), e.isDirectory)}
                          />
                        ) : (
                          e?.name ?? '-'
                        )
                      ) : colId === 'size' ? (
                        e?.isDirectory ? '' : formatSize(e?.size)
                      ) : colId === 'type' ? (
                        getFileType(e)
                      ) : colId === 'mtime' ? (
                        formatMtime(e?.mtime)
                      ) : null}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
        {!isLoading && !error && sortedEntries.length === 0 && (
          <div className={styles.empty}>フォルダや画像・動画・音楽がありません</div>
        )}
      </div>
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
              const isActuallyVirtual = isVirtual || itemPath.includes('!') || contextMenu.entry.name.startsWith('7z');
              if (isActuallyVirtual) return;
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
              const isActuallyVirtual = isVirtual || itemPath.includes('!') || contextMenu.entry.name.startsWith('7z');
              if (isActuallyVirtual) return;
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
