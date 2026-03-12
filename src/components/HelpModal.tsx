import { useState } from 'react';
import styles from './HelpModal.module.css';
import { useTranslation } from '../i18n';

interface Props {
  onClose: () => void;
}

type Tab = 'basics' | 'shortcuts' | 'features';

export function HelpModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('basics');

  const renderBasics = () => (
    <div className={styles.helpContent}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('help.basics.mouse')}</h3>
        <ul className={styles.list}>
          <li><strong>{t('common.ok')}</strong>: {t('help.basics.click')}</li>
          <li><strong>{t('common.doubleClick' as any)}</strong>: {t('help.basics.doubleClick')}</li>
          <li><strong>{t('common.rightClick' as any)}</strong>: {t('help.basics.rightClick')}</li>
          <li><strong>{t('common.mouseWheel' as any)}</strong>: {t('help.basics.wheel')}</li>
        </ul>
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('help.basics.navTitle')}</h3>
        <p>{t('help.basics.navDesc')}</p>
      </section>
    </div>
  );

  const renderShortcuts = () => (
    <div className={styles.helpContent}>
      <div className={styles.shortcutGrid}>
        <div className={styles.shortcutItem}><kbd>Left</kbd> / <kbd>Right</kbd><span>{t('help.shortcuts.prevNext')}</span></div>
        <div className={styles.shortcutItem}><kbd>Space</kbd> / <kbd>Backspace</kbd><span>{t('help.shortcuts.pagePrevNext')}</span></div>
        <div className={styles.shortcutItem}><kbd>Home</kbd> / <kbd>End</kbd><span>{t('help.shortcuts.firstLast')}</span></div>
        <div className={styles.shortcutItem}><kbd>Alt</kbd>+<kbd>Up</kbd><span>{t('help.shortcuts.upDir')}</span></div>
        <div className={styles.shortcutItem}><kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd><span>{t('help.shortcuts.viewModes')}</span></div>
        <div className={styles.shortcutItem}><kbd>F11</kbd><span>{t('help.shortcuts.fullscreen')}</span></div>
        <div className={styles.shortcutItem}><kbd>F2</kbd><span>{t('help.shortcuts.rename')}</span></div>
        <div className={styles.shortcutItem}><kbd>Ctrl</kbd>+<kbd>F</kbd><span>{t('help.shortcuts.filter')}</span></div>
        <div className={styles.shortcutItem}><kbd>F1</kbd><span>{t('help.shortcuts.help')}</span></div>
      </div>
    </div>
  );

  const renderFeatures = () => (
    <div className={styles.helpContent}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('help.features.filterTitle')}</h3>
        <p>{t('help.features.filterDesc')}</p>
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('help.features.archiveTitle')}</h3>
        <p>{t('help.features.archiveDesc')}</p>
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('help.features.externalTitle')}</h3>
        <p>{t('help.features.externalDesc')}</p>
      </section>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('help.title')}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        
        <div className={styles.tabs}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'basics' ? styles.active : ''}`}
            onClick={() => setActiveTab('basics')}
          >
            {t('help.tabs.basics')}
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'shortcuts' ? styles.active : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            {t('help.tabs.shortcuts')}
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'features' ? styles.active : ''}`}
            onClick={() => setActiveTab('features')}
          >
            {t('help.tabs.features')}
          </button>
        </div>

        <div className={styles.body}>
          {activeTab === 'basics' && renderBasics()}
          {activeTab === 'shortcuts' && renderShortcuts()}
          {activeTab === 'features' && renderFeatures()}
        </div>

        <div className={styles.footer}>
          <button className={styles.okBtn} onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
