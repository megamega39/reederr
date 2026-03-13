import { useState } from 'react';
import { useNavigationStore } from '../stores/navigationStore';
import { useSettingsStore, ViewMode, Binding } from '../stores/settingsStore';
import { ShortcutSettings } from './ShortcutSettings';
import { ExternalToolSettings } from './ExternalToolSettings';
import { useTranslation } from '../i18n';

interface Props {
    onClose: () => void;
}

type Tab = 'general' | 'shortcuts' | 'externalTools';

export function SettingsModal({ onClose }: Props) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<Tab>('general');
    
    const settings = useSettingsStore();
    const { currentPath, loadDirectory } = useNavigationStore();

    const [localViewMode, setLocalViewMode] = useState<ViewMode>(settings.viewMode);
    const [localBinding, setLocalBinding] = useState<Binding>(settings.binding);
    const [localAutoThreshold, setLocalAutoThreshold] = useState(settings.autoThreshold);
    const [localRecursive, setLocalRecursive] = useState(settings.recursiveMedia);
    const [localWrap, setLocalWrap] = useState(settings.wrapNavigation);
    const [localAutoPlay, setLocalAutoPlay] = useState(settings.autoPlay);
    const [localLanguage, setLocalLanguage] = useState(settings.language as 'ja' | 'en');

    const handleApply = () => {
        settings.setViewMode(localViewMode);
        settings.setBinding(localBinding);
        settings.setAutoThreshold(localAutoThreshold);
        settings.setWrapNavigation(localWrap);
        settings.setAutoPlay(localAutoPlay);
        settings.setLanguage(localLanguage);
        
        const oldRecursive = settings.recursiveMedia;
        settings.setRecursiveMedia(localRecursive);

        if (localRecursive !== oldRecursive && currentPath) {
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
