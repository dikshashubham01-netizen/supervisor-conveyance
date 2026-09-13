import React from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { SupervisorDashboard } from './pages/SupervisorDashboard';

// ─── Global Error Boundary ──────────────────────────────────────────────────
// Catches all React render errors and shows a recovery screen instead of
// crashing to a blank/black screen. This is a class component (required by React).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || String(error) };
  }

  componentDidCatch(error, info) {
    console.error('🚨 App ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#090d16',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'sans-serif',
            color: '#f1f5f9',
            gap: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <strong style={{ fontSize: 18, color: '#f87171' }}>App Error</strong>
          <p style={{ fontSize: 12, color: '#94a3b8', maxWidth: 320 }}>
            {this.state.errorMsg || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => {
              // Clear any corrupted state and reload
              try { localStorage.clear(); } catch (e) {}
              window.location.reload();
            }}
            style={{
              marginTop: 8,
              padding: '12px 28px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Tap to Restart App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Inner App ──────────────────────────────────────────────────────────────
function AppInner() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold tracking-wider uppercase">Loading Supervisor App...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <SupervisorDashboard />;
}

// ─── Default export wraps everything in ErrorBoundary ───────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
