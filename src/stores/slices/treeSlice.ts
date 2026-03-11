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
    if (idOrPath.startsWith('pc-') || idOrPath.startsWith('special-') || idOrPath.startsWith('favorite-')) {
      rawPath = idOrPath.slice(idOrPath.indexOf('-') + 1);
    }

    const resolvedPath = isArchivePath(rawPath) && !rawPath.includes('!') ? rawPath + '!' : rawPath;

    if (get().treeChildren[resolvedPath]) return;

    try {
      let children: DirectoryEntry[];
      if (resolvedPath === 'pc') {
        const drives = await FileSystemAPI.getDrives();
        children = drives.map((d) => ({ ...d, isDirectory: true, isArchive: false }));
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
        setTreeRoots([...roots, pc]);

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
    
    // Normalize target path
    const targetPath = normalizePath(path);
    const targetPathLower = targetPath.toLowerCase();

    // 1. Find the best starting point (Favorite or Special Root)
    const candidates = [
      ...favorites.map(f => ({ name: f.name, path: f.path, type: 'favorite' })),
      ...treeRoots.filter(r => r.path !== 'pc').map(r => ({ name: r.name, path: r.path, type: 'special' }))
    ];

    let bestMatch: { name: string, path: string, type: string } | null = null;
    for (const cand of candidates) {
      const normCand = normalizePath(cand.path).toLowerCase();
      // Use robust matching that respects archive boundaries
      if (targetPathLower === normCand || targetPathLower.startsWith(normCand + '/') || targetPathLower.match(new RegExp('^' + normCand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[!]'))) {
        if (!bestMatch || cand.path.length > bestMatch.path.length) {
          bestMatch = cand;
        } else if (cand.path.length === bestMatch.path.length && cand.type === 'favorite') {
          bestMatch = cand;
        }
      }
    }

    // 2. Build the breadcrumb of IDs to expand
    const ancestors: string[] = [];
    if (bestMatch) {
      const prefix = bestMatch.type === 'favorite' ? 'favorite' : 'special';
      ancestors.push(`${prefix}-${normalizePath(bestMatch.path)}`);
      
      const subPath = targetPath.slice(bestMatch.path.length).replace(/^[/\\]+/, '');
      if (subPath) {
        let currentPathAcc = bestMatch.path;
        
        // Reconstruct segment by segment
        const parts = subPath.split(/[/\\]/);
        for (const part of parts) {
          if (!part) continue;
          
          if (part.includes('!')) {
            const segments = part.split('!');
            const archiveFileName = segments[0];
            
            // Add the archive file itself
            currentPathAcc += (currentPathAcc.endsWith('/') ? '' : '/') + archiveFileName;
            ancestors.push(`${prefix}-${normalizePath(currentPathAcc)}`);
            
            // Add segments inside the archive
            currentPathAcc += '!';
            for (let i = 1; i < segments.length; i++) {
              if (segments[i]) {
                currentPathAcc += (i > 1 ? '/' : '') + segments[i];
                ancestors.push(`${prefix}-${normalizePath(currentPathAcc)}`);
              }
            }
          } else {
            const sep = (currentPathAcc.endsWith('/') || currentPathAcc.endsWith('!')) ? '' : '/';
            currentPathAcc += sep + part;
            ancestors.push(`${prefix}-${normalizePath(currentPathAcc)}`);
          }
        }
      }
    } else {
      // Fallback to PC root
      ancestors.push('pc-pc');
      const normTarget = normalizePath(targetPath);
      let currentPathAcc = '';
      
      const parts = normTarget.split(/[/\\]/);
      for (const part of parts) {
        if (!part) continue;
        
        if (part.includes('!')) {
          const segments = part.split('!');
          const archiveFileName = segments[0];
          
          if (currentPathAcc && !currentPathAcc.endsWith('/') && !currentPathAcc.endsWith('!')) currentPathAcc += '/';
          currentPathAcc += archiveFileName;
          ancestors.push(`pc-${normalizePath(currentPathAcc)}`);
          
          currentPathAcc += '!';
          for (let i = 1; i < segments.length; i++) {
            if (segments[i]) {
              currentPathAcc += (i > 1 ? '/' : '') + segments[i];
              ancestors.push(`pc-${normalizePath(currentPathAcc)}`);
            }
          }
        } else {
          if (currentPathAcc && !currentPathAcc.endsWith('/') && !currentPathAcc.endsWith('!')) currentPathAcc += '/';
          currentPathAcc += part;
          ancestors.push(`pc-${normalizePath(currentPathAcc)}`);
        }
      }
    }

    // 3. Sequentially expand and ensure children
    const uniqueAncestors = Array.from(new Set(ancestors));
    for (const ancId of uniqueAncestors) {
      set((s) => ({ expandedPaths: { ...s.expandedPaths, [ancId]: true } }));
      await ensureTreeChildren(ancId);
    }
  },
});
