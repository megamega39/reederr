import { useEffect, memo, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useMediaStore } from '../stores/mediaStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';
import { ImageView } from './ImageView';
import { MediaVideo } from './MediaVideo';
import { MediaAudio } from './MediaAudio';
import styles from './MediaView.module.css';
import { useTranslation } from '../i18n';
import { useShallow } from 'zustand/react/shallow';
import { useMediaCacheStore } from '../stores/mediaCacheStore';
import { useMediaViewNavigation } from '../hooks/useMediaViewNavigation';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

export const MediaView = memo(() => {
  const { t } = useTranslation();
  
  const { 
    mediaBlobUrl, mediaBlobUrls, mediaType, selectedPath, selectedPaths,
    selectedEntry, goPrevPage, goNextPage, goNext, nextEntry, prevEntry,
    loadMedia
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
      prevEntry: s.prevEntry,
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

  const { viewMode, binding, autoThreshold, autoPlay, scaleMode, autoSpreadCover } = useSettingsStore(
    useShallow((s) => ({
      viewMode: s.viewMode,
      binding: s.binding,
      autoThreshold: s.autoThreshold,
      autoPlay: s.autoPlay,
      scaleMode: s.scaleMode,
      autoSpreadCover: s.autoSpreadCover,
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
  
  const setImageDimensions = useMediaCacheStore((s) => s.setImageDimensions);

  const containerRef = useRef<HTMLDivElement>(null);

  const { gestureDirection, gestureHandlers, handleToggleFullscreen } = useMediaViewNavigation({
    goPrevPage, goNextPage, goNext, goBack, nextEntry, prevEntry,
    toggleLoop, changePlaybackRate, resetPlaybackRate,
    isPreviewFullscreen, error, isLoading, mediaType, containerRef
  });

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const currentDims = useMediaCacheStore(s => selectedPath ? s.imageDimensions[selectedPath] : null);
  const nextPath = nextEntry()?.path;
  const nextDims = useMediaCacheStore(s => nextPath ? s.imageDimensions[nextPath] : null);

  useEffect(() => {
    // Re-sync media state when selection or view settings change.
    // This ensures toolbar buttons (e.g. Spread/Single) update the UI immediately.
    if (mediaType === 'image' && selectedPath) {
      loadMedia(selectedPath);
    }
  }, [selectedPath, viewMode, binding, autoThreshold, scaleMode, autoSpreadCover, currentDims?.w, nextDims?.w, loadMedia, mediaType]);

  const entry = selectedEntry();
  const rawSrcs = mediaBlobUrls.length > 0 ? mediaBlobUrls : mediaBlobUrl ? [mediaBlobUrl] : [];
  const imagePaths = selectedPaths.length > 0 ? selectedPaths : [selectedPath ?? ''];
  const imageSrcs = rawSrcs.slice(0, imagePaths.length);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    handleToggleFullscreen();
  };

  const handleMediaEnded = () => {
    if (!loopEnabled && nextEntry()) goNext();
  };

  if (!entry) {
    return <div className={`${styles.mediaView} ${styles.empty}`} />;
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

  if (isLoading && mediaType !== 'image' && autoPlay) {
    return (
      <div className={`${styles.mediaView} ${styles.loading}`}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div 
      className={`${styles.mediaView} ${!entry ? styles.empty : styles[`mediaView--${mediaType}`] || ''}`} 
      onDoubleClick={handleDoubleClick}
      ref={containerRef}
      {...gestureHandlers}
    >
      {gestureDirection && (
        <div className={styles.gestureOverlay}>
          {gestureDirection === 'left' && <ChevronLeft size={64} />}
          {gestureDirection === 'right' && <ChevronRight size={64} />}
          {gestureDirection === 'up' && <ChevronUp size={64} />}
          {gestureDirection === 'down' && <ChevronDown size={64} />}
        </div>
      )}
      {!entry || !mediaType ? (
        <div className={styles.placeholder} />
      ) : mediaType === 'audio' ? (
        <MediaAudio
          key={mediaBlobUrl}
          src={mediaBlobUrl ?? ''}
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
