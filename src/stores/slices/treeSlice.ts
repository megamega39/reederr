import { StateCreator } from 'zustand';
import { ViewerState } from '../viewerStore.types';
import { isArchivePath, normalizePath, getParentPath } from '../viewerStore.utils';
import { FileSystemAPI } from '../../services/api';
import { DirectoryEntry } from '../../types';

export interface TreeSlice {
  treeRoots: ViewerState['treeRoots'];
  expandedPaths: ViewerState['expandedPaths'];
  treeChildren: ViewerState['treeChildren'];
  editingNodeId: ViewerState['editingNodeId'];
  setTreeRoots: ViewerState['setTreeRoots'];
  toggleExpand: ViewerState['toggleExpand'];
  expandPath: ViewerState['expandPath'];
  ensureTreeChildren: ViewerState['ensureTreeChildren'];
  refreshTreeChildren: ViewerState['refreshTreeChildren'];
  initTree: ViewerState['initTree'];
  expandAncestors: ViewerState['expandAncestors'];
  initExpandedFolders: ViewerState['initExpandedFolders'];
  revealPath: ViewerState['revealPath'];
  setEditingNodeId: ViewerState['setEditingNodeId'];
}

export const createTreeSlice: StateCreator<
  ViewerState,
  [],
  [],
  TreeSlice
> = (set, get) => ({
  treeRoots: [],
  expandedPaths: {},
  treeChildren: {},
  editingNodeId: null,

  setEditingNodeId: (id) => set({ editingNodeId: id }),
  setTreeRoots: (roots) => set({ treeRoots: roots }),
  
  toggleExpand: (path) =>
    set((s) => ({
      expandedPaths: { ...s.expandedPaths, [path]: !s.expandedPaths[path] },
    })),
    
  expandPath: (path) =>
    set((s) => ({
      expandedPaths: { ...s.expandedPaths, [path]: true },
    })),

  refreshTreeChildren: (path) => {
    const resolvedPath = isArchivePath(path) && !path.includes('!') ? path + '!' : path;
    set((s) => {
      const next = { ...s.treeChildren };
      delete next[resolvedPath];
      return { treeChildren: next };
    });
  },

  ensureTreeChildren: async (idOrPath) => {
    // Extract raw path if it's an ID (has prefix)
    let rawPath = idOrPath;
    if (idOrPath.startsWith('pc-') || idOrPath.startsWith('special-') || idOrPath.startsWith('favorite-') || idOrPath.startsWith('network-')) {
      rawPath = idOrPath.slice(idOrPath.indexOf('-') + 1);
    }

    const resolvedPath = isArchivePath(rawPath) && !rawPath.includes('!') ? rawPath + '!' : rawPath;

    if (get().treeChildren[resolvedPath]) return;

    try {
      let children: DirectoryEntry[];
      if (resolvedPath === 'pc') {
        const drives = await FileSystemAPI.getDrives();
        children = drives.map((d) => ({ ...d, isDirectory: true, isArchive: false }));
      } else if (resolvedPath === 'network') {
        const resources = await FileSystemAPI.getNetworkResources();
        children = resources.map((r) => ({ ...r, isDirectory: true, isArchive: false }));
      } else {
        const result = await FileSystemAPI.listDirectory(resolvedPath);
        const resultFiles = result && typeof result === 'object' && 'files' in result ? (result as { files: DirectoryEntry[] }).files : [];
        const files = Array.isArray(resultFiles) ? resultFiles : [];
        children = files
          .filter((e) => e && (e.isDirectory || e.isArchive))
          .map((e) => ({ name: e.name, path: e.path, isDirectory: e.isDirectory, isArchive: e.isArchive ?? false }));
      }
      const sortedChildren = children.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      set((s) => ({
        treeChildren: { ...s.treeChildren, [resolvedPath]: sortedChildren },
      }));
    } catch {
      set((s) => ({ treeChildren: { ...s.treeChildren, [resolvedPath]: [] } }));
    }
  },

  initTree: async () => {
    const { treeRoots, setTreeRoots } = get();
    if (treeRoots.length > 0) return;

    const tryInit = async (retries = 10): Promise<void> => {
      try {
        if (!FileSystemAPI.getSpecialFolders) {
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, 200));
            return tryInit(retries - 1);
          }
          get().setError('Electron API が利用できません。アプリを再起動してください。');
          return;
        }
        const roots = await FileSystemAPI.getSpecialFolders();
        const pc = { name: 'PC', path: 'pc' };
        const network = { name: 'network', path: 'network' };
        setTreeRoots([...roots, pc, network]);

        if (!get().currentPath && roots.length >= 3) {
          const downloadsPath = roots[2].path;
          set({ expandedPaths: { [downloadsPath]: true } });
          await get().loadDirectory(downloadsPath);
        }
      } catch (err) {
        get().setError(err instanceof Error ? err.message : String(err));
      }
    };
    await tryInit();
  },

  expandAncestors: (path: string) => {
    if (!path || path === 'pc') return;
    set((s) => ({ expandedPaths: { ...s.expandedPaths, [path]: true } }));
    const parent = getParentPath(path);
    if (parent) {
      get().expandAncestors(parent);
    }
  },

  initExpandedFolders: async () => {
    const { expandedPaths, ensureTreeChildren } = get();
    const paths = Object.keys(expandedPaths).filter(p => expandedPaths[p]);
    await Promise.all(paths.map(p => ensureTreeChildren(p)));
  },

  revealPath: async (path: string) => {
    if (!path || path === 'pc') return;
    const { treeRoots, favorites, ensureTreeChildren } = get();
    
    const targetPath = normalizePath(path);
    const targetPathLower = targetPath.toLowerCase();

    // 1. Find the best starting root
    const roots = [
      ...favorites.map(f => ({ path: f.path, type: 'favorite' as const })),
      ...treeRoots.filter(r => r.path !== 'pc').map(r => ({ path: r.path, type: 'special' as const }))
    ];

    let root: { path: string, type: 'favorite' | 'special' } | null = null;
    for (const r of roots) {
      const normR = normalizePath(r.path).toLowerCase();
      // Match exactly, or as a parent directory, or as an archive file boundary
      if (targetPathLower === normR || targetPathLower.startsWith(normR + '/') || targetPathLower.match(new RegExp('^' + normR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[!]'))) {
        if (!root || r.path.length > root.path.length) {
          root = r;
        }
      }
    }

    // 2. Build expansion breadcrumbs
    const breadcrumbs: string[] = [];
    if (root) {
      const prefix = root.type;
      const rootPath = normalizePath(root.path);
      breadcrumbs.push(`${prefix}-${rootPath}`);
      
      const sub = targetPath.slice(rootPath.length).replace(/^[/\\]+/, '');
      if (sub) {
        let acc = rootPath;
        const parts = sub.split(/[/\\]/);
        for (const part of parts) {
          if (!part) continue;
          if (part.includes('!')) {
            const [archive, ...rest] = part.split('!');
            acc += (acc.endsWith('/') ? '' : '/') + archive;
            breadcrumbs.push(`${prefix}-${normalizePath(acc)}`);
            acc += '!';
            for (let i = 0; i < rest.length; i++) {
              if (rest[i]) {
                acc += (i > 0 ? '/' : '') + rest[i];
                breadcrumbs.push(`${prefix}-${normalizePath(acc)}`);
              }
            }
          } else {
            acc += (acc.endsWith('/') || acc.endsWith('!')) ? '' : '/';
            acc += part;
            breadcrumbs.push(`${prefix}-${normalizePath(acc)}`);
          }
        }
      }
    } else {
      // Fallback: PC root
      breadcrumbs.push('pc-pc');
      let acc = '';
      const parts = targetPath.split(/[/\\]/);
      for (const part of parts) {
        if (!part) continue;
        if (part.includes('!')) {
          const [archive, ...rest] = part.split('!');
          if (acc && !acc.endsWith('/') && !acc.endsWith('!')) acc += '/';
          acc += archive;
          breadcrumbs.push(`pc-${normalizePath(acc)}`);
          acc += '!';
          for (let i = 0; i < rest.length; i++) {
            if (rest[i]) {
              acc += (i > 0 ? '/' : '') + rest[i];
              breadcrumbs.push(`pc-${normalizePath(acc)}`);
            }
          }
        } else {
          if (acc && !acc.endsWith('/') && !acc.endsWith('!')) acc += '/';
          acc += part;
          breadcrumbs.push(`pc-${normalizePath(acc)}`);
        }
      }
    }

    // 3. Sequential expansion
    const uniqueIds = Array.from(new Set(breadcrumbs));
    for (const id of uniqueIds) {
      set((s) => ({ expandedPaths: { ...s.expandedPaths, [id]: true } }));
      await ensureTreeChildren(id);
    }
  },
});
