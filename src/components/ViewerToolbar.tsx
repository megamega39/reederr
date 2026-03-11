import {
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
    Clock,
    Maximize,
    Maximize2,
    StretchHorizontal,
    StretchVertical,
    BookOpen,
    Book,
    Grid,
    Monitor,
    ArrowRightLeft,
    Repeat,
    Wand2,
} from 'lucide-react';
import { memo } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';
import styles from './ViewerToolbar.module.css';

export const ViewerToolbar = memo(() => {
    const {
        imageEntries,
        selectedPath,
        goToFirst,
        goPrev,
        goNext,
        goToLast,
        slideshowActive,
        setSlideshowActive,
    } = useViewerStore();

    const {
        scaleMode,
        setScaleMode,
        viewMode,
        setViewMode,
        binding,
        setBinding,
        catalogMode,
        setCatalogMode,
        autoSpreadCover,
        setAutoSpreadCover,
        togglePreviewFullscreen
    } = useLayoutStore();

    const {
        mediaType,
    } = useViewerStore();

    const {
        loopEnabled,
        toggleLoop,
        playbackRate,
        setPlaybackRate,
    } = useMediaPlayerStore();

    const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

    const currentIndex = imageEntries.findIndex(e => e.path === selectedPath);
    const total = imageEntries.length;
    const pageText = total > 0 ? `${currentIndex + 1} / ${total}` : '0 / 0';

    return (
        <div className={styles.toolbar}>
            <div className={`${styles.btnGroup} ${styles.left}`}>
                <button onClick={goToFirst} title="最初のページへ" className={styles.btn}>
                    <ChevronsLeft size={18} />
                </button>
                <button onClick={goPrev} title="前のページへ" className={styles.btn}>
                    <ChevronLeft size={18} />
                </button>

                <div className={styles.pos}>
                    {pageText}
                </div>

                <button onClick={goNext} title="次のページへ" className={styles.btn}>
                    <ChevronRight size={18} />
                </button>
                <button onClick={goToLast} title="最後のページへ" className={styles.btn}>
                    <ChevronsRight size={18} />
                </button>

                <div className={styles.sep} />

                <button
                    onClick={() => setSlideshowActive(!slideshowActive)}
                    title="スライドショー"
                    className={`${styles.btn} ${slideshowActive ? styles.btnActive : ''}`}
                >
                    <Clock size={18} />
                </button>

                {(mediaType === 'video' || mediaType === 'audio') && (
                    <>
                        <div className={styles.sep} />
                        <button
                            onClick={toggleLoop}
                            title="ループ再生"
                            className={`${styles.btn} ${loopEnabled ? styles.btnActive : ''}`}
                        >
                            <Repeat size={18} />
                        </button>
                        <div className={styles.speedSelector}>
                            <select
                                value={SPEED_OPTIONS.includes(playbackRate) ? String(playbackRate) : 'custom'}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v !== 'custom') setPlaybackRate(parseFloat(v));
                                }}
                                className={styles.select}
                                title="再生速度"
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
                )}
            </div>

            <div className={`${styles.btnGroup} ${styles.center}`}>
            </div>

            <div className={`${styles.btnGroup} ${styles.right}`}>
                {/* スケーリング */}
                <button
                    onClick={() => setScaleMode('fit-window')}
                    title="ウィンドウに合わせる"
                    className={`${styles.btn} ${scaleMode === 'fit-window' ? styles.btnActive : ''}`}
                >
                    <Maximize size={18} />
                </button>
                <button
                    onClick={() => setScaleMode('fit-width')}
                    title="幅に合わせる"
                    className={`${styles.btn} ${scaleMode === 'fit-width' ? styles.btnActive : ''}`}
                >
                    <StretchHorizontal size={18} />
                </button>
                <button
                    onClick={() => setScaleMode('fit-height')}
                    title="高さに合わせる"
                    className={`${styles.btn} ${scaleMode === 'fit-height' ? styles.btnActive : ''}`}
                >
                    <StretchVertical size={18} />
                </button>
                <button
                    onClick={() => setScaleMode('original')}
                    title="原寸大"
                    className={`${styles.btn} ${scaleMode === 'original' ? styles.btnActive : ''}`}
                >
                    <Maximize2 size={18} />
                </button>

                <div className={styles.sep} />

                {/* レイアウト */}
                <button
                    onClick={() => setViewMode(viewMode === 'single' ? 'spread' : 'single')}
                    title={viewMode === 'single' ? '見開き表示' : '単独表示'}
                    className={styles.btn}
                >
                    {viewMode === 'single' ? <BookOpen size={18} /> : <Book size={18} />}
                </button>
                <button
                    onClick={() => setBinding(binding === 'rtl' ? 'ltr' : 'rtl')}
                    title={binding === 'rtl' ? '左開き' : '右開き'}
                    className={styles.btn}
                >
                    <ArrowRightLeft size={18} />
                </button>

                <div className={styles.sep} />

                {/* 自動見開き (Auto) */}
                <button
                    onClick={() => setViewMode('auto')}
                    title="自動見開き (Auto Spread)"
                    className={`${styles.btn} ${viewMode === 'auto' ? styles.btnActive : ''}`}
                >
                    <Wand2 size={18} />
                </button>

                {viewMode === 'auto' && (
                    <button
                        onClick={() => setAutoSpreadCover(!autoSpreadCover)}
                        title={`表紙（1ページ目）の単独表示: ${autoSpreadCover ? 'ON' : 'OFF'}`}
                        className={`${styles.btn} ${autoSpreadCover ? styles.btnActive : ''}`}
                    >
                        <Book size={18} />
                    </button>
                )}

                {/* 1枚表示 */}
                <button
                    onClick={() => setViewMode('single')}
                    title="単ページ表示"
                    className={`${styles.btn} ${viewMode === 'single' ? styles.btnActive : ''}`}
                >
                    <Book size={18} />
                </button>
                {/* 見開き表示 */}
                <button
                    onClick={() => setViewMode('spread')}
                    title="見開き表示"
                    className={`${styles.btn} ${viewMode === 'spread' ? styles.btnActive : ''}`}
                >
                    <BookOpen size={18} />
                </button>

                <div className={styles.sep} />

                {/* サムネイル */}
                <button
                    onClick={() => setCatalogMode(!catalogMode)}
                    title="カタログモード"
                    className={`${styles.btn} ${catalogMode ? styles.btnActive : ''}`}
                >
                    <Grid size={18} />
                </button>

                {/* フルスクリーン */}
                <button
                    onClick={togglePreviewFullscreen}
                    title="全画面"
                    className={styles.btn}
                >
                    <Monitor size={18} />
                </button>
            </div>
        </div>
    );
});
