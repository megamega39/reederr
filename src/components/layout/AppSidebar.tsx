import { memo } from 'react';
import { FolderTree } from '../FolderTree';
import { FileList } from '../FileList';
import { ResizableDivider } from '../ResizableDivider';
import { useLayoutStore } from '../../stores/layoutStore';
import styles from '../../App.module.css';

export const AppSidebar = memo(() => {
  const leftPaneWidth = useLayoutStore((s) => s.leftPaneWidth);
  const folderPaneHeight = useLayoutStore((s) => s.folderPaneHeight);
  const setFolderPaneHeight = useLayoutStore((s) => s.setFolderPaneHeight);

  return (
    <div
      className={styles.appLeft}
      style={{ width: leftPaneWidth, minWidth: leftPaneWidth, maxWidth: leftPaneWidth }}
    >
      <div className={styles.appLeftPanes}>
        <div
          className={styles.appFolderPane}
          style={{ height: folderPaneHeight, minHeight: folderPaneHeight }}
        >
          <FolderTree />
        </div>
        <ResizableDivider
          orientation="vertical"
          onResize={(delta) => setFolderPaneHeight(folderPaneHeight + delta)}
        />
        <div className={styles.appFilePane}>
          <FileList />
        </div>
      </div>
    </div>
  );
});

AppSidebar.displayName = 'AppSidebar';
