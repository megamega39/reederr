import { useEffect, memo } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';
import { ImageView } from './ImageView';
import { MediaAPI } from '../services/api';
import { MediaVideo } from './MediaVideo';
import { MediaAudio } from './MediaAudio';
import styles from './MediaView.module.css';
import { useTranslation } from '../i18n';

export const MediaView = memo(() => {
  const { t } = useTranslation();
  const mediaBlobUrl = useViewerStore((s) => s.mediaBlobUrl);
  const mediaBlobUrls = useViewerStore((s) => s.mediaBlobUrls);
  const mediaType = useViewerStore((s) => s.mediaType);
  const selectedEntry = useViewerStore((s) => s.selectedEntry);
  const getVisibleEntries = useViewerStore((s) => s.getVisibleEntries);
  const goPrevPage = useViewerStore((s) => s.goPrevPage);
  const goNextPage = useViewerStore((s) => s.goNextPage);
  const goNext = useViewerStore((s) => s.goNext);
  const nextEntry = useViewerStore((s) => s.nextEntry);
  const setImageDimensions = useViewerStore((s) => s.setImageDimensions);
  const loadMedia = useViewerStore((s) => s.loadMedia);
  const viewMode = useLayoutStore((s) => s.viewMode);
  const binding = useLayoutStore((s) => s.binding);
  const autoThreshold = useLayoutStore((s) => s.autoThreshold);
  const selectedPath = useViewerStore((s) => s.selectedPath);
  const isPreviewFullscreen = useLayoutStore((s) => s.isPreviewFullscreen);

  const loopEnabled = useMediaPlayerStore((s) => s.loopEnabled);
  const changePlaybackRate = useMediaPlayerStore((s) => s.changePlaybackRate);
  const resetPlaybackRate = useMediaPlayerStore((s) => s.resetPlaybackRate);
  const toggleLoop = useMediaPlayerStore((s) => s.toggleLoop);
  const loadFromStorage = useMediaPlayerStore((s) => s.loadFromStorage);
  const autoPlay = useMediaPlayerStore((s) => s.autoPlay);

  const error = useViewerStore((s) => s.error);
  const isLoading = useViewerStore((s) => s.isLoading);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (mediaType === 'image' && selectedPath) {
      loadMedia(selectedPath);
    }
  }, [viewMode, binding, autoThreshold]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrevPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNextPage();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        goNextPage();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        goPrevPage();
      } else if (e.key === 'l' || e.key === 'L') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleLoop();
        }
      } else if (e.key === ']') {
        e.preventDefault();
        changePlaybackRate(0.1);
      } else if (e.key === '[') {
        e.preventDefault();
        changePlaybackRate(-0.1);
      } else if (e.key === '\\' || e.key === '¥') {
        e.preventDefault();
        resetPlaybackRate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrevPage, goNextPage, toggleLoop, changePlaybackRate, resetPlaybackRate]);

  const entry = selectedEntry();

  if (!entry) {
    return (
      <div className={`${styles.mediaView} ${styles.empty}`}>
        <div className={styles.placeholder}>{t('media.audioPlaceholder')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.mediaView} ${styles.error}`}>
        <div className={styles.errorIcon}>⚠️</div>
        <div className={styles.errorMessage}>{error}</div>
        <div className={styles.errorActions}>
          <button className={styles.retryButton} onClick={() => selectedPath && loadMedia(selectedPath)}>{t('common.retry')}</button>
          <button className={styles.backButton} onClick={() => useViewerStore.getState().goBack()}>{t('common.back')}</button>
        </div>
      </div>
    );
  }

  if (isLoading && mediaType !== 'image') {
    return (
      <div className={`${styles.mediaView} ${styles.loading}`}>
        <div className={styles.spinner} />
        <div className={styles.loadingText}>{t('media.videoPreparing')}</div>
      </div>
    );
  }

  const handleToggleFullscreen = () => {
    const next = !isPreviewFullscreen;
    MediaAPI.setPreviewFullscreen(next);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    handleToggleFullscreen();
  };

  const handleMediaEnded = () => {
    if (!loopEnabled && nextEntry()) goNext();
  };

  const visibleEntries = getVisibleEntries();
  const rawSrcs = mediaBlobUrls.length > 0 ? mediaBlobUrls : mediaBlobUrl ? [mediaBlobUrl] : [];
  const imageSrcs = rawSrcs.slice(0, visibleEntries.length);
  const imagePaths = visibleEntries.map((e) => e.path);

  return (
    <div key={entry?.path ?? 'empty'} className={`${styles.mediaView} ${!entry ? styles.empty : styles[`mediaView--${mediaType}`] || ''}`} onDoubleClick={handleDoubleClick}>
      {!entry ? (
        <div className={styles.placeholder}>{t('media.audioPlaceholder')}</div>
      ) : mediaType === 'audio' ? (
        <MediaAudio
          src={mediaBlobUrl ?? ''}
          name={entry.name}
          autoPlay={autoPlay}
          loop={loopEnabled}
          onEnded={handleMediaEnded}
        />
      ) : mediaType === 'video' ? (
        <MediaVideo
          src={mediaBlobUrl ?? ''}
          autoPlay={autoPlay}
          loop={loopEnabled}
          onEnded={handleMediaEnded}
        />
      ) : (
        <div className="media-image-wrap" key={`image-wrap-${entry.path}`} style={{ width: '100%', height: '100%' }}>
          <ImageView
            srcs={imageSrcs}
            alt={entry.name}
            paths={imagePaths}
            onDimensions={(path, w, h) => setImageDimensions(path, { w, h })}
          />
        </div>
      )}
    </div>
  );
});
