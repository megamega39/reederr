import { DirectoryEntry } from '../types';
import { ViewMode, Binding } from './settingsStore';
import { isVideoPath, isAudioPath } from './viewerStore.utils';

export interface LayoutOptions {
  viewMode: ViewMode;
  binding: Binding;
  autoSpreadCover: boolean;
  autoThreshold: number;
}

export function getVisibleEntries(
  sorted: DirectoryEntry[],
  selectedPath: string | null,
  imageDimensions: Record<string, { w: number; h: number }>,
  options: LayoutOptions
): DirectoryEntry[] {
  const normalizePath = (p: string) => p.replace(/\\/g, '/');
  const idx = sorted.findIndex((e) => normalizePath(e.path) === normalizePath(selectedPath ?? ''));
  if (idx < 0) return [];

  const curEntry = sorted[idx];
  // Videos/Audio should never be subject to spread mode
  if (isVideoPath(curEntry.path) || isAudioPath(curEntry.path)) {
    return [curEntry];
  }

  const { viewMode, binding, autoSpreadCover } = options;
  const hasNext = idx + 1 < sorted.length;
  
  const curDims = imageDimensions[sorted[idx].path];
  // If we don't know dimensions, assume NOT landscape (to avoid single-page flickering for portraits)
  const isCurLandscape = curDims && (curDims.w > curDims.h); 
  
  let isDouble = false;

  if (viewMode === 'spread') {
    if (idx === 0 && autoSpreadCover) {
      isDouble = false;
    } else if (hasNext) {
      isDouble = true;
    }
  } else if (viewMode === 'auto') {
    if (idx === 0 && autoSpreadCover) {
      isDouble = false;
    } else if (isCurLandscape) {
      // Auto mode: Landscape images always take full width
      isDouble = false;
    } else if (hasNext) {
      const nextEntry = sorted[idx + 1];
      if (isVideoPath(nextEntry.path) || isAudioPath(nextEntry.path)) {
        isDouble = false;
      } else {
        const nextDims = imageDimensions[nextEntry.path];
        const isNextLandscape = nextDims && (nextDims.w > nextDims.h);
        isDouble = !isNextLandscape;
      }
    }
  }

  const res = [sorted[idx]];
  if (isDouble && hasNext) {
    res.push(sorted[idx + 1]);
  }

  if (binding === 'rtl' && res.length > 1) {
    return [res[1], res[0]];
  }
  return res;
}
