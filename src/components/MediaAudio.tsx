import { useRef, useEffect } from 'react';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';
import styles from './MediaView.module.css';

interface Props {
    src: string;
    name: string;
    autoPlay: boolean;
    loop: boolean;
    onEnded: () => void;
}

export function MediaAudio({ src, name, autoPlay, loop, onEnded }: Props) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const { playbackRate, preservesPitch } = useMediaPlayerStore();

    useEffect(() => {
        const el = audioRef.current;
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
        <div className={styles.audioWrap}>
            <audio
                ref={audioRef}
                src={src}
                controls
                autoPlay={autoPlay}
                preload="metadata"
                onEnded={onEnded}
                className="media-audio"
                style={{ width: '100%', maxWidth: 480 }}
            />
            <span className="media-audio-filename">{name}</span>
        </div>
    );
}
