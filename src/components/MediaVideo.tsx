import { useRef, useEffect } from 'react';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';

interface Props {
    src: string;
    autoPlay: boolean;
    loop: boolean;
    onEnded: () => void;
}

export function MediaVideo({ src, autoPlay, loop, onEnded }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { playbackRate, preservesPitch } = useMediaPlayerStore();

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        el.loop = loop;
        el.playbackRate = playbackRate;
        if ('preservesPitch' in el) (el as any).preservesPitch = preservesPitch;
        if ('webkitPreservesPitch' in el) (el as any).webkitPreservesPitch = preservesPitch;
    }, [loop, playbackRate, preservesPitch, src]);

    return (
        <div className="media-video-wrap" style={{ width: '100%', height: '100%' }}>
            <video
                ref={videoRef}
                src={src}
                controls
                autoPlay={autoPlay}
                preload="metadata"
                onEnded={onEnded}
                className="media-video"
                style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            />
        </div>
    );
}
