import { useEffect, useState } from 'react';
import { FileSystemAPI } from '../services/api';
import { Monitor, Network } from 'lucide-react';

/** key = absPath + '@' + size でキャッシュ（main側と同等） */
const iconCache = new Map<string, string>();

function getCacheKey(absPath: string, size: 16 | 20): string {
  return `${absPath.toLowerCase().replace(/\//g, '\\')}@${size}`;
}

interface FileIconProps {
  /** 実在する絶対パス（例: C:\Users\...\Downloads） */
  path: string;
  isDirectory?: boolean;
  className?: string;
  size?: number;
}

export function FileIcon({
  path,
  isDirectory = false,
  className = '',
  size = 16,
}: FileIconProps) {
  const iconSizeNum: 16 | 20 = size >= 20 ? 20 : 16;
  const cacheKey = path ? getCacheKey(path, iconSizeNum) : '';
  const [dataUrl, setDataUrl] = useState<string | null>(() =>
    cacheKey ? (iconCache.get(cacheKey) ?? null) : null
  );

  useEffect(() => {
    if (!path || !FileSystemAPI.getFileIcon) return;
    const key = getCacheKey(path, iconSizeNum);
    const cached = iconCache.get(key);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false;
    FileSystemAPI
      .getFileIcon(path, iconSizeNum)
      .then((url) => {
        if (!cancelled && url) {
          iconCache.set(key, url);
          setDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path, iconSizeNum]);

  const iconSize = size === 20 ? 20 : 16;

  if (path === 'pc') {
    return <Monitor size={iconSize} className={className} style={{ flexShrink: 0 }} />;
  }
  if (path === 'network') {
    return <Network size={iconSize} className={className} style={{ flexShrink: 0 }} />;
  }

  if (!path) {
    return (
      <span
        className={className}
        style={{
          width: iconSize,
          height: iconSize,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: iconSize - 2,
        }}
      >
        {isDirectory ? '📁' : '📄'}
      </span>
    );
  }

  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt=""
        className={className}
        width={iconSize}
        height={iconSize}
        style={{ flexShrink: 0, objectFit: 'contain' }}
      />
    );
  }

  return (
    <span
      className={className}
      style={{
        width: iconSize,
        height: iconSize,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: iconSize - 2,
      }}
    >
      {isDirectory ? '📁' : '📄'}
    </span>
  );
}
