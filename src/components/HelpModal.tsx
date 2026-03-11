import { useState } from 'react';
import styles from './HelpModal.module.css';

interface Props {
  onClose: () => void;
}

type Tab = 'basics' | 'shortcuts' | 'features';

export function HelpModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('basics');

  const renderBasics = () => (
    <div className={styles.helpContent}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>マウス操作</h3>
        <ul className={styles.list}>
          <li><strong>左クリック</strong>: ファイルの選択 / フォルダの展開</li>
          <li><strong>ダブルクリック</strong>: 全画面表示の切り替え</li>
          <li><strong>右クリック</strong>: コンテキストメニュー表示</li>
          <li><strong>マウスホイール</strong>: 前後のページへ移動（ビューア上）</li>
        </ul>
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>ナビゲーション</h3>
        <p>左側のフォルダツリーとファイルリストを使ってメディアを選択します。アーカイブ（ZIP/7z等）は通常のフォルダと同じように中身を直接ブラウズできます。</p>
      </section>
    </div>
  );

  const renderShortcuts = () => (
    <div className={styles.helpContent}>
      <div className={styles.shortcutGrid}>
        <div className={styles.shortcutItem}><kbd>Left</kbd> / <kbd>Right</kbd><span>前のファイル / 次のファイル</span></div>
        <div className={styles.shortcutItem}><kbd>Space</kbd> / <kbd>Backspace</kbd><span>次のページ / 前のページ</span></div>
        <div className={styles.shortcutItem}><kbd>Home</kbd> / <kbd>End</kbd><span>先頭へ / 末尾へ</span></div>
        <div className={styles.shortcutItem}><kbd>Alt</kbd>+<kbd>Up</kbd><span>上の階層へ移動</span></div>
        <div className={styles.shortcutItem}><kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd><span>1枚表示 / 見開き / 自動判定</span></div>
        <div className={styles.shortcutItem}><kbd>F11</kbd><span>全画面表示</span></div>
        <div className={styles.shortcutItem}><kbd>F2</kbd><span>ファイル名の変更（インライン）</span></div>
        <div className={styles.shortcutItem}><kbd>Ctrl</kbd>+<kbd>F</kbd><span>ファイル検索（フィルタ）にフォーカス</span></div>
        <div className={styles.shortcutItem}><kbd>F1</kbd><span>このヘルプを表示</span></div>
      </div>
    </div>
  );

  const renderFeatures = () => (
    <div className={styles.helpContent}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>リアルタイムフィルタ</h3>
        <p>ファイルリスト上部の入力欄に文字を入力すると、その文字を含むファイルのみを瞬時に絞り込みます。</p>
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>アーカイブ・ストリーミング</h3>
        <p>圧縮ファイルを解凍することなく、中身を直接表示・再生できます。大きな動画ファイルもストリーミング再生に対応しています。</p>
      </section>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>外部ツール連携</h3>
        <p>右クリックメニューから、Photoshop や他のメディアプレイヤーでファイルを開くことができます（設定から追加可能）。</p>
      </section>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Reederr 使い方ガイド</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        
        <div className={styles.tabs}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'basics' ? styles.active : ''}`}
            onClick={() => setActiveTab('basics')}
          >
            基本操作
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'shortcuts' ? styles.active : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            ショートカット
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'features' ? styles.active : ''}`}
            onClick={() => setActiveTab('features')}
          >
            便利な機能
          </button>
        </div>

        <div className={styles.body}>
          {activeTab === 'basics' && renderBasics()}
          {activeTab === 'shortcuts' && renderShortcuts()}
          {activeTab === 'features' && renderFeatures()}
        </div>

        <div className={styles.footer}>
          <button className={styles.okBtn} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
