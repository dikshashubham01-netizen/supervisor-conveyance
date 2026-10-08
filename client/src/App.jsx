import React, { useState, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';
import { LoginPage } from './pages/auth/LoginPage';
import { DownloadPage } from './pages/DownloadPage';

// Supervisor Pages (Lazy Loaded for fast initial load)
const SupervisorDashboard = lazy(() => import('./pages/supervisor/SupervisorDashboard').then(m => ({ default: m.SupervisorDashboard })));
const SupervisorHistory = lazy(() => import('./pages/supervisor/SupervisorHistory').then(m => ({ default: m.SupervisorHistory })));

// Admin Pages (Lazy Loaded for fast initial load)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const LiveMapPage = lazy(() => import('./pages/admin/LiveMapPage').then(m => ({ default: m.LiveMapPage })));
const SupervisorsPage = lazy(() => import('./pages/admin/SupervisorsPage').then(m => ({ default: m.SupervisorsPage })));
const DutySessionsPage = lazy(() => import('./pages/admin/DutySessionsPage').then(m => ({ default: m.DutySessionsPage })));
const ConveyanceSettingsPage = lazy(() => import('./pages/admin/ConveyanceSettingsPage').then(m => ({ default: m.ConveyanceSettingsPage })));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const AttendancePage = lazy(() => import('./pages/admin/AttendancePage').then(m => ({ default: m.AttendancePage })));
const MonthlyConveyancePage = lazy(() => import('./pages/admin/MonthlyConveyancePage').then(m => ({ default: m.MonthlyConveyancePage })));
const MeterInstallationsPage = lazy(() => import('./pages/admin/MeterInstallationsPage').then(m => ({ default: m.MeterInstallationsPage })));

import {
  LayoutDashboard,
  MapPin,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Settings,
  History,
  Navigation,
  Clock,
  UserCheck,
  Bike,
  Zap
} from 'lucide-react';

function AppInner() {
  const { user, loading, isAdmin, isSupervisor } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => {
    return window.location.pathname.toLowerCase().includes('download') ? 'download' : 'dashboard';
  });

  // Handle URL changes or popstate
  React.useEffect(() => {
    const handleUrlChange = () => {
      if (window.location.pathname.toLowerCase().includes('download')) {
        setCurrentPage('download');
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  if (currentPage === 'download') {
    return (
      <DownloadPage
        onBackToLogin={() => {
          window.history.pushState({}, '', '/');
          setCurrentPage('dashboard');
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium tracking-wide">Loading GeoConvey System...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onGoToDownload={() => {
          window.history.pushState({}, '', '/download');
          setCurrentPage('download');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <Navbar onNavigate={setCurrentPage} currentPage={currentPage} />

      {/* Admin Secondary Navigation Tab Strip */}
      {isAdmin && (
        <div className="bg-slate-900 border-b border-slate-800 sticky top-16 z-30 overflow-x-auto shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 sm:gap-2 h-12 whitespace-nowrap text-xs font-medium">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'dashboard'
                  ? 'bg-slate-800 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-brand-400" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentPage('live-map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'live-map'
                  ? 'bg-slate-800 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Tracking</span>
            </button>

            <button
              onClick={() => setCurrentPage('supervisors')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'supervisors'
                  ? 'bg-slate-800 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Supervisors</span>
            </button>

            <button
              onClick={() => setCurrentPage('duty-sessions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'duty-sessions'
                  ? 'bg-slate-800 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Duty Sessions</span>
            </button>

            <button
              onClick={() => setCurrentPage('meter-installations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'meter-installations'
                  ? 'bg-slate-800 text-cyan-300 font-semibold shadow border border-cyan-800'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Meter Installations</span>
            </button>

            <button
              onClick={() => setCurrentPage('attendance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'attendance'
                  ? 'bg-slate-800 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Attendance</span>
            </button>

            <button
              onClick={() => setCurrentPage('conveyance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'conveyance'
                  ? 'bg-slate-800 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <Bike className="w-3.5 h-3.5 text-brand-400" />
              <span>Conveyance</span>
            </button>

            <button
              onClick={() => setCurrentPage('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'reports'
                  ? 'bg-slate-800 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>Reports</span>
            </button>

            <button
              onClick={() => setCurrentPage('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'settings'
                  ? 'bg-slate-800 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-purple-400" />
              <span>Conveyance Rates</span>
            </button>

            <button
              onClick={() => setCurrentPage('audit-logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentPage === 'audit-logs'
                  ? 'bg-slate-800 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <History className="w-3.5 h-3.5 text-rose-400" />
              <span>Audit Logs</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content View */}
      <main className="flex-1 pb-12">
        <Suspense
          fallback={
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium tracking-wide">Loading view...</span>
            </div>
          }
        >
          {isSupervisor && (
            <SupervisorDashboard />
          )}

          {isAdmin && (
            <>
              {currentPage === 'dashboard' && <AdminDashboard onNavigate={setCurrentPage} />}
              {currentPage === 'live-map' && <LiveMapPage />}
              {currentPage === 'supervisors' && <SupervisorsPage />}
              {currentPage === 'duty-sessions' && <DutySessionsPage />}
              {currentPage === 'meter-installations' && <MeterInstallationsPage />}
              {currentPage === 'attendance' && <AttendancePage />}
              {currentPage === 'conveyance' && <MonthlyConveyancePage />}
              {currentPage === 'reports' && <ReportsPage />}
              {currentPage === 'settings' && <ConveyanceSettingsPage />}
              {currentPage === 'audit-logs' && <AuditLogsPage />}
            </>
          )}
        </Suspense>
      </main>
    </div>
  );
}

// ─── Global Error Boundary ──────────────────────────────────────────────────
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || String(error) };
  }
  componentDidCatch(error, info) {
    console.error('🚨 Portal GlobalErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-2xl">
            ⚠️
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">System View Error</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {this.state.errorMsg || 'An unexpected rendering error occurred in this view.'}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, errorMsg: '' });
              window.location.reload();
            }}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm text-white rounded-xl shadow-lg transition"
          >
            Refresh & Recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AppInner />
    </GlobalErrorBoundary>
  );
}
