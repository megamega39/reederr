import { useState } from 'react';
import { useLayoutStore, saveLayoutToStorage } from '../stores/layoutStore';
import { useViewerStore } from '../stores/viewerStore';
import type { ViewMode, Binding } from '../stores/layoutStore';
import { ShortcutSettings } from './ShortcutSettings';
import { ExternalToolSettings } from './ExternalToolSettings';

interface Props {
    onClose: () => void;
}

type Tab = 'general' | 'shortcuts' | 'externalTools';

export function SettingsModal({ onClose }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('general');
    
    const viewMode = useLayoutStore((s) => s.viewMode);
    const setViewMode = useLayoutStore((s) => s.setViewMode);
    const binding = useLayoutStore((s) => s.binding);
    const setBinding = useLayoutStore((s) => s.setBinding);
    const autoThreshold = useLayoutStore((s) => s.autoThreshold);
    const setAutoThreshold = useLayoutStore((s) => s.setAutoThreshold);
    const recursiveMedia = useLayoutStore((s) => s.recursiveMedia);
    const setRecursiveMedia = useLayoutStore((s) => s.setRecursiveMedia);
    const wrapNavigation = useViewerStore((s) => s.wrapNavigation);
    const setWrapNavigation = useViewerStore((s) => s.setWrapNavigation);
    const currentPath = useViewerStore((s) => s.currentPath);
    const loadDirectory = useViewerStore((s) => s.loadDirectory);

    const [localViewMode, setLocalViewMode] = useState<ViewMode>(viewMode);
    const [localBinding, setLocalBinding] = useState<Binding>(binding);
    const [localAutoThreshold, setLocalAutoThreshold] = useState(autoThreshold);
    const [localRecursive, setLocalRecursive] = useState(recursiveMedia);
    const [localWrap, setLocalWrap] = useState(wrapNavigation);

    const handleApply = () => {
        setViewMode(localViewMode);
        setBinding(localBinding);
        setAutoThreshold(localAutoThreshold);
        setRecursiveMedia(localRecursive);
        setWrapNavigation(localWrap);
        saveLayoutToStorage();
        if (localRecursive !== recursiveMedia && currentPath) {
            loadDirectory(currentPath, { pushHistory: false });
        }
        onClose();
    };

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <span className="settings-title">設定</span>
                    <button className="settings-close-btn" onClick={onClose} title="閉じる">✕</button>
                </div>
                
                <div className="settings-tabs">
                    <button 
                        className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
                        onClick={() => setActiveTab('general')}
                    >
                        全般
                    </button>
                    <button 
                        className={`settings-tab-btn ${activeTab === 'shortcuts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('shortcuts')}
                    >
                        ショートカット
                    </button>
                    <button 
                        className={`settings-tab-btn ${activeTab === 'externalTools' ? 'active' : ''}`}
                        onClick={() => setActiveTab('externalTools')}
                    >
                        外部ツール
                    </button>
                </div>

                <div className="settings-body">
                    {activeTab === 'general' ? (
                        <>
                            {/* 表示モード */}
                            <section className="settings-section">
                                <h3 className="settings-section-title">表示モード</h3>
                                <div className="settings-row">
                                    {(['single', 'spread', 'auto'] as ViewMode[]).map((m) => (
                                        <label key={m} className={`settings-radio-label ${localViewMode === m ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="viewMode"
                                                value={m}
                                                checked={localViewMode === m}
                                                onChange={() => setLocalViewMode(m)}
                                            />
                                            {m === 'single' ? '1枚表示' : m === 'spread' ? '見開き (2枚)' : '自動判定'}
                                        </label>
                                    ))}
                                </div>
                                {localViewMode === 'auto' && (
                                    <div className="settings-field">
                                        <label className="settings-label">見開き判定 閾値（縦-横比）</label>
                                        <div className="settings-slider-row">
                                            <input
                                                type="range"
                                                min={1.1}
                                                max={1.8}
                                                step={0.05}
                                                value={localAutoThreshold}
                                                onChange={(e) => setLocalAutoThreshold(parseFloat(e.target.value))}
                                                className="settings-slider"
                                            />
                                            <span className="settings-slider-val">{localAutoThreshold.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* 綴じ方向 */}
                            <section className="settings-section">
                                <h3 className="settings-section-title">綴じ方向</h3>
                                <div className="settings-row">
                                    {(['rtl', 'ltr'] as Binding[]).map((b) => (
                                        <label key={b} className={`settings-radio-label ${localBinding === b ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="binding"
                                                value={b}
                                                checked={localBinding === b}
                                                onChange={() => setLocalBinding(b)}
                                            />
                                            {b === 'rtl' ? '右綴じ（日本語マンガ）' : '左綴じ（洋書）'}
                                        </label>
                                    ))}
                                </div>
                            </section>

                            {/* ナビゲーション */}
                            <section className="settings-section">
                                <h3 className="settings-section-title">ナビゲーション</h3>
                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={localWrap}
                                        onChange={(e) => setLocalWrap(e.target.checked)}
                                    />
                                    <span>端でループする（最後から最初に戻る）</span>
                                </label>
                            </section>

                            {/* ファイル読み込み */}
                            <section className="settings-section">
                                <h3 className="settings-section-title">ファイル読み込み</h3>
                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={localRecursive}
                                        onChange={(e) => setLocalRecursive(e.target.checked)}
                                    />
                                    <span>サブフォルダも含めて画像を表示（再帰表示）</span>
                                </label>
                            </section>
                        </>
                    ) : activeTab === 'shortcuts' ? (
                        <ShortcutSettings />
                    ) : (
                        <ExternalToolSettings />
                    )}
                </div>
                
                <div className="settings-footer">
                    <button className="settings-btn settings-btn--cancel" onClick={onClose}>キャンセル</button>
                    {activeTab === 'general' && (
                        <button className="settings-btn settings-btn--apply" onClick={handleApply}>適用して閉じる</button>
                    )}
                    {activeTab !== 'general' && (
                        <button className="settings-btn settings-btn--apply" onClick={onClose}>閉じる</button>
                    )}
                </div>
            </div>
        </div>
    );
}
