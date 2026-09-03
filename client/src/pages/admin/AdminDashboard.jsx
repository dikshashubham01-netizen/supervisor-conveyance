import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatDistance, formatTime, formatDate } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/Badge';
import { SessionVerificationModal } from '../../components/verification/SessionVerificationModal';
import {
  Users,
  Navigation,
  IndianRupee,
  AlertTriangle,
  MapPin,
  FileSpreadsheet,
  Settings,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export function AdminDashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    activeSupervisorsCount: 0,
    totalKmToday: 0,
    totalConveyanceToday: 0,
    trackingIssuesCount: 0
  });
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const [liveRes, reportsRes, historyRes] = await Promise.all([
        api.tracking.getLive(),
        api.reports.get({ startDate: today, endDate: today }),
        api.duty.getHistory({ limit: 8 })
      ]);

      const activeSupervisors = liveRes.supervisors || [];
      const trackingIssues = activeSupervisors.filter((s) => s.isStale).length;

      setStats({
        activeSupervisorsCount: activeSupervisors.length,
        totalKmToday: reportsRes.totals?.totalApprovedKm || 0,
        totalConveyanceToday: reportsRes.totals?.totalConveyance || 0,
        trackingIssuesCount: trackingIssues
      });

      setRecentSessions(historyRes.sessions || []);
    } catch (err) {
      console.error('Failed to load admin dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Operations Console</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time Supervisor Location Monitoring & Bike Conveyance Management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchDashboardData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('live-map')}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950 transition"
          >
            <MapPin className="w-4 h-4" />
            <span>Open Live Map</span>
          </button>
        </div>
      </div>

      {/* 4 CORE DASHBOARD CARDS (Specification 9) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Active Supervisors */}
        <div
          onClick={() => onNavigate('live-map')}
          className="bg-slate-850 hover:bg-slate-800/80 p-5 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Supervisors</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">
            {stats.activeSupervisorsCount}
          </div>
          <div className="text-xs text-emerald-400/90 mt-2 flex items-center gap-1 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Currently on duty in field</span>
          </div>
        </div>

        {/* 2. Total KM Today */}
        <div
          onClick={() => onNavigate('reports')}
          className="bg-slate-850 hover:bg-slate-800/80 p-5 rounded-2xl border border-slate-800 hover:border-blue-500/40 transition cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total KM Today</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">
            {formatDistance(stats.totalKmToday)}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Approved travel distance today
          </div>
        </div>

        {/* 3. Total Conveyance Today */}
        <div
          onClick={() => onNavigate('reports')}
          className="bg-slate-850 hover:bg-slate-800/80 p-5 rounded-2xl border border-slate-800 hover:border-brand-500/40 transition cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Conveyance Today</span>
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-brand-400 tracking-tight">
            {formatCurrency(stats.totalConveyanceToday)}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Calculated bike conveyance
          </div>
        </div>

        {/* 4. Tracking Issues */}
        <div
          onClick={() => onNavigate('live-map')}
          className={`p-5 rounded-2xl border transition cursor-pointer shadow-sm group ${
            stats.trackingIssuesCount > 0
              ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
              : 'bg-slate-850 hover:bg-slate-800/80 border-slate-800 text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Tracking Issues</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              stats.trackingIssuesCount > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-3xl font-black font-mono tracking-tight ${
            stats.trackingIssuesCount > 0 ? 'text-amber-400' : 'text-slate-300'
          }`}>
            {stats.trackingIssuesCount}
          </div>
          <div className="text-xs mt-2 text-slate-400">
            {stats.trackingIssuesCount > 0 ? 'Supervisors with stale/delayed GPS' : 'All active pings normal'}
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('live-map')}
          className="p-4 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-left transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-sm text-slate-200">Live Map</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('duty-sessions')}
          className="p-4 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-left transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-sm text-slate-200">Verify Sessions</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('reports')}
          className="p-4 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-left transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-brand-400" />
            <span className="font-semibold text-sm text-slate-200">Daily Reports</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="p-4 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-left transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-sm text-slate-200">Rate Settings</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Recent Duty Sessions Table */}
      <div className="bg-slate-850 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Recent Duty Sessions</h3>
            <p className="text-xs text-slate-400">Review supervisor attendance, odometer readings, and conveyance</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('duty-sessions')}
            className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
          >
            <span>View All Sessions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Supervisor</th>
                <th className="py-3 px-3">Start Time</th>
                <th className="py-3 px-3">End Time</th>
                <th className="py-3 px-3">GPS KM</th>
                <th className="py-3 px-3">Odometer KM</th>
                <th className="py-3 px-3">Approved KM</th>
                <th className="py-3 px-3">Conveyance</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentSessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/50 transition">
                  <td className="py-3 px-3 font-medium text-slate-200">{formatDate(s.start_time)}</td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-white">{s.supervisor_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{s.employee_id}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-mono">{formatTime(s.start_time)}</td>
                  <td className="py-3 px-3 text-slate-300 font-mono">{s.end_time ? formatTime(s.end_time) : 'Active'}</td>
                  <td className="py-3 px-3 font-mono text-emerald-400">{formatDistance(s.gps_distance_km)}</td>
                  <td className="py-3 px-3 font-mono text-blue-400">{formatDistance(s.odometer_distance_km)}</td>
                  <td className="py-3 px-3 font-mono font-bold text-white">{formatDistance(s.approved_distance_km)}</td>
                  <td className="py-3 px-3 font-mono font-bold text-brand-300">{formatCurrency(s.conveyance_amount)}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedSessionId(s.id)}
                      className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Modal */}
      {selectedSessionId && (
        <SessionVerificationModal
          isOpen={!!selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          sessionId={selectedSessionId}
          onActionComplete={fetchDashboardData}
        />
      )}
    </div>
  );
}
