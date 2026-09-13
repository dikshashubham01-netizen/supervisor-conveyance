import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { DutyProvider } from './context/DutyContext.jsx';
import { OfflineQueueProvider } from './context/OfflineQueueContext.jsx';

// ─── Global Error Handlers ──────────────────────────────────────────────────
window.onerror = function (message, source, lineno, colno, error) {
  console.error('🚨 Portal window.onerror:', message, 'at', source, lineno, colno, error);
  return false;
};
window.addEventListener('unhandledrejection', function (event) {
  console.error('🚨 Portal Unhandled Promise rejection:', event.reason);
  event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <DutyProvider>
        <OfflineQueueProvider>
          <App />
        </OfflineQueueProvider>
      </DutyProvider>
    </AuthProvider>
  </React.StrictMode>
);
