import {
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
    Clock,
} from 'lucide-react';
import { useViewerStore } from '../stores/viewerStore';
import styles from './ViewerToolbar.module.css';

export function ToolbarNavigation() {
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
        </div>
    );
}
