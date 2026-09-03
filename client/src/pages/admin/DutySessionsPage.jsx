import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatDistance, formatDate, formatTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/Badge';
import { SessionVerificationModal } from '../../components/verification/SessionVerificationModal';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export function DutySessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchSessions = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await api.duty.getHistory({
        status: statusFilter || undefined
      });
      setSessions(res.sessions || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions(true);

    // Auto-refresh every 8 seconds so new duty sessions appear live
    const timer = setInterval(() => {
      fetchSessions(false);
    }, 8000);

    return () => clearInterval(timer);
  }, [statusFilter]);

  const filtered = sessions.filter((s) => {
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return true;
    const name = (s.supervisor_name || '').toLowerCase();
    const empId = (s.employee_id || '').toLowerCase();
    return name.includes(term) || empId.includes(term);
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Duty Sessions & Verification</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-normal flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Auto-Sync
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review attendance selfies, bike odometer readings, GPS routes, and approve conveyance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={() => fetchSessions(true)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
            title="Refresh Now"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto bg-slate-850 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === ''
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Sessions
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('NEEDS_REVIEW')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === 'NEEDS_REVIEW'
                ? 'bg-rose-900/80 text-rose-300 border border-rose-600 shadow'
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            ⚠️ Needs Review
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING_VERIFICATION')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === 'PENDING_VERIFICATION'
                ? 'bg-amber-900/80 text-amber-300 border border-amber-600 shadow'
                : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            Pending Verification
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600 shadow'
                : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            Approved
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ON_DUTY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === 'ON_DUTY'
                ? 'bg-blue-900/80 text-blue-300 border border-blue-600 shadow'
                : 'text-slate-400 hover:text-blue-400'
            }`}
          >
            Currently On Duty
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72 flex items-center gap-2 bg-slate-850 px-3 py-2 rounded-xl border border-slate-800">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter supervisor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-850 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-900/60">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Supervisor</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4">Start KM</th>
                <th className="py-3.5 px-4">End KM</th>
                <th className="py-3.5 px-4">GPS KM</th>
                <th className="py-3.5 px-4">Odometer KM</th>
                <th className="py-3.5 px-4">Approved KM</th>
                <th className="py-3.5 px-4">Conveyance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    No duty sessions found matching the filter.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className="hover:bg-slate-800/50 transition cursor-pointer"
                  >
                    <td className="py-3 px-4 font-medium text-slate-200">{formatDate(s.start_time)}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{s.supervisor_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{s.employee_id}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {formatTime(s.start_time)} &rarr; {s.end_time ? formatTime(s.end_time) : 'Active'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {s.start_odometer_final ?? '---'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {s.end_odometer_final ?? '---'}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400">
                      {formatDistance(s.gps_distance_km)}
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-400">
                      {formatDistance(s.odometer_distance_km)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {formatDistance(s.approved_distance_km)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-brand-300">
                      {formatCurrency(s.conveyance_amount)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSessionId(s.id);
                        }}
                        className="py-1 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
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
          onActionComplete={fetchSessions}
        />
      )}
    </div>
  );
}
