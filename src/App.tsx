import { useViewerStore } from './stores/viewerStore';
import { FolderTree } from './components/FolderTree';
import { FileList } from './components/FileList';
import { MediaView } from './components/MediaView';
import { StatusBar } from './components/StatusBar';

function App() {
  const loadRoot = useViewerStore((s) => s.loadRoot);

  return (
    <div className="app">
      <div className="app-toolbar">
        <button type="button" onClick={loadRoot}>
          フォルダを開く
        </button>
      </div>
      <div className="app-content">
        <div className="app-left">
          <FolderTree />
          <FileList />
        </div>
        <div className="app-right">
          <MediaView />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
