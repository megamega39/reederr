import { useState } from 'react';
import { useLayoutStore, saveLayoutToStorage } from '../stores/layoutStore';
import { useViewerStore } from '../stores/viewerStore';
import { useMediaPlayerStore } from '../stores/mediaPlayerStore';
import type { ViewMode, Binding } from '../stores/layoutStore';
import { ShortcutSettings } from './ShortcutSettings';
import { ExternalToolSettings } from './ExternalToolSettings';
import { useTranslation } from '../i18n';
import { useShallow } from 'zustand/react/shallow';

interface Props {
    onClose: () => void;
}

type Tab = 'general' | 'shortcuts' | 'externalTools';

export function SettingsModal({ onClose }: Props) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<Tab>('general');
    
    const { viewMode, binding, autoThreshold, recursiveMedia, setViewMode, setBinding, setAutoThreshold, setRecursiveMedia } = useLayoutStore(
        useShallow((s) => ({
            viewMode: s.viewMode,
            binding: s.binding,
            autoThreshold: s.autoThreshold,
            recursiveMedia: s.recursiveMedia,
            setViewMode: s.setViewMode,
            setBinding: s.setBinding,
            setAutoThreshold: s.setAutoThreshold,
            setRecursiveMedia: s.setRecursiveMedia,
        }))
    );
    
    const { language, wrapNavigation, currentPath, setLanguage, setWrapNavigation, loadDirectory } = useViewerStore(
        useShallow((s) => ({
            language: s.language,
            wrapNavigation: s.wrapNavigation,
            currentPath: s.currentPath,
            setLanguage: s.setLanguage,
            setWrapNavigation: s.setWrapNavigation,
            loadDirectory: s.loadDirectory,
        }))
    );
    
    const { autoPlay, setAutoPlay } = useMediaPlayerStore(
        useShallow((s) => ({
            autoPlay: s.autoPlay,
            setAutoPlay: s.setAutoPlay,
        }))
    );

    const [localViewMode, setLocalViewMode] = useState<ViewMode>(viewMode);
    const [localBinding, setLocalBinding] = useState<Binding>(binding);
    const [localAutoThreshold, setLocalAutoThreshold] = useState(autoThreshold);
    const [localRecursive, setLocalRecursive] = useState(recursiveMedia);
    const [localWrap, setLocalWrap] = useState(wrapNavigation);
    const [localAutoPlay, setLocalAutoPlay] = useState(autoPlay);
    const [localLanguage, setLocalLanguage] = useState<'ja' | 'en'>(language);

    const handleApply = () => {
        setViewMode(localViewMode);
        setBinding(localBinding);
        setAutoThreshold(localAutoThreshold);
        setRecursiveMedia(localRecursive);
        setWrapNavigation(localWrap);
        setAutoPlay(localAutoPlay);
        setLanguage(localLanguage);
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
                    <span className="settings-title">{t('settings.title')}</span>
                    <button className="settings-close-btn" onClick={onClose} title={t('common.close')}>✕</button>
                </div>
                
                <div className="settings-tabs">
                    <button 
                        className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
                        onClick={() => setActiveTab('general')}
                    >
                        {t('settings.general')}
                    </button>
                    <button 
                        className={`settings-tab-btn ${activeTab === 'shortcuts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('shortcuts')}
                    >
                        {t('settings.shortcuts')}
                    </button>
                    <button 
                        className={`settings-tab-btn ${activeTab === 'externalTools' ? 'active' : ''}`}
                        onClick={() => setActiveTab('externalTools')}
                    >
                        {t('settings.externalTools')}
                    </button>
                </div>

                <div className="settings-body">
                    {activeTab === 'general' ? (
                        <>
                            {/* 表示言語 */}
                            <section className="settings-section">
                                <h3 className="settings-section-title">{t('settings.language')}</h3>
                                <div className="settings-row">
                                    <label className={`settings-radio-label ${localLanguage === 'ja' ? 'active' : ''}`}>
                                        <input
                                            type="radio"
                                            name="language"
                                            value="ja"
                                            checked={localLanguage === 'ja'}
                                            onChange={() => setLocalLanguage('ja')}
                                        />
                                        日本語 (Japanese)
                                    </label>
                                    <label className={`settings-radio-label ${localLanguage === 'en' ? 'active' : ''}`}>
                                        <input
                                            type="radio"
                                            name="language"
                                            value="en"
                                            checked={localLanguage === 'en'}
                                            onChange={() => setLocalLanguage('en')}
                                        />
                                        English
                                    </label>
                                </div>
                            </section>

                            {/* 表示モード */}
                            <section className="settings-section">
                                <h3 className="settings-section-title">{t('settings.viewMode')}</h3>
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
                                            {m === 'single' ? t('settings.viewModeSingle') : m === 'spread' ? t('settings.viewModeSpread') : t('settings.viewModeAuto')}
                                        </label>
                                    ))}
                                </div>
                                {localViewMode === 'auto' && (
                                    <div className="settings-field">
                                        <label className="settings-label">{t('settings.autoThreshold')}</label>
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
                                <h3 className="settings-section-title">{t('settings.binding')}</h3>
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
                                            {b === 'rtl' ? t('settings.bindingRTL') : t('settings.bindingLTR')}
                                        </label>
                                    ))}
                                </div>
                            </section>

                            {/* ナビゲーション */}
                            <section className="settings-section">
                                <h3 className="settings-section-title">{t('settings.navigation')}</h3>
                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={localWrap}
                                        onChange={(e) => setLocalWrap(e.target.checked)}
                                    />
                                    <span>{t('settings.wrapLoop')}</span>
                                </label>
                            </section>

                            {/* ファイル読み込み */}
                            <section className="settings-section">
                                <h3 className="settings-section-title">{t('settings.fileLoading')}</h3>
                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={localRecursive}
                                        onChange={(e) => setLocalRecursive(e.target.checked)}
                                    />
                                    <span>{t('settings.recursive')}</span>
                                </label>
                            </section>

                            {/* メディア */}
                            <section className="settings-section">
                                <h3 className="settings-section-title">{t('settings.media')}</h3>
                                <label className="settings-toggle">
                                    <input
                                        type="checkbox"
                                        checked={localAutoPlay}
                                        onChange={(e) => setLocalAutoPlay(e.target.checked)}
                                    />
                                    <span>{t('settings.autoPlayMedia')}</span>
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
                    <button className="settings-btn settings-btn--cancel" onClick={onClose}>{t('common.cancel')}</button>
                    {activeTab === 'general' && (
                        <button className="settings-btn settings-btn--apply" onClick={handleApply}>{t('common.apply')}</button>
                    )}
                    {activeTab !== 'general' && (
                        <button className="settings-btn settings-btn--apply" onClick={onClose}>{t('common.close')}</button>
                    )}
                </div>
            </div>
        </div>
    );
}
