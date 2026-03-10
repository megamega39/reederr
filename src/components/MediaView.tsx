import { useEffect, useRef, memo } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';
import { ImageView } from './ImageView';

function applyMediaProps(
  el: HTMLMediaElement | null,
  loop: boolean,
  rate: number,
  preservesPitch: boolean
) {
  if (!el) return;
  el.loop = loop;
  el.playbackRate = rate;
  if ('preservesPitch' in el) (el as HTMLMediaElement & { preservesPitch: boolean }).preservesPitch = preservesPitch;
  if ('webkitPreservesPitch' in el) (el as HTMLMediaElement & { webkitPreservesPitch: boolean }).webkitPreservesPitch = preservesPitch;
}

export const MediaView = memo(() => {
  const mediaBlobUrl = useViewerStore((s) => s.mediaBlobUrl);
  const mediaBlobUrls = useViewerStore((s) => s.mediaBlobUrls);
  const mediaType = useViewerStore((s) => s.mediaType);
  const selectedEntry = useViewerStore((s) => s.selectedEntry);
  const getVisibleEntries = useViewerStore((s) => s.getVisibleEntries);
  const goPrev = useViewerStore((s) => s.goPrev);
  const goNext = useViewerStore((s) => s.goNext);
  const nextEntry = useViewerStore((s) => s.nextEntry);
  const setImageDimensions = useViewerStore((s) => s.setImageDimensions);
  const loadMedia = useViewerStore((s) => s.loadMedia);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const viewMode = useLayoutStore((s) => s.viewMode);
  const binding = useLayoutStore((s) => s.binding);
  const autoThreshold = useLayoutStore((s) => s.autoThreshold);
  const selectedPath = useViewerStore((s) => s.selectedPath);
  const isPreviewFullscreen = useLayoutStore((s) => s.isPreviewFullscreen);

  const loopEnabled = useMediaPlayerStore((s) => s.loopEnabled);
  const playbackRate = useMediaPlayerStore((s) => s.playbackRate);
  const preservesPitch = useMediaPlayerStore((s) => s.preservesPitch);
  const toggleLoop = useMediaPlayerStore((s) => s.toggleLoop);
  const changePlaybackRate = useMediaPlayerStore((s) => s.changePlaybackRate);
  const resetPlaybackRate = useMediaPlayerStore((s) => s.resetPlaybackRate);
  const loadFromStorage = useMediaPlayerStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (mediaType === 'image' && selectedPath) {
      loadMedia(selectedPath);
    }
  }, [viewMode, binding, autoThreshold]);

  useEffect(() => {
    applyMediaProps(audioRef.current, loopEnabled, playbackRate, preservesPitch);
    applyMediaProps(videoRef.current, loopEnabled, playbackRate, preservesPitch);
  }, [loopEnabled, playbackRate, preservesPitch]);

  useEffect(() => {
    const el = mediaType === 'video' ? videoRef.current : mediaType === 'audio' ? audioRef.current : null;
    if (el) applyMediaProps(el, loopEnabled, playbackRate, preservesPitch);
  }, [mediaType, mediaBlobUrl]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        goPrev();
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
  }, [goPrev, goNext, toggleLoop, changePlaybackRate, resetPlaybackRate]);

  const entry = selectedEntry();

  if (!entry) {
    return (
      <div className="media-view empty">
        <div className="media-view-placeholder">画像・動画・音楽を選択してください</div>
      </div>
    );
  }

  const handleToggleFullscreen = () => {
    const next = !isPreviewFullscreen;
    window.reederr.setPreviewFullscreen(next);
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
    <div className={`media-view ${!entry ? 'empty' : `media-view--${mediaType}`}`} onDoubleClick={handleDoubleClick}>
      {!entry ? (
        <div className="media-view-placeholder">画像・動画・音楽を選択してください</div>
      ) : mediaType === 'audio' ? (
        <div className="media-audio-wrap" key={`audio-${entry.path}`}>
          <audio
            ref={audioRef}
            src={mediaBlobUrl ?? undefined}
            controls
            autoPlay
            preload="metadata"
            loop={loopEnabled}
            onEnded={handleMediaEnded}
            className="media-audio"
            style={{ width: '100%', maxWidth: 480 }}
          />
          <span className="media-audio-filename">{entry.name}</span>
        </div>
      ) : mediaType === 'video' ? (
        <div className="media-video-wrap" key={`video-${entry.path}`} style={{ width: '100%', height: '100%' }}>
          <video
            ref={videoRef}
            src={mediaBlobUrl ?? undefined}
            controls
            autoPlay
            preload="metadata"
            loop={loopEnabled}
            onEnded={handleMediaEnded}
            className="media-video"
            style={{ objectFit: 'contain', width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        <div className="media-image-wrap" key={`image-${entry.path}`} style={{ width: '100%', height: '100%' }}>
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
