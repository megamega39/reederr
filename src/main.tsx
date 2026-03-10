import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<div style={{ padding: 16, color: '#e57373' }}>データの読み込みに失敗しました。アプリを再起動してください。</div>}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
