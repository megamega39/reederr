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
    Wand2
} from 'lucide-react';
import { memo } from 'react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';

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
        <div className="viewer-toolbar">
            <div className="viewer-toolbar-group left">
                <button onClick={goToFirst} title="最初のページへ" className="toolbar-btn">
                    <ChevronsLeft size={18} />
                </button>
                <button onClick={goPrev} title="前のページへ" className="toolbar-btn">
                    <ChevronLeft size={18} />
                </button>

                <div className="viewer-toolbar-page-count">
                    {pageText}
                </div>

                <button onClick={goNext} title="次のページへ" className="toolbar-btn">
                    <ChevronRight size={18} />
                </button>
                <button onClick={goToLast} title="最後のページへ" className="toolbar-btn">
                    <ChevronsRight size={18} />
                </button>

                <span className="toolbar-sep" />

                <button
                    onClick={() => setSlideshowActive(!slideshowActive)}
                    title="スライドショー"
                    className={`toolbar-btn ${slideshowActive ? 'active' : ''}`}
                >
                    <Clock size={18} />
                </button>

                {(mediaType === 'video' || mediaType === 'audio') && (
                    <>
                        <span className="toolbar-sep" />
                        <button
                            onClick={toggleLoop}
                            title="ループ再生"
                            className={`toolbar-btn ${loopEnabled ? 'active' : ''}`}
                        >
                            <Repeat size={18} />
                        </button>
                        <div className="toolbar-speed-selector">
                            <select
                                value={SPEED_OPTIONS.includes(playbackRate) ? String(playbackRate) : 'custom'}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v !== 'custom') setPlaybackRate(parseFloat(v));
                                }}
                                className="toolbar-select"
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

            <div className="viewer-toolbar-group right">
                {/* スケーリング */}
                <button
                    onClick={() => setScaleMode('fit-window')}
                    title="ウィンドウに合わせる"
                    className={`toolbar-btn ${scaleMode === 'fit-window' ? 'active' : ''}`}
                >
                    <Maximize size={18} />
                </button>
                <button
                    onClick={() => setScaleMode('fit-width')}
                    title="幅に合わせる"
                    className={`toolbar-btn ${scaleMode === 'fit-width' ? 'active' : ''}`}
                >
                    <StretchHorizontal size={18} />
                </button>
                <button
                    onClick={() => setScaleMode('fit-height')}
                    title="高さに合わせる"
                    className={`toolbar-btn ${scaleMode === 'fit-height' ? 'active' : ''}`}
                >
                    <StretchVertical size={18} />
                </button>
                <button
                    onClick={() => setScaleMode('original')}
                    title="原寸大"
                    className={`toolbar-btn ${scaleMode === 'original' ? 'active' : ''}`}
                >
                    <Maximize2 size={18} />
                </button>

                <span className="toolbar-sep" />

                {/* レイアウト */}
                <button
                    onClick={() => setViewMode(viewMode === 'single' ? 'spread' : 'single')}
                    title={viewMode === 'single' ? '見開き表示' : '単独表示'}
                    className="toolbar-btn"
                >
                    {viewMode === 'single' ? <BookOpen size={18} /> : <Book size={18} />}
                </button>
                <button
                    onClick={() => setBinding(binding === 'rtl' ? 'ltr' : 'rtl')}
                    title={binding === 'rtl' ? '左開き' : '右開き'}
                    className="toolbar-btn"
                >
                    <ArrowRightLeft size={18} />
                </button>

                <span className="toolbar-sep" />

                {/* 自動見開き (Auto) */}
                <button
                    onClick={() => setViewMode('auto')}
                    title="自動見開き (Auto Spread)"
                    className={`toolbar-btn ${viewMode === 'auto' ? 'active' : ''}`}
                >
                    <Wand2 size={18} />
                </button>

                {viewMode === 'auto' && (
                    <button
                        onClick={() => setAutoSpreadCover(!autoSpreadCover)}
                        title={`表紙（1ページ目）の単独表示: ${autoSpreadCover ? 'ON' : 'OFF'}`}
                        className={`toolbar-btn ${autoSpreadCover ? 'active' : ''}`}
                    >
                        <Book size={18} />
                    </button>
                )}

                {/* 1枚表示 */}
                <button
                    onClick={() => setViewMode('single')}
                    title="単ページ表示"
                    className={`toolbar-btn ${viewMode === 'single' ? 'active' : ''}`}
                >
                    <Book size={18} />
                </button>
                {/* 見開き表示 */}
                <button
                    onClick={() => setViewMode('spread')}
                    title="見開き表示"
                    className={`toolbar-btn ${viewMode === 'spread' ? 'active' : ''}`}
                >
                    <BookOpen size={18} />
                </button>

                <span className="toolbar-sep" />

                {/* サムネイル */}
                <button
                    onClick={() => setCatalogMode(!catalogMode)}
                    title="カタログモード"
                    className={`toolbar-btn ${catalogMode ? 'active' : ''}`}
                >
                    <Grid size={18} />
                </button>

                {/* フルスクリーン */}
                <button
                    onClick={togglePreviewFullscreen}
                    title="全画面"
                    className="toolbar-btn"
                >
                    <Monitor size={18} />
                </button>
            </div>
        </div>
    );
});
