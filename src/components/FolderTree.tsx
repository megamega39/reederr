import { useState, useCallback, useEffect, useRef } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { FileIcon } from './FileIcon';
import { FolderContextMenu } from './FolderContextMenu';

function getParentPath(p: string): string | null {
  const m = p.match(/^(.+)[/\\][^/\\]*$/);
  return m ? m[1] : null;
}

function isArchivePath(path: string): boolean {
  const lower = path.toLowerCase();
  return ['.zip', '.rar', '.cbz', '.cbr'].some((ext) => lower.endsWith(ext));
}

function TreeItem({
  entry,
  depth,
  isSelected,
  prefix,
}: {
  entry: { name: string; path: string; isDirectory: boolean; isArchive?: boolean };
  depth: number;
  isSelected: boolean;
  prefix: string;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isSelected && itemRef.current) {
      const el = itemRef.current;
      setTimeout(() => {
        if (el.isConnected) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [isSelected]);

  const nodeKey = `${prefix}-${entry.path}`;
  const expanded = useViewerStore((s) => s.expandedPaths[nodeKey]);
  const toggleExpand = useViewerStore((s) => s.toggleExpand);
  const ensureTreeChildren = useViewerStore((s) => s.ensureTreeChildren);
  const treeChildren = useViewerStore((s) => s.treeChildren);
  const currentPath = useViewerStore((s) => s.currentPath);
  const loadDirectory = useViewerStore((s) => s.loadDirectory);
  const isArchive = entry.isArchive ?? isArchivePath(entry.path);
  // data fetching still uses raw path
  const treeLookupPath = isArchive ? entry.path + '!' : entry.path;
  const children = treeChildren[treeLookupPath] ?? [];
  const hasChildren = children.length > 0;
  const childrenLoaded = treeLookupPath in treeChildren;
  const isExpandable = isArchive || !childrenLoaded || hasChildren;

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isArchive) {
      loadDirectory(entry.path);
      toggleExpand(nodeKey);
      return;
    }
    if (!childrenLoaded) await ensureTreeChildren(entry.path);
    toggleExpand(nodeKey);
  };

  const handleClick = () => {
    loadDirectory(entry.path);
    if (isArchive) toggleExpand(nodeKey);
  };

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleExpandFromMenu = useCallback(async () => {
    if (!childrenLoaded) await ensureTreeChildren(entry.path);
    toggleExpand(nodeKey);
  }, [childrenLoaded, ensureTreeChildren, entry.path, nodeKey, toggleExpand]);

  return (
    <div className="tree-item-wrap">
      <div
        id={isSelected ? "active-tree-node" : undefined}
        ref={itemRef}
        className={`tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: depth === 0 ? 8 : 4 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span
          className={`tree-expand ${isExpandable ? '' : 'empty'}`}
          onClick={isExpandable ? handleExpand : undefined}
          role="button"
          aria-expanded={expanded}
        >
          {isExpandable ? (expanded ? '−' : '+') : '　'}
        </span>
        <FileIcon path={entry.path} isDirectory={entry.isDirectory} size={16} />
        <span className="tree-name">{entry.name}</span>
      </div>
      {contextMenu && (
        <FolderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={entry.path}
          parentPath={getParentPath(entry.path)}
          isVirtual={false}
          onExpand={handleExpandFromMenu}
          onClose={closeContextMenu}
        />
      )}
      {expanded &&
        isExpandable &&
        children.map((c) => (
          <TreeItem
            key={`${prefix}-${c.path}`}
            entry={c}
            depth={depth + 1}
            isSelected={currentPath === c.path}
            prefix={prefix}
          />
        ))}
    </div>
  );
}

function TreeRootItem({ root }: { root: { name: string; path: string } }) {
  const currentPath = useViewerStore((s) => s.currentPath);
  const treeChildren = useViewerStore((s) => s.treeChildren);
  const loadDirectory = useViewerStore((s) => s.loadDirectory);
  const toggleExpand = useViewerStore((s) => s.toggleExpand);
  const ensureTreeChildren = useViewerStore((s) => s.ensureTreeChildren);
  const children = treeChildren[root.path] ?? [];
  const childrenLoaded = root.path in treeChildren;
  const hasChildren = root.path === 'pc' ? true : children.length > 0;
  const isExpandable = root.path === 'pc' || !childrenLoaded || hasChildren;
  const isVirtual = root.path === 'pc';
  const prefix = isVirtual ? 'pc' : 'special';
  const nodeKey = `${prefix}-${root.path}`;
  const expanded = useViewerStore((s) => s.expandedPaths[nodeKey]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const itemRef = useRef<HTMLDivElement>(null);
  const isSelected = currentPath === root.path;
  useEffect(() => {
    if (isSelected && itemRef.current) {
      const el = itemRef.current;
      setTimeout(() => {
        if (el.isConnected) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [isSelected]);

  return (
    <div className="tree-item-wrap">
      <div
        id={isSelected ? "active-tree-node" : undefined}
        ref={itemRef}
        className={`tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: 8 }}
        onClick={() => !isVirtual && loadDirectory(root.path)}
        onContextMenu={(e) => {
          if (!isVirtual) {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }
        }}
      >
        <span
          className={`tree-expand ${isExpandable ? '' : 'empty'}`}
          onClick={
            isExpandable
              ? async (e: React.MouseEvent) => {
                e.stopPropagation();
                if (!(root.path in treeChildren)) await ensureTreeChildren(root.path);
                toggleExpand(nodeKey);
              }
              : undefined
          }
          role="button"
        >
          {isExpandable ? (expanded ? '−' : '+') : '　'}
        </span>
        <FileIcon
          path={isVirtual ? 'C:\\' : root.path}
          isDirectory
          size={16}
        />
        <span className="tree-name">{root.name}</span>
      </div>
      {contextMenu && !isVirtual && (
        <FolderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={root.path}
          parentPath={getParentPath(root.path)}
          isVirtual={false}
          onExpand={async () => {
            if (!(root.path in treeChildren)) await ensureTreeChildren(root.path);
            toggleExpand(nodeKey);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
      {expanded &&
        isExpandable &&
        children.map((c) => (
          <TreeItem
            key={`${prefix}-${c.path}`}
            entry={c}
            depth={0}
            isSelected={currentPath === c.path}
            prefix={prefix}
          />
        ))}
    </div>
  );
}

function FavoritesRootItem() {
  const favorites = useViewerStore((s) => s.favorites);
  const currentPath = useViewerStore((s) => s.currentPath);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tree-item-wrap">
      <div
        className="tree-item"
        style={{ paddingLeft: 8 }}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="tree-expand"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          role="button"
        >
          {expanded ? '−' : '+'}
        </span>
        <span style={{ fontSize: 14, marginRight: 2 }}>⭐</span>
        <span className="tree-name">お気に入り</span>
      </div>
      {expanded &&
        favorites.map((fav) => (
          <TreeItem
            key={`favorite-${fav.path}`}
            entry={{ name: fav.name, path: fav.path, isDirectory: true }}
            depth={1}
            isSelected={currentPath === fav.path}
            prefix="favorite"
          />
        ))}
    </div>
  );
}

export function FolderTree() {
  const treeRoots = useViewerStore((s) => s.treeRoots);
  const error = useViewerStore((s) => s.error);
  const refreshTreeChildren = useViewerStore((s) => s.refreshTreeChildren);
  const expandPath = useViewerStore((s) => s.expandPath);

  useEffect(() => {
    const onFolderCreated = (e: Event) => {
      const { parentPath } = (e as CustomEvent).detail;
      if (parentPath) {
        refreshTreeChildren(parentPath);
        expandPath(parentPath);
      }
    };
    const onFolderRenamed = (e: Event) => {
      const { path } = (e as CustomEvent).detail;
      const parent = getParentPath(path);
      if (parent) refreshTreeChildren(parent);
    };
    const onFolderDeleted = (e: Event) => {
      const { path } = (e as CustomEvent).detail;
      const parent = getParentPath(path);
      if (parent) refreshTreeChildren(parent);
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

  // Close favorites context menu on global click
  useEffect(() => {
    const h = () => { };
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);

  if (treeRoots.length === 0) {
    return (
      <div className="folder-tree">
        <div className="folder-tree-header">フォルダ</div>
        <div className="folder-tree-content">
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
      <div className="folder-tree-content">
        <FavoritesRootItem />
        {treeRoots.map((root) => (
          <TreeRootItem key={root.path} root={root} />
        ))}
      </div>
    </div>
  );
}

