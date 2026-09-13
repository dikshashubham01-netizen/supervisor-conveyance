import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDuty } from '../context/DutyContext';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { StartDutyWizard } from './StartDutyWizard';
import { EndDutyWizard } from './EndDutyWizard';
import { SupervisorHistory } from './SupervisorHistory';
import { ProfileModal } from '../components/profile/ProfileModal';
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
  User,
  LogOut,
  AlertCircle,
  Wifi,
  WifiOff,
  Sparkles,
  Download
} from 'lucide-react';
import { UpdateModal } from '../components/common/UpdateModal';

import { checkDeveloperOptions, stopBackgroundTracking } from '../utils/backgroundTracking';
import SecurityScreen from '../components/common/SecurityScreen';
import { api, getServerUrl, getToken } from '../api/client';
import { getInstalledAppInfo, isNewerVersion, FALLBACK_APP_VERSION, FALLBACK_VERSION_CODE } from '../utils/versionCheck';

export function SupervisorDashboard() {
  const { user, logout } = useAuth();
  const { activeDuty, isOnDuty, refreshDuty, lastSyncTime } = useDuty();
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOfflineQueue();

  const [viewState, setViewState] = useState('dashboard'); // 'dashboard' | 'start' | 'end' | 'history'
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [installedAppInfo, setInstalledAppInfo] = useState({
    version: FALLBACK_APP_VERSION,
    versionCode: FALLBACK_VERSION_CODE
  });
  const [remoteVersionInfo, setRemoteVersionInfo] = useState(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDevBlocked, setIsDevBlocked] = useState(false);

  // Check Developer Options on mount and periodically
  const checkDevMode = useCallback(async () => {
    try {
      const enabled = await checkDeveloperOptions();
      if (enabled) {
        setIsDevBlocked(true);
        if (isOnDuty) {
          stopBackgroundTracking();
          try {
            fetch(`${getServerUrl()}/api/tracking/security-event`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
              },
              body: JSON.stringify({
                duty_session_id: activeDuty?.id,
                event_type: 'DEVELOPER_OPTIONS_ENABLED',
                details: { reason: 'Developer options enabled during active duty' }
              })
            }).catch(() => {});
          } catch (e) {}
        }
      } else {
        setIsDevBlocked(false);
      }
    } catch (e) {
      console.warn('Dev mode check warning:', e);
    }
  }, [isOnDuty, activeDuty?.id]);

  useEffect(() => {
    checkDevMode();
    const timer = setInterval(checkDevMode, 4000);
    return () => clearInterval(timer);
  }, [checkDevMode]);

  // Check for app updates using dynamic native version and semver comparison
  useEffect(() => {
    async function checkForUpdates() {
      try {
        const installed = await getInstalledAppInfo();
        setInstalledAppInfo(installed);

        const remote = await api.version.check();
        if (remote) {
          setRemoteVersionInfo(remote);
          const needsUpdate = isNewerVersion(
            remote.version,
            installed.version,
            remote.versionCode,
            installed.versionCode
          );
          setHasUpdate(needsUpdate);
        }
      } catch (e) {
        console.warn('Update check failed:', e);
      }
    }
    checkForUpdates();
  }, []);

  // High-accuracy background GPS tracking
  const { currentPosition, accuracyRating, error: gpsError } = useGeolocation(isOnDuty, activeDuty?.id);

  // Auto-refresh stats from server periodically while on duty
  useEffect(() => {
    if (!isOnDuty) return;
    const interval = setInterval(refreshDuty, 12000);
    return () => clearInterval(interval);
  }, [isOnDuty, refreshDuty]);

  if (isDevBlocked) {
    return <SecurityScreen onRecheck={checkDevMode} violationType="DEVELOPER_OPTIONS" />;
  }

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
            onClick={() => setIsProfileOpen(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-brand-400 hover:text-white"
            title="My Profile"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (isOnDuty) {
                const confirmed = window.confirm(
                  'You have an active duty session in progress! Are you sure you want to log out? Your session remains active on the server.'
                );
                if (!confirmed) return;
              }
              logout();
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* In-App Update Available Banner */}
      {hasUpdate && (
        <div
          onClick={() => setIsUpdateModalOpen(true)}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-between cursor-pointer shadow-xl shadow-emerald-950/70 active:scale-98 transition animate-pulse border border-emerald-400/40"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚀</span>
            <div>
              <strong className="block font-bold text-xs text-white">New App Update ({remoteVersionInfo?.version || 'v1.0.3'})</strong>
              <span className="text-[10px] text-emerald-100">Tap here to install background GPS tracking update</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-white text-emerald-800 text-[11px] font-black shadow">
            UPDATE
          </span>
        </div>
      )}

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

        <div className="flex items-center gap-2">
          {/* Live GPS Quality Pill */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
            accuracyRating?.rating === 'GOOD'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
              : accuracyRating?.rating === 'FAIR'
              ? 'bg-amber-950/90 text-amber-300 border-amber-500/40'
              : accuracyRating?.rating === 'POOR'
              ? 'bg-rose-950/90 text-rose-300 border-rose-500/40'
              : 'bg-slate-950 text-slate-400 border-slate-800'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              accuracyRating?.rating === 'GOOD'
                ? 'bg-emerald-400 animate-pulse'
                : accuracyRating?.rating === 'FAIR'
                ? 'bg-amber-400'
                : accuracyRating?.rating === 'POOR'
                ? 'bg-rose-400'
                : 'bg-slate-500'
            }`} />
            <span>GPS: {accuracyRating?.rating || 'NO FIX'}</span>
          </span>

          <button
            type="button"
            onClick={triggerSync}
            className="text-slate-400 hover:text-white p-1"
            title="Sync Now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
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

            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                accuracyRating?.rating === 'GOOD'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : accuracyRating?.rating === 'FAIR'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                <Navigation className="w-3 h-3" />
                <span>{accuracyRating?.label || 'GPS Active'}</span>
              </span>
            </div>
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
      <div className="grid grid-cols-3 gap-2 pt-2">
        <button
          type="button"
          onClick={() => setViewState('history')}
          className="py-3 px-2 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs flex flex-col items-center justify-center gap-1 shadow"
        >
          <History className="w-4 h-4 text-brand-400" />
          <span>History</span>
        </button>

        <button
          type="button"
          onClick={() => setIsUpdateModalOpen(true)}
          className={`py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 shadow transition ${
            hasUpdate
              ? 'bg-emerald-950 border-emerald-500 text-emerald-300 animate-pulse'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Update App</span>
        </button>

        <button
          type="button"
          onClick={() => setIsProfileOpen(true)}
          className="py-3 px-2 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs flex flex-col items-center justify-center gap-1 shadow"
        >
          <User className="w-4 h-4 text-brand-400" />
          <span>Profile</span>
        </button>
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentVersion={installedAppInfo.version}
        currentVersionCode={installedAppInfo.versionCode}
        remoteInfo={remoteVersionInfo}
      />
    </div>
  );
}
