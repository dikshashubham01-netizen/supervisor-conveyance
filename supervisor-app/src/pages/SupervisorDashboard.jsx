import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDuty } from '../context/DutyContext';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { StartDutyWizard } from './StartDutyWizard';
import { EndDutyWizard } from './EndDutyWizard';
import { SupervisorHistory } from './SupervisorHistory';
import { ServerConfigModal } from '../components/common/ServerConfigModal';
import { formatCurrency, formatDistance, formatTime } from '../utils/formatters';
import {
  Navigation,
  Play,
  Square,
  Clock,
  Gauge,
  IndianRupee,
  RefreshCw,
  History,
  Shield,
  Settings,
  LogOut,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';

export function SupervisorDashboard() {
  const { user, logout } = useAuth();
  const { activeDuty, isOnDuty, refreshDuty, lastSyncTime } = useDuty();
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOfflineQueue();

  const [viewState, setViewState] = useState('dashboard'); // 'dashboard' | 'start' | 'end' | 'history'
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);

  // High-accuracy background GPS tracking
  const { currentPosition, error: gpsError } = useGeolocation(isOnDuty, activeDuty?.id);

  // Auto-refresh stats from server periodically while on duty
  useEffect(() => {
    if (!isOnDuty) return;
    const interval = setInterval(refreshDuty, 12000);
    return () => clearInterval(interval);
  }, [isOnDuty, refreshDuty]);

  if (viewState === 'start') {
    return (
      <StartDutyWizard
        onDutyStarted={() => {
          refreshDuty();
          setViewState('dashboard');
        }}
        onCancel={() => setViewState('dashboard')}
      />
    );
  }

  if (viewState === 'end') {
    return (
      <EndDutyWizard
        activeDuty={activeDuty}
        onDutyEnded={() => {
          refreshDuty();
          setViewState('dashboard');
        }}
        onCancel={() => setViewState('dashboard')}
      />
    );
  }

  if (viewState === 'history') {
    return <SupervisorHistory onBack={() => setViewState('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-8 max-w-md mx-auto flex flex-col justify-between gap-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/60">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm text-white leading-tight">{user?.name}</div>
            <div className="text-[11px] text-slate-400 font-mono">{user?.employee_id}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsServerModalOpen(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            title="Server Host Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/80 rounded-2xl border border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Wifi className="w-3.5 h-3.5" />
              <span>Online</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline</span>
            </span>
          )}
          <span className="text-slate-500">•</span>
          {pendingCount > 0 ? (
            <span className="text-amber-400 font-mono font-semibold">🟠 {pendingCount} unsynced</span>
          ) : (
            <span className="text-emerald-400 font-medium">🟢 Synced</span>
          )}
        </div>

        <button
          type="button"
          onClick={triggerSync}
          className="text-slate-400 hover:text-white p-1"
          title="Sync Now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* GPS Error Warning */}
      {gpsError && isOnDuty && (
        <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>GPS Alert: {gpsError}</span>
        </div>
      )}

      {/* MAIN STATE CARD */}
      {isOnDuty ? (
        /* ON DUTY STATE */
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl p-6 border border-emerald-500/40 shadow-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Current Session</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-950 border border-emerald-500 text-emerald-400 shadow">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  🟢 ON DUTY
                </span>
              </div>
            </div>

            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Navigation className="w-3 h-3 animate-spin" />
              <span>GPS Tracking Active</span>
            </span>
          </div>

          {/* Telemetry Metrics */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                <Clock className="w-3 h-3 text-slate-400" /> Start Time
              </span>
              <strong className="text-white text-base font-mono mt-1 block">
                {formatTime(activeDuty.start_time)}
              </strong>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                <Gauge className="w-3 h-3 text-blue-400" /> Start KM
              </span>
              <strong className="text-blue-400 text-base font-mono mt-1 block">
                {activeDuty.start_odometer_final ? `${Number(activeDuty.start_odometer_final).toLocaleString()} KM` : '---'}
              </strong>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                <Navigation className="w-3 h-3 text-emerald-400" /> GPS Distance
              </span>
              <strong className="text-emerald-400 text-xl font-mono font-bold mt-1 block">
                {formatDistance(activeDuty.gps_distance_km)}
              </strong>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                <IndianRupee className="w-3 h-3 text-brand-400" /> Current Conveyance
              </span>
              <strong className="text-brand-400 text-xl font-mono font-bold mt-1 block">
                {formatCurrency(activeDuty.estimatedConveyance)}
              </strong>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 text-[11px] text-slate-400 flex items-center gap-2 border border-slate-800">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Tracking is active in foreground/background during duty.</span>
          </div>

          {/* Large END DUTY Button */}
          <button
            type="button"
            onClick={() => setViewState('end')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-lg tracking-wide hover:from-rose-500 hover:to-red-500 shadow-xl shadow-rose-950 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <Square className="w-5 h-5 fill-current" />
            <span>END DUTY</span>
          </button>
        </div>
      ) : (
        /* OFF DUTY STATE */
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center gap-5">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Play className="w-10 h-10 ml-1 fill-emerald-500/30 text-emerald-400" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Ready for Field Duty?</h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Take your live attendance selfie and bike odometer photo to begin travel tracking.
            </p>
          </div>

          {/* START DUTY Button */}
          <button
            type="button"
            onClick={() => setViewState('start')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-lg tracking-wide shadow-2xl shadow-emerald-950/90 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>START DUTY</span>
          </button>
        </div>
      )}

      {/* Bottom Nav / Actions */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={() => setViewState('history')}
          className="py-3 px-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 shadow"
        >
          <History className="w-4 h-4 text-brand-400" />
          <span>My History</span>
        </button>

        <button
          type="button"
          onClick={() => setIsServerModalOpen(true)}
          className="py-3 px-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 shadow"
        >
          <Settings className="w-4 h-4 text-emerald-400" />
          <span>Server Settings</span>
        </button>
      </div>

      <ServerConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
    </div>
  );
}
