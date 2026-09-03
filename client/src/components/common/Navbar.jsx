import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDuty } from '../../context/DutyContext';
import { useOfflineQueue } from '../../context/OfflineQueueContext';
import { LogOut, Shield, User, Wifi, WifiOff, RefreshCw, Navigation } from 'lucide-react';

export function Navbar({ onNavigate, currentPage }) {
  const { user, logout, isAdmin, isSupervisor } = useAuth();
  const { isOnDuty } = useDuty();
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOfflineQueue();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate && onNavigate(isAdmin ? 'admin-dashboard' : 'supervisor-dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-900/40">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base leading-tight tracking-tight flex items-center gap-2">
              <span>GeoConvey</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                v1.0
              </span>
            </div>
            <div className="text-xs text-slate-400">Supervisor & Conveyance Tracker</div>
          </div>
        </div>

        {/* Status Indicators & User Profile */}
        <div className="flex items-center gap-3">
          {/* Duty status indicator for Supervisor */}
          {isSupervisor && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isOnDuty 
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400 shadow-sm shadow-emerald-500/20' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              <span>{isOnDuty ? 'ON DUTY' : 'OFF DUTY'}</span>
            </div>
          )}

          {/* Offline / Online Sync Indicator */}
          <div className="flex items-center gap-1">
            {isOnline ? (
              pendingCount > 0 ? (
                <button
                  onClick={triggerSync}
                  title={`${pendingCount} locations buffered locally. Click to sync now.`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/70 border border-amber-500/50 text-amber-300 hover:bg-amber-900/50 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{pendingCount} unsynced</span>
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 px-2 py-1 bg-slate-800/60 rounded-full border border-slate-700/50">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300">Online</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/80 border border-rose-500/50 text-rose-300">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline ({pendingCount})</span>
              </div>
            )}
          </div>

          {/* Download App Link */}
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('download')}
            title="Download Supervisor Android APK"
            className="flex items-center gap-1 text-xs py-1.5 px-3 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600/80 text-emerald-300 font-bold transition shadow-sm"
          >
            <span>📱 Download App</span>
          </button>

          {/* User badge */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-200 leading-tight">{user.name}</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {user.employee_id} • {user.role.toUpperCase()}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                {isAdmin ? <Shield className="w-4 h-4 text-brand-400" /> : <User className="w-4 h-4 text-emerald-400" />}
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
