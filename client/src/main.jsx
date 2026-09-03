import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { DutyProvider } from './context/DutyContext.jsx';
import { OfflineQueueProvider } from './context/OfflineQueueContext.jsx';

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
