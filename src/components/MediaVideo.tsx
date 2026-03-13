import { useRef, useEffect, useState } from 'react';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';

interface Props {
    src: string;
    autoPlay: boolean;
    loop: boolean;
    onEnded: () => void;
}

export function MediaVideo({ src, autoPlay, loop, onEnded }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isReady, setIsReady] = useState(false);
    const { playbackRate, preservesPitch } = useMediaPlayerStore();

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        el.loop = loop;
        el.playbackRate = playbackRate;
        if ('preservesPitch' in el) (el as any).preservesPitch = preservesPitch;
        if ('webkitPreservesPitch' in el) (el as any).webkitPreservesPitch = preservesPitch;
    }, [loop, playbackRate, preservesPitch, src]);

    useEffect(() => {
        return () => {
            if (src && (src.startsWith('media://') || (src.includes('127.0.0.1') && src.includes('id=')))) {
                (window as any).reederr.releaseMediaUrl(src).catch(() => {});
            }
        };
    }, [src]);

    return (
        <div className="media-video-wrap" style={{ width: '100%', height: '100%' }}>
            <video
                ref={videoRef}
                src={src}
                controls
                autoPlay={autoPlay}
                preload="metadata"
                onLoadedData={() => setIsReady(true)}
                onEnded={onEnded}
                className="media-video"
                style={{ 
                    objectFit: 'contain', 
                    width: '100%', 
                    height: '100%',
                    opacity: isReady ? 1 : 0,
                    transition: 'opacity 0.2s'
                }}
            />
        </div>
    );
}
