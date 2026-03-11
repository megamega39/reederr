import { useState, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from '../stores/viewerStore';
import { normalizePath, isArchivePath, getParentPath, resolveArchivePath } from '../stores/viewerStore.utils';
import { FileIcon } from './FileIcon';
import { FolderContextMenu } from './FolderContextMenu';
import { FileSystemAPI } from '../services/api';
import { ChevronRight, ChevronDown, Star } from 'lucide-react';

interface FlatNode {
  id: string;
  name: string;
  path: string;
  depth: number;
  isDirectory: boolean;
  isArchive: boolean;
  isRoot?: boolean;
  isVirtual?: boolean;
  isFavoriteHeader?: boolean;
  prefix: string;
}

export function FolderTree() {
  const treeRoots = useViewerStore((s) => s.treeRoots);
  const treeChildren = useViewerStore((s) => s.treeChildren);
  const expandedPaths = useViewerStore((s) => s.expandedPaths);
  const favorites = useViewerStore((s) => s.favorites);
  const currentPath = useViewerStore((s) => s.currentPath);
  const error = useViewerStore((s) => s.error);

  const refreshTreeChildren = useViewerStore((s) => s.refreshTreeChildren);
  const expandPath = useViewerStore((s) => s.expandPath);

  const [favExpanded, setFavExpanded] = useState(true);

  // Flatten the tree for virtualization
  const flatNodes = useMemo(() => {
    const nodes: FlatNode[] = [];

    // Recursive helper to add children
    const addNodes = (parentPath: string, depth: number, prefix: string) => {
      const isArch = isArchivePath(parentPath);
      const lookupPath = isArch ? parentPath + '!' : parentPath;
      const children = treeChildren[lookupPath] ?? [];
      
      children.forEach(child => {
        const normPath = normalizePath(child.path);
        const nodeKey = `${prefix}-${normPath}`;
        const isCollapsed = !expandedPaths[nodeKey];
        
        nodes.push({
          id: nodeKey,
          name: child.name,
          path: normPath,
          depth,
          isDirectory: child.isDirectory,
          isArchive: !!(child.isArchive ?? isArchivePath(normPath)),
          prefix
        });

        if (!isCollapsed) {
          addNodes(normPath, depth + 1, prefix);
        }
      });
    };

    // Favorites Section
    nodes.push({
      id: 'favorite-header',
      name: 'お気に入り',
      path: 'favorites',
      depth: 0,
      isDirectory: true,
      isArchive: false,
      isFavoriteHeader: true,
      prefix: 'fav'
    });

    if (favExpanded) {
      favorites.forEach(fav => {
        const normPath = normalizePath(fav.path);
        const nodeKey = `favorite-${normPath}`;
        const isArch = isArchivePath(normPath);
        nodes.push({
          id: nodeKey,
          name: fav.name,
          path: normPath,
          depth: 1,
          isDirectory: true,
          isArchive: isArch,
          prefix: 'favorite'
        });

        if (expandedPaths[nodeKey]) {
          addNodes(normPath, 2, 'favorite');
        }
      });
    }

    // Drive/Root Section
    treeRoots.forEach(root => {
      const normPath = normalizePath(root.path);
      const isVirtual = normPath === 'pc';
      const prefix = isVirtual ? 'pc' : 'special';
      const nodeKey = `${prefix}-${normPath}`;
      
      nodes.push({
        id: nodeKey,
        name: root.name,
        path: normPath,
        depth: 0,
        isDirectory: true,
        isArchive: false,
        isRoot: true,
        isVirtual,
        prefix
      });

      if (expandedPaths[nodeKey]) {
        addNodes(normPath, 1, prefix);
      }
    });

    return nodes;
  }, [treeRoots, treeChildren, expandedPaths, favorites, favExpanded]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 20
  });

  // Global Handlers
  useEffect(() => {
    const onFolderCreated = (e: Event) => {
      const { parentPath } = (e as CustomEvent).detail;
      if (parentPath) {
        const normParent = normalizePath(parentPath);
        refreshTreeChildren(normParent);
        expandPath(normParent);
      }
    };
    const onFolderRenamed = (e: Event) => {
      const { path } = (e as CustomEvent).detail;
      const parent = getParentPath(path);
      if (parent) {
        const normParent = normalizePath(parent);
        refreshTreeChildren(normParent);
      }
    };
    const onFolderDeleted = (e: Event) => {
      const { path } = (e as CustomEvent).detail;
      const parent = getParentPath(path);
      if (parent) {
        const normParent = normalizePath(parent);
        refreshTreeChildren(normParent);
      }
    };
    window.addEventListener('folder-created', onFolderCreated);
    window.addEventListener('folder-renamed', onFolderRenamed);
    window.addEventListener('folder-deleted', onFolderDeleted);
    return () => {
      window.removeEventListener('folder-created', onFolderCreated);
      window.removeEventListener('folder-renamed', onFolderRenamed);
      window.removeEventListener('folder-deleted', onFolderDeleted);
    };
  }, [refreshTreeChildren, expandPath]);

  const isRestoring = useViewerStore((s) => s.isRestoring);
  const isHydrated = useViewerStore((s) => s.isHydrated);
  const lastScrolledPath = useRef<string | null>(null);

  // Scroll current path into view when it changes or when restoration finishes
  useEffect(() => {
    if (!currentPath || !isHydrated) return;
    
    const normCurrent = normalizePath(currentPath).toLowerCase();
    const idx = flatNodes.findIndex(n => normalizePath(n.path).toLowerCase() === normCurrent);
    
    if (idx >= 0) {
      // If we are still in the middle of restoration, or if the path just changed,
      // we might need a small delay to let the virtualizer settle.
      const performScroll = () => {
        virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'auto' });
        lastScrolledPath.current = normCurrent;
      };

      if (isRestoring || lastScrolledPath.current !== normCurrent) {
        const timer = setTimeout(performScroll, isRestoring ? 100 : 0);
        return () => clearTimeout(timer);
      } else {
        performScroll();
      }
    }
  }, [currentPath, virtualizer, flatNodes, isHydrated, isRestoring]);

  if (treeRoots.length === 0) {
    return (
      <div className="folder-tree">
        <div className="folder-tree-header">フォルダ</div>
        <div className="folder-tree-content" ref={parentRef}>
          <div className="folder-tree-empty">
            {error ? `⚠ ${error}` : '読み込み中...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="folder-tree">
      <div className="folder-tree-header">フォルダ</div>
      <div className="folder-tree-content" ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const node = flatNodes[vItem.index];
            const isSelected = currentPath && normalizePath(currentPath) === normalizePath(node.path);
            
            // Check if this node is the archive root for the current path
            const archiveRoot = currentPath ? resolveArchivePath(currentPath) : null;
            const isActiveArchive = node.isArchive && archiveRoot && normalizePath(node.path) === normalizePath(archiveRoot);

            return (
              <TreeItemRow
                key={vItem.key}
                node={node}
                virtualItem={vItem}
                isSelected={!!isSelected}
                isActiveArchive={!!isActiveArchive}
                isExpanded={!!(expandedPaths[node.id] || (node.isFavoriteHeader && favExpanded))}
                onToggleFav={() => setFavExpanded(!favExpanded)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TreeItemRow({
  node,
  virtualItem,
  isSelected,
  isActiveArchive,
  isExpanded,
  onToggleFav
}: {
  node: FlatNode;
  virtualItem: any;
  isSelected: boolean;
  isActiveArchive: boolean;
  isExpanded: boolean;
  onToggleFav: () => void;
}) {
  const loadDirectory = useViewerStore((s) => s.loadDirectory);
  const toggleExpand = useViewerStore((s) => s.toggleExpand);
  const ensureTreeChildren = useViewerStore((s) => s.ensureTreeChildren);
  const treeChildren = useViewerStore((s) => s.treeChildren);
  const editingNodeId = useViewerStore((s) => s.editingNodeId);
  const setEditingNodeId = useViewerStore((s) => s.setEditingNodeId);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isArch = !!node.isArchive;
  const lookupPath = isArch ? node.path + '!' : node.path;
  const children = treeChildren[lookupPath] ?? [];
  const hasChildren = node.isVirtual ? true : children.length > 0;
  const loaded = lookupPath in treeChildren;
  const isExpandable = isArch || !loaded || hasChildren || node.isFavoriteHeader;

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isFavoriteHeader) {
      onToggleFav();
      return;
    }
    if (node.isArchive) {
      loadDirectory(node.path);
      toggleExpand(node.id);
      return;
    }
    if (!loaded) await ensureTreeChildren(node.path);
    toggleExpand(node.id);
  };

  const handleClick = () => {
    if (node.isFavoriteHeader) {
      onToggleFav();
      return;
    }
    if (node.isVirtual) return;
    loadDirectory(node.path);
    if (node.isArchive) toggleExpand(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (node.isFavoriteHeader || node.isVirtual) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRenameSubmit = async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === node.name) {
      setEditingNodeId(null);
      return;
    }
    const result = node.isDirectory 
      ? await FileSystemAPI.renameFolder(node.path, trimmed)
      : await FileSystemAPI.renameFile(node.path, trimmed);
    
    if (!result?.ok) {
      alert(result?.error ?? '名前の変更に失敗しました');
      setEditingNodeId(null);
      return;
    }
    
    const parent = getParentPath(node.path);
    if (parent) {
      useViewerStore.getState().refreshTreeChildren(parent);
      await useViewerStore.getState().ensureTreeChildren(parent);
    }
    setEditingNodeId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'F2' && isSelected && !node.path.includes('!')) {
        e.preventDefault();
        setEditingNodeId(node.path);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, node.path, setEditingNodeId]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualItem.size}px`,
        transform: `translateY(${virtualItem.start}px)`
      }}
    >
      <div
        className={`tree-item ${isSelected ? 'selected' : ''} ${isActiveArchive ? 'active-archive' : ''}`}
        style={{ paddingLeft: node.depth * 12 + 8 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span
          className={`tree-expand ${isExpandable ? '' : 'empty'}`}
          onClick={isExpandable ? handleExpand : undefined}
          role="button"
        >
          {isExpandable ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : ' '}
        </span>
        {node.isFavoriteHeader ? (
          <Star size={14} style={{ marginRight: 4, color: '#f1c40f' }} fill="#f1c40f" />
        ) : (
          <FileIcon path={node.isVirtual ? 'C:\\' : node.path} isDirectory={node.isDirectory} size={16} />
        )}
        
        {editingNodeId === node.path ? (
          <input
            autoFocus
            type="text"
            className="tree-rename-input"
            defaultValue={node.name}
            style={{ width: '100%', outline: 'none', border: '1px solid #0078d7', background: 'transparent', color: 'inherit', marginLeft: 4, fontFamily: 'inherit', fontSize: 'inherit' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditingNodeId(null);
              else if (e.key === 'Enter') e.currentTarget.blur();
            }}
            onBlur={(e) => handleRenameSubmit(e.currentTarget.value)}
          />
        ) : (
          <span className="tree-name">{node.name}</span>
        )}
      </div>
      {contextMenu && (
        <FolderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={node.path}
          parentPath={getParentPath(node.path)}
          isVirtual={node.path.includes('!')}
          onExpand={async () => {
             if (!loaded) await ensureTreeChildren(node.path);
             toggleExpand(node.id);
          }}
          onRequestRename={() => {
            setEditingNodeId(node.path);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

