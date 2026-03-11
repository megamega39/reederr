import {
    Maximize,
    StretchHorizontal,
    StretchVertical,
    Maximize2,
    BookOpen,
    Book,
    Grid,
    Monitor,
    Wand2,
    ArrowRight,
    ArrowLeft,
} from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';
import styles from './ViewerToolbar.module.css';

export function ToolbarLayout() {
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

    return (
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

            {/* 基本の切り替えボタン */}
            <button
                onClick={() => setViewMode(viewMode === 'single' ? 'spread' : 'single')}
                title={viewMode === 'single' ? '見開き表示' : '単独表示'}
                className={styles.btn}
            >
                {viewMode === 'single' ? <BookOpen size={18} /> : <Book size={18} />}
            </button>
            <button
                onClick={() => setBinding(binding === 'rtl' ? 'ltr' : 'rtl')}
                title={binding === 'rtl' ? '左開きに変更' : '右開きに変更'}
                className={styles.btn}
            >
                {binding === 'rtl' ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </button>

            <div className={styles.sep} />

            {/* モード切り替え */}
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

            <button
                onClick={() => setViewMode('single')}
                title="単ページ表示"
                className={`${styles.btn} ${viewMode === 'single' ? styles.btnActive : ''}`}
            >
                <Book size={18} />
            </button>
            <button
                onClick={() => setViewMode('spread')}
                title="見開き表示"
                className={`${styles.btn} ${viewMode === 'spread' ? styles.btnActive : ''}`}
            >
                <BookOpen size={18} />
            </button>

            <div className={styles.sep} />

            <button
                onClick={() => setCatalogMode(!catalogMode)}
                title="カタログモード"
                className={`${styles.btn} ${catalogMode ? styles.btnActive : ''}`}
            >
                <Grid size={18} />
            </button>

            <button
                onClick={togglePreviewFullscreen}
                title="全画面"
                className={styles.btn}
            >
                <Monitor size={18} />
            </button>
        </div>
    );
}
