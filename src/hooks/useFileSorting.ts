import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { useLayoutStore } from '../stores/layoutStore';
import type { DirectoryEntry } from '../types';

export function useFileSorting(entries: DirectoryEntry[]) {
  const sortBy = useLayoutStore((s) => s.fileListSortBy);
  const sortOrder = useLayoutStore((s) => s.fileListSortOrder);
  const { fileListFilter } = useAppStore();

  const [sortedEntries, setSortedEntries] = useState<DirectoryEntry[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize worker
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/fileWorker.ts', import.meta.url), {
        type: 'module'
      });
      workerRef.current.onmessage = (e: MessageEvent<DirectoryEntry[]>) => {
        setSortedEntries(e.data);
      };
    }

    // Optimization: Skip worker if entries is empty
    if (!entries || entries.length === 0) {
      setSortedEntries([]);
      return;
    }

    // Capture the current entries to avoid stale closure issues in the worker
    const currentEntries = entries;

    // Send task to worker
    workerRef.current.postMessage({
      entries: currentEntries,
      sortBy,
      sortOrder,
      filter: fileListFilter
    });
  }, [entries, sortBy, sortOrder, fileListFilter]);

  // Clean up worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return sortedEntries;
}
