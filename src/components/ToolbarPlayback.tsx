import { Repeat } from 'lucide-react';
import { useViewerStore } from '../stores/viewerStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';
import { useSettingsStore } from '../stores/settingsStore';
import styles from './ViewerToolbar.module.css';
import { useTranslation } from '../i18n';

export function ToolbarPlayback() {
    const { t } = useTranslation();
    const { mediaType } = useViewerStore();
    const {
        loopEnabled,
        toggleLoop,
        playbackRate,
        setPlaybackRate,
    } = useMediaPlayerStore();
    const { autoPlay, setAutoPlay } = useSettingsStore();

    const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

    if (mediaType !== 'video' && mediaType !== 'audio') return null;

    return (
        <>
            <div className={styles.sep} />
            <button
                onClick={toggleLoop}
                title={t('toolbar.loop')}
                className={`${styles.btn} ${loopEnabled ? styles.btnActive : ''}`}
            >
                <Repeat size={18} />
            </button>
            <button
                onClick={() => setAutoPlay(!autoPlay)}
                title={`自動再生: ${autoPlay ? 'ON' : 'OFF'}`}
                className={`${styles.btn} ${autoPlay ? styles.btnActive : ''}`}
                style={{ fontWeight: 'bold', fontSize: '10px' }}
            >
                AUTO
            </button>
            <div className={styles.speedSelector}>
                <select
                    value={SPEED_OPTIONS.includes(playbackRate) ? String(playbackRate) : 'custom'}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (v !== 'custom') setPlaybackRate(parseFloat(v));
                    }}
                    className={styles.select}
                    title={t('toolbar.speed')}
                >
                    {SPEED_OPTIONS.map((s) => (
                        <option key={s} value={String(s)}>
                            {s}×
                        </option>
                    ))}
                    {!SPEED_OPTIONS.includes(playbackRate) && (
                        <option value="custom">{playbackRate.toFixed(2)}×</option>
                    )}
                </select>
            </div>
        </>
    );
}
