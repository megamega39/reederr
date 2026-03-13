import { create } from 'zustand';
import { FileSystemAPI } from '../services/api';
import { DirectoryEntry } from '../types';
import { normalizePath, getParentPath, ensureOpenedPath } from './viewerStore.utils';
import { AnyPath, toAnyPath } from '../types/paths';
import { useFavoriteStore } from './favoriteStore';
import { useAppStore } from './appStore';
import { useLayoutStore } from './layoutStore';

export interface TreeState {
  treeRoots: { name: string; path: string }[];
  expandedPaths: Record<AnyPath, boolean>;
  treeChildren: Record<AnyPath, DirectoryEntry[]>;
  loadingPaths: Record<AnyPath, boolean>;
  editingNodeId: string | null;

  setTreeRoots: (roots: { name: string; path: AnyPath }[]) => void;
  setEditingNodeId: (id: string | null) => void;
  toggleExpand: (path: AnyPath | string) => void;
  expandPath: (path: AnyPath | string) => void;
  refreshTreeChildren: (path: AnyPath) => void;
  ensureTreeChildren: (idOrPath: AnyPath | string) => Promise<void>;
  initTree: () => Promise<void>;
  expandAncestors: (path: AnyPath) => void;
  initExpandedFolders: () => Promise<void>;
  revealPath: (path: AnyPath) => Promise<void>;
}

export const useTreeStore = create<TreeState>((set, get) => ({
  treeRoots: [],
  expandedPaths: {},
  treeChildren: {},
  loadingPaths: {},
  editingNodeId: null,

  setEditingNodeId: (id) => set({ editingNodeId: id }),
  setTreeRoots: (roots) => set({ treeRoots: roots }),
  
  toggleExpand: (nodeId) =>
    set((s) => {
      const isExpanding = !s.expandedPaths[nodeId as AnyPath];
      const nextExpanded = { ...s.expandedPaths };
      
      if (isExpanding) {
        nextExpanded[nodeId as AnyPath] = true;
      } else {
        // Collapsing: Clean up descendant expansion states to prevent "ghost" expansions
        delete nextExpanded[nodeId as AnyPath];
        
        // Find and remove descendants
        const descendantPrefix = (nodeId === 'pc-pc') ? 'pc-' : 
                                (nodeId === 'network-network') ? 'network-' : 
                                null;

        Object.keys(nextExpanded).forEach(key => {
          if (descendantPrefix) {
            // For virtual roots, anything starting with the prefix (except the root itself) is a descendant
            if (key.startsWith(descendantPrefix) && key !== nodeId) {
              delete nextExpanded[key as AnyPath];
            }
          } else {
            // For normal folders/archives, use path separators
            if (key.startsWith(nodeId + '/') || key.startsWith(nodeId + '!')) {
              delete nextExpanded[key as AnyPath];
            }
          }
        });
      }
      
      return { expandedPaths: nextExpanded };
    }),
    
  expandPath: (path) =>
    set((s) => ({
      expandedPaths: { ...s.expandedPaths, [path as AnyPath]: true },
    })),

  refreshTreeChildren: (path) => {
    const resolvedPath = ensureOpenedPath(path);
    set((s) => {
      const next = { ...s.treeChildren };
      delete next[resolvedPath];
      return { treeChildren: next };
    });
  },

  ensureTreeChildren: async (idOrPath) => {
    let rawPath = idOrPath;
    if (idOrPath.startsWith('pc-') || idOrPath.startsWith('special-') || idOrPath.startsWith('favorite-') || idOrPath.startsWith('network-')) {
      rawPath = idOrPath.slice(idOrPath.indexOf('-') + 1);
    }

    const normRaw = normalizePath(rawPath);
    const resolvedPath = ensureOpenedPath(normRaw);
    const finalKey = normalizePath(resolvedPath);

    const { treeChildren, loadingPaths } = get();
    // Allow retry for virtual roots or if the last fetch resulted in empty children
    const isVirtualRoot = finalKey === 'pc' || finalKey === 'network';
    const hasCachedChildren = treeChildren[finalKey] && treeChildren[finalKey].length > 0;
    
    if ((hasCachedChildren && !isVirtualRoot) || loadingPaths[finalKey]) return;

    // Set loading state
    set((s) => ({ loadingPaths: { ...s.loadingPaths, [finalKey]: true } }));

    try {
      let children: DirectoryEntry[] = [];
      const lowerResolved = resolvedPath.toLowerCase();

      if (lowerResolved === 'pc') {
        const res = await FileSystemAPI.getDrives();
        if (res.ok) {
          children = res.value.map((d) => ({ 
            name: d.name, 
            path: normalizePath(d.path),
            isDirectory: true, 
            isArchive: false 
          }));
        }
      } else if (lowerResolved === 'network') {
        const res = await FileSystemAPI.getNetworkResources();
        if (res.ok) {
          children = res.value.map((r) => ({ 
            name: r.name, 
            path: normalizePath(r.path), 
            isDirectory: true, 
            isArchive: false 
          }));
        }
      } else {
        // Windows Fix: Drives like "C:" need a trailing slash for some readdir implementations
        // although normalizePath removes it, the Backend usually needs it for roots.
        let fetchPath: string = resolvedPath;
        if (fetchPath.match(/^[a-zA-Z]:$/)) {
          fetchPath += '/';
        }

        const result = await FileSystemAPI.listDirectory(fetchPath, { skipStats: true });
        if (!result.ok) {
           throw new Error(result.error);
        }
        const files = Array.isArray(result.value) ? result.value : [];
        children = files
          .filter((e) => e && (e.isDirectory || e.isArchive))
          .map((e) => ({ 
            name: e.name, 
            path: normalizePath(e.path),
            isDirectory: e.isDirectory, 
            isArchive: e.isArchive ?? false 
          }));
      }
      const sortedChildren = children.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      
      set((s) => ({
        treeChildren: { ...s.treeChildren, [finalKey]: sortedChildren },
        loadingPaths: { ...s.loadingPaths, [finalKey]: false }
      }));
    } catch (err) {
      console.error(`[TreeStore] Failed to load children for ${finalKey}:`, err);
      set((s) => ({ 
        treeChildren: { ...s.treeChildren, [finalKey]: [] },
        loadingPaths: { ...s.loadingPaths, [finalKey]: false }
      }));
    }
  },

  initTree: async () => {
    const { treeRoots, setTreeRoots } = get();
    if (treeRoots.length > 0) return;

    const tryInit = async (): Promise<void> => {
      try {
        const res = await FileSystemAPI.getSpecialFolders();
        if (res.ok) {
          const pc = { name: 'PC', path: toAnyPath('pc') };
          const network = { name: 'network', path: toAnyPath('network') };
          const rootsWithPaths = res.value.map(v => ({
            ...v,
            path: normalizePath(v.path)
          }));
          setTreeRoots([...rootsWithPaths, pc, network]);
        } else {
          throw new Error(res.error);
        }
      } catch (err) {
        useAppStore.getState().setError(err instanceof Error ? err.message : String(err));
      }
    };
    await tryInit();
  },

  expandAncestors: (path: AnyPath) => {
    if (!path || path === 'pc') return;
    set((s) => ({ expandedPaths: { ...s.expandedPaths, [path]: true } }));
    const parent = getParentPath(path);
    if (parent) {
      get().expandAncestors(parent);
    }
  },

  initExpandedFolders: async () => {
    const { expandedPaths, ensureTreeChildren } = get();
    const paths = Object.keys(expandedPaths).filter(p => expandedPaths[p as AnyPath]);
    await Promise.all(paths.map(p => ensureTreeChildren(p as AnyPath)));
  },

  revealPath: async (path: string) => {
    if (!path) return;
    const lowerPath = path.toLowerCase();
    if (lowerPath === 'pc' || lowerPath === 'network') return;
    const { treeRoots } = get();
    const favorites = useFavoriteStore.getState().favorites;
    
    const targetPath = normalizePath(path);
    const targetPathLower = targetPath.toLowerCase();
    const activeTreePrefix = useLayoutStore.getState().activeTreePrefix;

    const roots = [
      ...favorites.map((f: any) => ({ path: f.path, type: 'favorite' as const })),
      ...treeRoots.filter((r: any) => r.path !== 'pc').map((r: any) => ({ path: r.path, type: 'special' as const }))
    ];

    let root: { path: string, type: 'favorite' | 'special' } | null = null;
    
    // Priority 1: Check if the currently active prefix can handle this path
    if (activeTreePrefix && activeTreePrefix !== 'pc' && activeTreePrefix !== 'network') {
      for (const r of roots) {
        if (r.type === activeTreePrefix) {
          const normR = normalizePath(r.path).toLowerCase();
          if (targetPathLower === normR || targetPathLower.startsWith(normR + '/') || targetPathLower.match(new RegExp('^' + normR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[!]'))) {
             root = r;
             break;
          }
        }
      }
    }

    // Priority 2: If no active root match, search all favorite/special roots
    if (!root) {
      for (const r of roots) {
        const normR = normalizePath(r.path).toLowerCase();
        if (targetPathLower === normR || targetPathLower.startsWith(normR + '/') || targetPathLower.match(new RegExp('^' + normR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[!]'))) {
          if (!root || r.path.length > root.path.length) {
            root = r;
          }
        }
      }
      // NEW: Auto-switch activeTreePrefix to the matching root type if it was not set or was PC
      if (root && (!activeTreePrefix || activeTreePrefix === 'pc')) {
        useLayoutStore.getState().setActiveTreePrefix(root.type);
      }
    }

    // Priority 3: If still no root and active prefix is 'pc', force PC branch even if it could be a favorite
    const currentPrefix = useLayoutStore.getState().activeTreePrefix;
    const shouldForcePC = !root || currentPrefix === 'pc';

    const breadcrumbs: string[] = [];
    if (root && !shouldForcePC) {
      const prefix = root.type;
      const rootPath = normalizePath(root.path);
      breadcrumbs.push(`${prefix}-${rootPath}`);
      
      const sub = targetPath.slice(rootPath.length).replace(/^[/\\]+/, '');
      if (sub) {
        let acc: string = rootPath;
        const parts = sub.split(/[/\\]/);
        for (const part of parts) {
          if (!part) continue;
          if (part.includes('!')) {
            const [archive, ...rest] = part.split('!');
            acc += (acc.endsWith('/') ? '' : '/') + archive;
            breadcrumbs.push(`${prefix}-${normalizePath(acc as AnyPath)}`);
            acc += '!';
            for (let i = 0; i < rest.length; i++) {
              if (rest[i]) {
                acc += (i > 0 ? '/' : '') + rest[i];
                breadcrumbs.push(`${prefix}-${normalizePath(acc as AnyPath)}`);
              }
            }
          } else {
            acc += (acc.endsWith('/') || acc.endsWith('!')) ? '' : '/';
            acc += part;
            breadcrumbs.push(`${prefix}-${normalizePath(acc as AnyPath)}`);
          }
        }
      }
    } else {
      breadcrumbs.push('pc-pc');
      let acc: string = '';
      const parts = targetPath.split(/[/\\]/);
      for (const part of parts) {
        if (!part) continue;
        if (part.includes('!')) {
          const [archive, ...rest] = part.split('!');
          if (acc && !acc.endsWith('/') && !acc.endsWith('!')) acc += '/';
          acc += archive;
          breadcrumbs.push(`pc-${normalizePath(acc as AnyPath)}`);
          acc += '!';
          for (let i = 0; i < rest.length; i++) {
            if (rest[i]) {
              acc += (i > 0 ? '/' : '') + rest[i];
              breadcrumbs.push(`pc-${normalizePath(acc as AnyPath)}`);
            }
          }
        } else {
          if (acc && !acc.endsWith('/') && !acc.endsWith('!')) acc += '/';
          acc += part;
          breadcrumbs.push(`pc-${normalizePath(acc as AnyPath)}`);
        }
      }
    }

    const uniqueIds = Array.from(new Set(breadcrumbs));
    
    set((s) => {
      const nextExpanded = { ...s.expandedPaths };
      
      // Apply breadcrumbs for the current reveal
      uniqueIds.forEach(id => {
        nextExpanded[id as AnyPath] = true;
      });
      
      return { expandedPaths: nextExpanded };
    });

    // Load children matching the breadcrumbs
    for (const id of uniqueIds) {
      const p = id.includes('-') ? id.slice(id.indexOf('-') + 1) : id;
      await get().ensureTreeChildren(normalizePath(p));
    }
  },
}));
