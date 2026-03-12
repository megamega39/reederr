import {
    Maximize,
    StretchHorizontal,
    StretchVertical,
    Maximize2,
    BookOpen,
    Book,
    Monitor,
    Wand2,
    ArrowLeft,
    ArrowRight,
} from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';
import styles from './ViewerToolbar.module.css';
import { useTranslation } from '../i18n';
import { MediaAPI } from '../services/api';

export function ToolbarLayout() {
    const { t } = useTranslation();
    const {
        scaleMode,
        setScaleMode,
        viewMode,
        setViewMode,
        binding,
        setBinding,
        isPreviewFullscreen,
    } = useLayoutStore();

    const handleToggleFullscreen = () => {
        MediaAPI.setPreviewFullscreen(!isPreviewFullscreen);
    };

    return (
        <div className={`${styles.btnGroup} ${styles.right}`}>
            {/* スケーリング */}
            <button
                onClick={() => setScaleMode('fit-window')}
                title={t('statusBar.scaleFitWindow')}
                className={`${styles.btn} ${scaleMode === 'fit-window' ? styles.btnActive : ''}`}
            >
                <Maximize size={18} />
            </button>
            <button
                onClick={() => setScaleMode('fit-width')}
                title={t('statusBar.scaleFitWidth')}
                className={`${styles.btn} ${scaleMode === 'fit-width' ? styles.btnActive : ''}`}
            >
                <StretchHorizontal size={18} />
            </button>
            <button
                onClick={() => setScaleMode('fit-height')}
                title={t('statusBar.scaleFitHeight')}
                className={`${styles.btn} ${scaleMode === 'fit-height' ? styles.btnActive : ''}`}
            >
                <StretchVertical size={18} />
            </button>
            <button
                onClick={() => setScaleMode('original')}
                title={t('statusBar.scaleOriginal')}
                className={`${styles.btn} ${scaleMode === 'original' ? styles.btnActive : ''}`}
            >
                <Maximize2 size={18} />
            </button>

            <div className={styles.sep} />

            {/* 綴じ方向 */}
            <button
                onClick={() => setBinding(binding === 'rtl' ? 'ltr' : 'rtl')}
                title={binding === 'rtl' ? t('toolbar.bindingLTR') : t('toolbar.bindingRTL')}
                className={styles.btn}
            >
                {binding === 'rtl' ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </button>

            <div className={styles.sep} />

            {/* モード切り替え */}
            <button
                onClick={() => setViewMode('auto')}
                title={t('toolbar.scaleAuto')}
                className={`${styles.btn} ${viewMode === 'auto' ? styles.btnActive : ''}`}
            >
                <Wand2 size={18} />
            </button>

            <button
                onClick={() => setViewMode('single')}
                title={t('toolbar.scaleSingle')}
                className={`${styles.btn} ${viewMode === 'single' ? styles.btnActive : ''}`}
            >
                <Book size={18} />
            </button>
            <button
                onClick={() => setViewMode('spread')}
                title={t('toolbar.scaleSpread')}
                className={`${styles.btn} ${viewMode === 'spread' ? styles.btnActive : ''}`}
            >
                <BookOpen size={18} />
            </button>

            <div className={styles.sep} />

            <button
                onClick={handleToggleFullscreen}
                title={t('toolbar.fullscreen')}
                className={`${styles.btn} ${isPreviewFullscreen ? styles.btnActive : ''}`}
            >
                <Monitor size={18} />
            </button>
        </div>
    );
}
