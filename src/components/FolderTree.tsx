import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTreeStore } from '../stores/treeStore';
import { useFavoriteStore } from '../stores/favoriteStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useAppStore } from '../stores/appStore';
import { normalizePath, isArchivePath, getParentPath, resolveArchivePath } from '../stores/viewerStore.utils';
import { FileIcon } from './FileIcon';
import { useLayoutStore } from '../stores/layoutStore';
import { FolderContextMenu } from './FolderContextMenu';
import { FileSystemAPI } from '../services/api';
import { ChevronRight, ChevronDown, Star } from 'lucide-react';
import { useTranslation } from '../i18n';

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
  const { t } = useTranslation();
  
    const { treeRoots, treeChildren, expandedPaths, loadingPaths, refreshTreeChildren, expandPath } = useTreeStore(
      useShallow((s) => ({
        treeRoots: s.treeRoots,
        treeChildren: s.treeChildren,
        expandedPaths: s.expandedPaths,
        loadingPaths: s.loadingPaths,
        refreshTreeChildren: s.refreshTreeChildren,
        expandPath: s.expandPath,
      }))
    );

  const { favorites } = useFavoriteStore(
    useShallow((s) => ({
      favorites: s.favorites,
    }))
  );

  const { currentPath } = useNavigationStore(
    useShallow((s) => ({
      currentPath: s.currentPath,
    }))
  );

  const { error } = useAppStore(
    useShallow((s) => ({
      error: s.error,
    }))
  );

  const [favExpanded, setFavExpanded] = useState(true);

  // Flatten the tree for virtualization
  const flatNodes = useMemo(() => {
    const nodes: FlatNode[] = [];

    // Recursive helper to add children
    const addNodes = (parentPath: string, depth: number, prefix: string) => {
      const normParent = normalizePath(parentPath);
      const isArch = isArchivePath(normParent);
      const lookupPath = isArch && !normParent.includes('!') ? normParent + '!' : normParent;
      const children = treeChildren[normalizePath(lookupPath)];
      if (!children) return;
      
      for (const child of children) {
        const normPath = child.path; // Already normalized in store
        const nodeKey = `${prefix}-${normPath}`;
        const isExpanded = expandedPaths[nodeKey];
        
        nodes.push({
          id: nodeKey,
          name: child.name,
          path: normPath,
          depth,
          isDirectory: child.isDirectory,
          isArchive: !!(child.isArchive ?? isArchivePath(normPath)),
          prefix
        });

        if (isExpanded) {
          addNodes(normPath, depth + 1, prefix);
        }
      }
    };

    // Favorites Section
    nodes.push({
      id: 'favorite-header',
      name: t('tree.favorites'),
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
      const isVirtual = normPath === 'pc' || normPath === 'network';
      const prefix = normPath === 'pc' ? 'pc' : (normPath === 'network' ? 'network' : 'special');
      const nodeKey = `${prefix}-${normPath}`;
      
      nodes.push({
        id: nodeKey,
        name: (root.path === 'pc' || root.path === 'network') ? t(`tree.${root.path}` as any) : root.name,
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
    estimateSize: () => 18,
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

  const { isRestoring, isHydrated } = useAppStore(
    useShallow((s) => ({
      isRestoring: s.isRestoring,
      isHydrated: s.isHydrated,
    }))
  );
  const lastScrolledPath = useRef<string | null>(null);

  // Scroll current path into view when it changes, when list grows, or when restoration state changes
  useEffect(() => {
    if (!currentPath || !isHydrated) return;
    
    // Normalize consistently for comparison
    const normCurrent = normalizePath(currentPath).toLowerCase();
    
    // Smart Scroll: Find the exact index, or the closest visible ancestor
    const findBestIndex = () => {
      // 1. Try exact match
      const exactIdx = flatNodes.findIndex(n => normalizePath(n.path).toLowerCase() === normCurrent);
      if (exactIdx >= 0) return exactIdx;
      
      // 2. Try closest ancestor
      let parent = getParentPath(currentPath);
      while (parent) {
        const normParent = normalizePath(parent).toLowerCase();
        const parentIdx = flatNodes.findIndex(n => normalizePath(n.path).toLowerCase() === normParent);
        if (parentIdx >= 0) return parentIdx;
        parent = getParentPath(parent);
      }
      return -1;
    };

    const targetIdx = findBestIndex();
    
    if (targetIdx >= 0) {
      const performScroll = () => {
        if (!parentRef.current) return;
        virtualizer.scrollToIndex(targetIdx, { align: 'center', behavior: 'auto' });
        
        const isExact = normalizePath(flatNodes[targetIdx].path).toLowerCase() === normCurrent;
        if (isExact) {
          lastScrolledPath.current = normCurrent;
        }
      };

      // During restoration, we perform multiple attempts with a delay
      if (isRestoring) {
        const timer = setTimeout(performScroll, 500); 
        return () => clearTimeout(timer);
      } 
      
      // If we just finished restoring or if path changed, perform a clean final scroll
      if (lastScrolledPath.current !== normCurrent) {
        const timer = setTimeout(performScroll, 200);
        return () => clearTimeout(timer);
      } else {
        // Immediate scroll for normal navigation
        performScroll();
      }
    }
  }, [currentPath, virtualizer, flatNodes.length, isHydrated, isRestoring]);

  if (treeRoots.length === 0) {
    return (
      <div className="folder-tree">
        <div className="folder-tree-header">{t('tree.header')}</div>
        <div className="folder-tree-content" ref={parentRef}>
          <div className="folder-tree-empty">
            {error ? `⚠ ${error}` : t('common.loading')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="folder-tree">
      <div className="folder-tree-header">{t('tree.header')}</div>
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
                // Optimization: Pass necessary state from parent to avoid per-row store subscriptions
                loaded={!!treeChildren[normalizePath(node.isArchive ? node.path + '!' : node.path)]}
                isLoading={!!loadingPaths[normalizePath(node.isArchive ? node.path + '!' : node.path)]}
                hasChildren={node.isVirtual ? true : (treeChildren[normalizePath(node.isArchive ? node.path + '!' : node.path)]?.length ?? 0) > 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TreeItemRow = React.memo(function TreeItemRow({
  node,
  virtualItem,
  isSelected,
  isActiveArchive,
  isExpanded,
  onToggleFav,
  loaded,
  isLoading,
  hasChildren
}: {
  node: FlatNode;
  virtualItem: any;
  isSelected: boolean;
  isActiveArchive: boolean;
  isExpanded: boolean;
  onToggleFav: () => void;
  loaded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
}) {
  const { toggleExpand, ensureTreeChildren, setEditingNodeId, editingNodeId } = useTreeStore(
    useShallow((s) => ({
      toggleExpand: s.toggleExpand,
      ensureTreeChildren: s.ensureTreeChildren,
      setEditingNodeId: s.setEditingNodeId,
      editingNodeId: s.editingNodeId,
    }))
  );

  const setActiveTreePrefix = useLayoutStore((s) => s.setActiveTreePrefix);

  const { loadDirectory } = useNavigationStore(
    useShallow((s) => ({
      loadDirectory: s.loadDirectory,
    }))
  );
  
  const setHoveredItem = useLayoutStore((s) => s.setHoveredItem);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isExpandable = node.isArchive || !loaded || hasChildren || node.isFavoriteHeader;

  const handleExpand = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveTreePrefix(node.prefix);
    if (isLoading) return; 
    
    if (node.isFavoriteHeader) {
      onToggleFav();
      return;
    }
    
    // Toggle IMMEDIATELY for responsiveness
    toggleExpand(node.id);

    const lookupPath = node.isArchive ? node.path + '!' : node.path;
    
    if (node.isArchive) {
      loadDirectory(node.path);
    }
    
    // Critical Fix: If it's a virtual root and we are expanding, 
    // force a refresh if it's currently empty to recover from previous failures.
    const isVirtualRoot = node.path === 'pc' || node.path === 'network';
    if (!loaded || (isVirtualRoot && !hasChildren)) {
      ensureTreeChildren(lookupPath).catch(err => {
        console.error('[Tree] Deferred load failed:', err);
      });
    }
  };

  const handleClick = () => {
    setActiveTreePrefix(node.prefix);
    if (node.isFavoriteHeader) {
      handleExpand();
      return;
    }
    loadDirectory(node.path);
    if (node.isArchive || node.isVirtual) handleExpand();
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
    
    const parentPath = getParentPath(node.path);
    if (parentPath) {
      const tree = useTreeStore.getState();
      tree.refreshTreeChildren(parentPath);
      await tree.ensureTreeChildren(parentPath);
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
        onMouseEnter={(e) => setHoveredItem(node.path, { x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHoveredItem(null)}
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
          <FileIcon path={node.path === 'pc' ? 'pc' : (node.path === 'network' ? 'network' : node.path)} isDirectory={node.isDirectory} size={16} />
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
});

