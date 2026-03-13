/**
 * File processing worker for sorting and filtering large directory entries.
 * Runs in a separate thread to keep the UI responsive during search/sort operations.
 */

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isArchive: boolean;
  size?: number;
  mtime?: number;
}

interface WorkerInput {
  entries: DirectoryEntry[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filter: string;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { entries, sortBy, sortOrder, filter } = e.data;

  // 1. Basic cleaning & Junk removal
  const filtered = entries.filter((e) => {
    if (!e || typeof e.name !== 'string') return false;
    const name = e.name;
    if (name === '__MACOSX' || name === '.DS_Store' || name.startsWith('._')) return false;
    if (name.startsWith('~') || name.startsWith('7z') || name.startsWith('._')) return false;
    
    // 2. Search filtering
    if (filter) {
      const lowerFilter = filter.toLowerCase().normalize('NFKC');
      if (!name.toLowerCase().normalize('NFKC').includes(lowerFilter)) {
        return false;
      }
    }
    return true;
  });

  // 3. Sorting
  const mul = sortOrder === 'asc' ? 1 : -1;
  const sorted = filtered.sort((a, b) => {
    // Directories always first
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else if (sortBy === 'size') {
      cmp = (a.size ?? 0) - (b.size ?? 0);
    } else if (sortBy === 'mtime') {
      cmp = (a.mtime ?? 0) - (b.mtime ?? 0);
    } else {
      // For 'type', we'll just do name compare here for now 
      // as getFileType requires i18n which is tricky in worker
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }
    return cmp * mul;
  });

  self.postMessage(sorted);
};
