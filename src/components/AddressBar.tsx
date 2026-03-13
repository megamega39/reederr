import { useState, useEffect, useCallback, useRef } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { splitArchivePath } from '../../electron/vfs/utils';
import { ChevronRight, Edit2 } from 'lucide-react';
import styles from './AddressBar.module.css';
import { useTranslation } from '../i18n';

export function AddressBar() {
  const { t } = useTranslation();
  const currentPath = useViewerStore((s) => s.currentPath);
  const loadDirectory = useViewerStore((s) => s.loadDirectory);

  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value when externally navigating
  useEffect(() => {
    setInputValue(currentPath ? String(currentPath) : '');
    setIsEditing(false); // Reset to breadcrumbs on navigation
  }, [currentPath]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue !== currentPath) {
      loadDirectory(inputValue);
    }
    setIsEditing(false);
  }, [inputValue, currentPath, loadDirectory]);

  const startEditing = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Path Parsing for Breadcrumbs
  const getSegments = () => {
    if (!currentPath) return [];
    
    const split = splitArchivePath(currentPath);
    const archivePath = split ? split[0] : null;
    const innerPath = split ? split[1] : null;

    if (archivePath && innerPath != null) {
      // Archive Breadcrumbs: [C:, Users, ..., archive.zip] > [inner, path]
      const archiveParts = archivePath.split(/[/\\]/).filter(Boolean);
      const innerParts = innerPath.split(/[/\\]/).filter(Boolean);
      
      const segments: { name: string; path: string; isArchive: boolean }[] = [];
      let current = '';

      // Local part of archive path
      archiveParts.forEach((part, i) => {
        current = i === 0 ? part : current + '/' + part;
        segments.push({ name: part, path: current, isArchive: false });
      });

      // Inner part
      let currentArchive = archivePath + '!';
      innerParts.forEach((part, i) => {
        currentArchive = i === 0 ? currentArchive + part : currentArchive + '/' + part;
        segments.push({ name: part, path: currentArchive, isArchive: true });
      });

      return segments;
    } else {
      // Local Breadcrumbs
      const parts = currentPath.split(/[/\\]/).filter(Boolean);
      const segments: { name: string; path: string; isArchive: boolean }[] = [];
      let current = '';
      parts.forEach((part, i) => {
        current = i === 0 ? part : current + '/' + part;
        segments.push({ name: part, path: current, isArchive: false });
      });
      return segments;
    }
  };

  const segments = getSegments();

  return (
    <div className={styles.addressBar}>
      <div className={styles.label} onClick={startEditing}>
        <Edit2 size={12} style={{ marginRight: 4 }} />
        {t('addressBar.label')}
      </div>
      <div className={styles.content}>
        {isEditing ? (
          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={() => {
                if (inputValue === currentPath) setIsEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              spellCheck={false}
            />
            <button type="button" className={styles.goBtn} onClick={() => handleSubmit()} title={t('addressBar.go')}>
              →
            </button>
          </form>
        ) : (
          <div className={styles.breadcrumbs} onClick={(e) => {
            if (e.target === e.currentTarget) startEditing();
          }}>
            {segments.map((seg, i) => (
              <div key={seg.path} className={styles.breadcrumbItem}>
                <button
                  className={`${styles.breadcrumbBtn} ${seg.isArchive ? styles.isArchive : ''}`}
                  onClick={() => loadDirectory(seg.path)}
                >
                  {seg.name}
                </button>
                {i < segments.length - 1 && <ChevronRight size={14} className={styles.breadcrumbSep} />}
              </div>
            ))}
            <div className={styles.spacer} onClick={startEditing} />
          </div>
        )}
      </div>
    </div>
  );
}
