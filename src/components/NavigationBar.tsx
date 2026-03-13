import { useState, useRef, memo } from 'react';
import { ArrowLeft, ArrowRight, CornerLeftUp, RefreshCw, ChevronDown, LayoutGrid, List, Eye, EyeOff } from 'lucide-react';
import { useViewerStore } from '../stores/viewerStore';
import { useLayoutStore, saveLayoutToStorage } from '../stores/layoutStore';
import { HistoryDropdown } from './HistoryDropdown';
import styles from './NavigationBar.module.css';
import { useTranslation } from '../i18n';

export const NavigationBar = memo(() => {
    const { t } = useTranslation();
    const {
        goBack,
        goForward,
        goUp,
        refresh,
        canGoBack,
        canGoForward,
        canGoUp,
        currentPath,
    } = useViewerStore();

    const { fileListViewMode, setFileListViewMode, showHoverPreview, toggleHoverPreview } = useLayoutStore();

    const [backMenuOpen, setBackMenuOpen] = useState(false);
    const [forwardMenuOpen, setForwardMenuOpen] = useState(false);
    const backBtnRef = useRef<HTMLDivElement>(null);
    const forwardBtnRef = useRef<HTMLDivElement>(null);

    return (
        <div className={styles.navigationBar}>
            <div className={styles.navGroup}>
                <div className={styles.itemWithMenu} ref={backBtnRef}>
                    <button
                        className={styles.navBtn}
                        onClick={goBack}
                        disabled={!canGoBack()}
                        title={`${t('navigation.back')} (Alt+←)`}
                    >
                        <ArrowLeft size={20} />
                        <span className={styles.navBtnText}>{t('navigation.back')}</span>
                    </button>
                    <button
                        className={styles.dropdownBtn}
                        title={t('navigation.history')}
                        onClick={() => setBackMenuOpen(!backMenuOpen)}
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>

                <div className={styles.itemWithMenu} ref={forwardBtnRef}>
                    <button
                        className={styles.navBtn}
                        onClick={goForward}
                        disabled={!canGoForward()}
                        title={`${t('navigation.forward')} (Alt+→)`}
                    >
                        <ArrowRight size={20} />
                    </button>
                    <button
                        className={styles.dropdownBtn}
                        title={t('navigation.history')}
                        onClick={() => setForwardMenuOpen(!forwardMenuOpen)}
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>

                <button
                    className={styles.navBtn}
                    onClick={goUp}
                    disabled={!canGoUp()}
                    title={`${t('navigation.up')} (Alt+↑)`}
                >
                    <CornerLeftUp size={20} />
                    <span className={styles.navBtnHintText}>{t('fileType.folder')}</span>
                </button>

                <button
                    className={styles.navBtn}
                    onClick={refresh}
                    title={`${t('navigation.refresh')} (F5)`}
                >
                    <RefreshCw size={18} />
                </button>

                <button
                    className={`${styles.navBtn} ${showHoverPreview ? styles.active : ''}`}
                    onClick={() => {
                        toggleHoverPreview();
                        saveLayoutToStorage();
                    }}
                    title={showHoverPreview ? t('navigation.disableHoverPreview') : t('navigation.enableHoverPreview')}
                >
                    {showHoverPreview ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>

                <div className={styles.sep} />

                <button
                    className={`${styles.navBtn} ${fileListViewMode === 'list' ? styles.active : ''}`}
                    onClick={() => setFileListViewMode('list')}
                    title={t('navigation.viewList')}
                >
                    <List size={18} />
                </button>
                <button
                    className={`${styles.navBtn} ${fileListViewMode === 'grid' ? styles.active : ''}`}
                    onClick={() => setFileListViewMode('grid')}
                    title={t('navigation.viewGrid')}
                >
                    <LayoutGrid size={18} />
                </button>
            </div>

            {backMenuOpen && (
                <HistoryDropdown
                    onClose={() => setBackMenuOpen(false)}
                    anchorRect={backBtnRef.current?.getBoundingClientRect() || null}
                />
            )}
            {forwardMenuOpen && (
                <HistoryDropdown
                    onClose={() => setForwardMenuOpen(false)}
                    anchorRect={forwardBtnRef.current?.getBoundingClientRect() || null}
                />
            )}
        </div>
    );
});
