import {
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
    Clock,
} from 'lucide-react';
import { useViewerStore } from '../stores/viewerStore';
import styles from './ViewerToolbar.module.css';
import { useTranslation } from '../i18n';

export function ToolbarNavigation() {
    const { t } = useTranslation();
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

    const currentIndex = imageEntries.findIndex(e => e.path === selectedPath);
    const total = imageEntries.length;
    const pageText = total > 0 ? `${currentIndex + 1} / ${total}` : '0 / 0';

    return (
        <div className={`${styles.btnGroup} ${styles.left}`}>
            <button onClick={goToFirst} title={t('toolbar.firstPage')} className={styles.btn}>
                <ChevronsLeft size={18} />
            </button>
            <button onClick={goPrev} title={t('toolbar.prevPage')} className={styles.btn}>
                <ChevronLeft size={18} />
            </button>

            <div className={styles.pos}>
                {pageText}
            </div>

            <button onClick={goNext} title={t('toolbar.nextPage')} className={styles.btn}>
                <ChevronRight size={18} />
            </button>
            <button onClick={goToLast} title={t('toolbar.lastPage')} className={styles.btn}>
                <ChevronsRight size={18} />
            </button>

            <div className={styles.sep} />

            <button
                onClick={() => setSlideshowActive(!slideshowActive)}
                title={t('toolbar.slideshow')}
                className={`${styles.btn} ${slideshowActive ? styles.btnActive : ''}`}
            >
                <Clock size={18} />
            </button>
        </div>
    );
}
