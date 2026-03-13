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

  const { viewMode, binding, autoSpreadCover, autoThreshold } = options;
  let isDouble = false;
  const hasNext = idx + 1 < sorted.length;

  if (viewMode === 'spread') {
    isDouble = hasNext;
  } else if (viewMode === 'auto') {
    if (idx === 0 && autoSpreadCover) {
      isDouble = false;
    } else {
      const curDims = imageDimensions[sorted[idx].path];
      const isCurLandscape = curDims && (curDims.w > curDims.h * (autoThreshold || 1.35));
      
      if (isCurLandscape) {
        isDouble = false;
      } else if (hasNext) {
        const nextDims = imageDimensions[sorted[idx + 1].path];
        const isNextLandscape = nextDims && (nextDims.w > nextDims.h * (autoThreshold || 1.35));
        isDouble = !isNextLandscape;
      }
    }
  }

  const res = [sorted[idx]];
  if (isDouble && hasNext) {
    const nextEntry = sorted[idx + 1];
    if (isVideoPath(nextEntry.path) || isAudioPath(nextEntry.path)) {
      isDouble = false;
    } else {
      res.push(nextEntry);
    }
  }

  if (binding === 'rtl' && res.length > 1) {
    return [res[1], res[0]];
  }
  return res;
}
