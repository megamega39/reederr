import { useMemo } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';
import type { DirectoryEntry } from '../types';
import { getFileType } from '../utils/fileUtils';

export function useFileSorting(entries: DirectoryEntry[]) {
  const sortBy = useLayoutStore((s) => s.fileListSortBy);
  const sortOrder = useLayoutStore((s) => s.fileListSortOrder);
  const fileListFilter = useViewerStore((s) => s.fileListFilter);

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

  return sortedEntries;
}
