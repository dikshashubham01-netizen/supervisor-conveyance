import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDuty } from '../../context/DutyContext';
import { useOfflineQueue } from '../../context/OfflineQueueContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useWakeLock } from '../../hooks/useWakeLock';
import { StartDutyWizard } from './StartDutyWizard';
import { EndDutyWizard } from './EndDutyWizard';
import { SupervisorHistory } from './SupervisorHistory';
import { formatCurrency, formatDistance, formatTime } from '../../utils/formatters';
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
  Sun,
  MapPin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export function SupervisorDashboard() {
  const { user } = useAuth();
  const { activeDuty, isOnDuty, refreshDuty, updateRunningGps, lastSyncTime } = useDuty();
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOfflineQueue();

  const [viewState, setViewState] = useState('dashboard'); // 'dashboard', 'start-wizard', 'end-wizard', 'history'

  // WakeLock keeps screen on during duty
  const { isLocked, isSupported: wakeLockSupported } = useWakeLock(isOnDuty);

  // Active GPS tracking during duty
  const { currentPosition, error: gpsError } = useGeolocation(isOnDuty, activeDuty?.id);

  // Auto-refresh running GPS distance from backend periodically during duty
  useEffect(() => {
    if (!isOnDuty) return;
    const interval = setInterval(async () => {
      refreshDuty();
    }, 12000);
    return () => clearInterval(interval);
  }, [isOnDuty, refreshDuty]);

  // Compute sync time human text
  const [syncTimeText, setSyncTimeText] = useState('Just now');
  useEffect(() => {
    if (!lastSyncTime) {
      setSyncTimeText('Just now');
      return;
    }
    const updateText = () => {
      const diffSec = Math.max(0, Math.round((Date.now() - new Date(lastSyncTime).getTime()) / 1000));
      if (diffSec < 45) {
        setSyncTimeText('Just now');
      } else if (diffSec < 3600) {
        const mins = Math.floor(diffSec / 60);
        setSyncTimeText(`${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`);
      } else {
        setSyncTimeText(new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    };
    updateText();
    const interval = setInterval(updateText, 15000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  if (viewState === 'start-wizard') {
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

  if (viewState === 'end-wizard') {
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
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Duty History</h2>
          <button
            type="button"
            onClick={() => setViewState('dashboard')}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            &larr; Back to Dashboard
          </button>
        </div>
        <SupervisorHistory />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Supervisor Duty</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Welcome, <strong className="text-slate-200">{user?.name}</strong> ({user?.employee_id})
          </p>
        </div>

        <button
          type="button"
          onClick={() => setViewState('history')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition"
        >
          <History className="w-4 h-4 text-brand-400" />
          <span>My History</span>
        </button>
      </div>

      {/* GPS Error Alert if any */}
      {gpsError && isOnDuty && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>GPS Alert: {gpsError}. Please ensure location permissions are granted.</span>
        </div>
      )}

      {/* MAIN DUTY CARD */}
      {isOnDuty ? (
        /* ON DUTY STATE (Specification 8) */
        <div className="bg-gradient-to-b from-slate-850 to-slate-900 rounded-3xl p-6 border border-emerald-500/40 shadow-2xl shadow-emerald-950/30 flex flex-col gap-5">
          {/* Status Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Today's Duty</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-bold text-white">Status:</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 border border-emerald-500/80 text-emerald-400 shadow-sm shadow-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  🟢 ON DUTY
                </span>
              </div>
            </div>

            {/* Tracking pill */}
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Navigation className="w-3.5 h-3.5 animate-spin" />
                <span>Location Tracking Active</span>
              </span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Start Time
              </span>
              <span className="text-xl font-bold font-mono text-white mt-1 block">
                {formatTime(activeDuty.start_time)}
              </span>
            </div>

            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                Start KM
              </span>
              <span className="text-xl font-bold font-mono text-blue-400 mt-1 block">
                {activeDuty.start_odometer_final ? `${Number(activeDuty.start_odometer_final).toLocaleString()} KM` : '---'}
              </span>
            </div>

            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                GPS Distance
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                {formatDistance(activeDuty.gps_distance_km)}
              </span>
            </div>

            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-brand-400" />
                Current Conveyance
              </span>
              <span className="text-2xl font-bold font-mono text-brand-400 mt-1 block">
                {formatCurrency(activeDuty.estimatedConveyance)}
              </span>
            </div>
          </div>

          {/* Sync & Device Telemetry Bar */}
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Last Location Sync:</span>
              <strong className="text-slate-200">{syncTimeText}</strong>
              <button
                type="button"
                onClick={triggerSync}
                className="text-emerald-400 hover:text-emerald-300 p-1"
                title="Sync now"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {wakeLockSupported && (
                <span className="flex items-center gap-1 text-[11px] text-amber-300/90">
                  <Sun className="w-3 h-3 text-amber-400" />
                  <span>{isLocked ? 'Screen Kept Active' : 'Screen Dim Mode'}</span>
                </span>
              )}
              {pendingCount > 0 ? (
                <span className="text-amber-400 font-medium">🟠 {pendingCount} waiting to sync</span>
              ) : (
                <span className="text-emerald-400 font-medium">🟢 Synced</span>
              )}
            </div>
          </div>

          {/* Privacy Notice (Specification 24) */}
          <div className="text-[11px] text-slate-400 flex items-center gap-2 px-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Location tracking is active during your duty session and will automatically stop when you end duty.
            </span>
          </div>

          {/* Large END DUTY Button (Specification 8) */}
          <button
            type="button"
            onClick={() => setViewState('end-wizard')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-lg tracking-wide hover:from-rose-500 hover:to-red-500 shadow-xl shadow-rose-950/60 active:scale-95 transition flex items-center justify-center gap-2 mt-1"
          >
            <Square className="w-5 h-5 fill-current" />
            <span>END DUTY</span>
          </button>
        </div>
      ) : (
        /* OFF DUTY STATE (Specification 2) */
        <div className="bg-slate-850 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Play className="w-10 h-10 ml-1 fill-emerald-500/30 text-emerald-400" />
          </div>

          <div className="max-w-sm">
            <h2 className="text-2xl font-bold text-white tracking-tight">Ready to Start Duty?</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Click Start Duty to take your live attendance selfie and bike odometer photo. Location tracking will only begin after you explicitly start your duty.
            </p>
          </div>

          <div className="w-full bg-slate-900/80 rounded-2xl p-4 border border-slate-800/80 text-left text-xs space-y-2">
            <div className="font-semibold text-slate-300">Duty Protocol Guidelines:</div>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Take live selfie using mobile camera</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Capture bike odometer dial (auto OCR + manual confirm)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Keep GPS enabled during travel (works offline too)</span>
            </div>
          </div>

          {/* START DUTY Button (Specification 2) */}
          <button
            type="button"
            onClick={() => setViewState('start-wizard')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-black text-xl tracking-wide hover:from-emerald-500 hover:to-green-500 shadow-2xl shadow-emerald-950/80 active:scale-95 transition flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>START DUTY</span>
          </button>
        </div>
      )}
    </div>
  );
}
