import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { DutyProvider } from './context/DutyContext.jsx';
import { OfflineQueueProvider } from './context/OfflineQueueContext.jsx';

// ─── Global Error Handlers ──────────────────────────────────────────────────
// Prevent uncaught errors from causing a black screen in Capacitor WebView.
window.onerror = function (message, source, lineno, colno, error) {
  console.error('🚨 Global onerror:', message, 'at', source, lineno, colno, error);
  return false; // let default browser handling continue
};
window.addEventListener('unhandledrejection', function (event) {
  console.error('🚨 Unhandled Promise rejection:', event.reason);
  event.preventDefault(); // Prevent crash in Capacitor WebView
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
