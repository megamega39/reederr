import { useEffect, memo } from 'react';
import { useAppStore } from '../stores/appStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useMediaStore } from '../stores/mediaStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';
import { ImageView } from './ImageView';
import { MediaAPI } from '../services/api';
import { MediaVideo } from './MediaVideo';
import { MediaAudio } from './MediaAudio';
import styles from './MediaView.module.css';
import { useTranslation } from '../i18n';
import { useShallow } from 'zustand/react/shallow';

export const MediaView = memo(() => {
  const { t } = useTranslation();
  
  const { 
    mediaBlobUrl, mediaBlobUrls, mediaType, selectedPath, selectedPaths,
    selectedEntry, goPrevPage, goNextPage, goNext, nextEntry,
    setImageDimensions, loadMedia
  } = useMediaStore(
    useShallow((s) => ({
      mediaBlobUrl: s.mediaBlobUrl,
      mediaBlobUrls: s.mediaBlobUrls,
      mediaType: s.mediaType,
      selectedPath: s.selectedPath,
      selectedPaths: s.selectedPaths,
      selectedEntry: s.selectedEntry,
      goPrevPage: s.goPrevPage,
      goNextPage: s.goNextPage,
      goNext: s.goNext,
      nextEntry: s.nextEntry,
      setImageDimensions: s.setImageDimensions,
      loadMedia: s.loadMedia,
    }))
  );

  const { error, isLoading } = useAppStore(
    useShallow((s) => ({
      error: s.error,
      isLoading: s.isLoading,
    }))
  );

  const { goBack } = useNavigationStore(
    useShallow((s) => ({
      goBack: s.goBack,
    }))
  );

  // use goBack directly in onClick

  const { viewMode, binding, autoThreshold, autoPlay } = useSettingsStore(
    useShallow((s) => ({
      viewMode: s.viewMode,
      binding: s.binding,
      autoThreshold: s.autoThreshold,
      autoPlay: s.autoPlay,
    }))
  );

  const { isPreviewFullscreen } = useLayoutStore(
    useShallow((s) => ({
      isPreviewFullscreen: s.isPreviewFullscreen,
    }))
  );

  const {
    loopEnabled, toggleLoop, changePlaybackRate, resetPlaybackRate, loadFromStorage
  } = useMediaPlayerStore(
    useShallow((s) => ({
      loopEnabled: s.loopEnabled,
      toggleLoop: s.toggleLoop,
      changePlaybackRate: s.changePlaybackRate,
      resetPlaybackRate: s.resetPlaybackRate,
      loadFromStorage: s.loadFromStorage,
    }))
  );

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    // We only trigger re-load here for layout-driven changes (like spread mode) 
    // that might require loading a second image.
    // Basic navigation is already handled by coordinated store updates in viewerStore.ts.
    if (mediaType === 'image' && selectedPath && (viewMode !== 'single')) {
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
          <button className={styles.backButton} onClick={() => goBack()}>{t('common.back')}</button>
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

  const rawSrcs = mediaBlobUrls.length > 0 ? mediaBlobUrls : mediaBlobUrl ? [mediaBlobUrl] : [];
  const imagePaths = selectedPaths.length > 0 ? selectedPaths : [selectedPath ?? ''];
  const imageSrcs = rawSrcs.slice(0, imagePaths.length);

  return (
    <div 
      className={`${styles.mediaView} ${!entry ? styles.empty : styles[`mediaView--${mediaType}`] || ''}`} 
      onDoubleClick={handleDoubleClick}
    >
      {!entry || !mediaType ? (
        <div className={styles.placeholder}>{t('media.audioPlaceholder')}</div>
      ) : mediaType === 'audio' ? (
        <MediaAudio
          key={mediaBlobUrl}
          src={mediaBlobUrl ?? ''}
          name={entry.name}
          autoPlay={autoPlay}
          loop={loopEnabled}
          onEnded={handleMediaEnded}
        />
      ) : mediaType === 'video' ? (
        <MediaVideo
          key={mediaBlobUrl}
          src={mediaBlobUrl ?? ''}
          autoPlay={autoPlay}
          loop={loopEnabled}
          onEnded={handleMediaEnded}
        />
      ) : (
        <div className="media-image-wrap" style={{ width: '100%', height: '100%' }}>
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
