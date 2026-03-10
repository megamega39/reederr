import { useState, useRef, memo } from 'react';
import { ArrowLeft, ArrowRight, CornerLeftUp, RefreshCw, ChevronDown } from 'lucide-react';
import { useViewerStore } from '../stores/viewerStore';
import { HistoryDropdown } from './HistoryDropdown';

export const NavigationBar = memo(() => {
    const {
        goBack,
        goForward,
        goUp,
        refresh,
        canGoBack,
        canGoForward,
        currentPath,
    } = useViewerStore();

    const [backMenuOpen, setBackMenuOpen] = useState(false);
    const [forwardMenuOpen, setForwardMenuOpen] = useState(false);
    const backBtnRef = useRef<HTMLDivElement>(null);
    const forwardBtnRef = useRef<HTMLDivElement>(null);

    // ルートディレクトリかどうかの簡易判定
    const isRoot = !currentPath || (
        !currentPath.includes('/') && !currentPath.includes('\\')
    ) || currentPath.endsWith('!');

    return (
        <div className="navigation-bar">
            <div className="nav-group">
                <div className="nav-item-with-menu" ref={backBtnRef}>
                    <button
                        className="nav-btn nav-btn-back"
                        onClick={goBack}
                        disabled={!canGoBack()}
                        title="戻る (Alt+←)"
                    >
                        <ArrowLeft size={20} />
                        <span className="nav-btn-text">戻る</span>
                    </button>
                    <button
                        className="nav-dropdown-btn"
                        title="履歴"
                        onClick={() => setBackMenuOpen(!backMenuOpen)}
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>

                <div className="nav-item-with-menu" ref={forwardBtnRef}>
                    <button
                        className="nav-btn"
                        onClick={goForward}
                        disabled={!canGoForward()}
                        title="進む (Alt+→)"
                    >
                        <ArrowRight size={20} />
                    </button>
                    <button
                        className="nav-dropdown-btn"
                        title="履歴"
                        onClick={() => setForwardMenuOpen(!forwardMenuOpen)}
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>

                <button
                    className="nav-btn"
                    onClick={goUp}
                    disabled={isRoot}
                    title="一つ上のフォルダへ (Alt+↑)"
                >
                    <CornerLeftUp size={20} />
                    <span className="nav-btn-hint-text">フォルダ</span>
                </button>

                <button
                    className="nav-btn"
                    onClick={refresh}
                    title="更新 (F5)"
                >
                    <RefreshCw size={18} />
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
