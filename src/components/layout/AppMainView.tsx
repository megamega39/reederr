import { memo } from 'react';
import { ViewerToolbar } from '../ViewerToolbar';
import { MediaView } from '../MediaView';
import { useLayoutStore } from '../../stores/layoutStore';
import { MediaAPI } from '../../services/api';
import styles from '../../App.module.css';

export const AppMainView = memo(() => {
  const handleToggleFullscreen = () => {
    const isFullscreen = useLayoutStore.getState().isPreviewFullscreen;
    MediaAPI.setPreviewFullscreen(!isFullscreen);
  };

  return (
    <div
      className={styles.appRight}
      onDoubleClick={handleToggleFullscreen}
      role="button"
      title="ダブルクリックで表示のみ全画面"
    >
      <ViewerToolbar />
      <MediaView />
    </div>
  );
});

AppMainView.displayName = 'AppMainView';
