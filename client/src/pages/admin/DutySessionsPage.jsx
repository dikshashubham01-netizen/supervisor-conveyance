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
  ChevronRight,
  Trash2,
  PowerOff,
  X,
  Zap,
  Check
} from 'lucide-react';

export function DutySessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_LIMIT = 100;
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Admin End Duty Dialog State
  const [adminEndSession, setAdminEndSession] = useState(null);
  const [adminEndMeters, setAdminEndMeters] = useState('0');
  const [adminEndKm, setAdminEndKm] = useState('');
  const [adminEndNotes, setAdminEndNotes] = useState('');
  const [adminEndSubmitting, setAdminEndSubmitting] = useState(false);

  const fetchSessions = async (showSpinner = true, page = currentPage) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await api.duty.getHistory({
        status: statusFilter || undefined,
        page,
        limit: PAGE_LIMIT
      });
      setSessions(res.sessions || []);
      setTotal(res.total || 0);
      setCurrentPage(page);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleDeleteSession = async (e, session) => {
    e.stopPropagation();
    const conf = window.confirm(
      `Are you sure you want to permanently delete this rejected session #${session.id.slice(0, 8)} for ${session.supervisor_name || 'Supervisor'}?\n\nThis will remove the session, all GPS location points, and telemetry permanently.`
    );
    if (!conf) return;

    try {
      await api.duty.delete(session.id);
      fetchSessions(false);
    } catch (err) {
      alert('Failed to delete rejected session: ' + err.message);
    }
  };

  const openAdminEndModal = (e, session) => {
    e.stopPropagation();
    setAdminEndSession(session);
    setAdminEndMeters(session.meters_installed != null ? String(session.meters_installed) : '0');
    const estEndKm = session.start_odometer_final != null && session.gps_distance_km != null
      ? (Number(session.start_odometer_final) + Number(session.gps_distance_km)).toFixed(1)
      : (session.start_odometer_final ? String(session.start_odometer_final) : '');
    setAdminEndKm(String(estEndKm));
    setAdminEndNotes('Ended by Admin with verified meter count');
  };

  const handleAdminEndSubmit = async (e) => {
    e.preventDefault();
    if (!adminEndSession) return;

    const count = parseInt(adminEndMeters, 10);
    if (isNaN(count) || count < 0) {
      alert('Today installed meter count is mandatory (must be >= 0).');
      return;
    }

    try {
      setAdminEndSubmitting(true);
      await api.duty.adminEnd(adminEndSession.id, {
        metersInstalled: count,
        endKm: adminEndKm ? parseFloat(adminEndKm) : undefined,
        notes: adminEndNotes || 'Ended by Admin with meter count'
      });
      setAdminEndSession(null);
      fetchSessions(false);
    } catch (err) {
      alert('Failed to end duty: ' + err.message);
    } finally {
      setAdminEndSubmitting(false);
    }
  };

  useEffect(() => {
    // Reset to page 1 when status filter changes
    fetchSessions(true, 1);

    // Auto-refresh every 8 seconds so new duty sessions appear live
    const timer = setInterval(() => {
      fetchSessions(false, currentPage);
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
            {total > 0 && (
              <span className="ml-2 text-white font-semibold">
                — {total} total session{total !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={() => fetchSessions(true, currentPage)}
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
          <button
            type="button"
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-900/80 text-rose-300 border border-rose-600 shadow'
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            ❌ Rejected
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
                <th className="py-3.5 px-4">Meters</th>
                <th className="py-3.5 px-4">Conveyance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-500">
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
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {s.meters_installed ?? 0}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-brand-300">
                      {formatCurrency(s.conveyance_amount)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={s.status} />
                        {(() => {
                          try {
                            const warnings = s.warnings ? (typeof s.warnings === 'string' ? JSON.parse(s.warnings) : s.warnings) : [];
                            if (warnings.length > 0) {
                              return (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded">
                                  ⚠️ {warnings.length} {warnings.length === 1 ? 'flag' : 'flags'}
                                </span>
                              );
                            }
                          } catch (e) {}
                          return null;
                        })()}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {s.status === 'ON_DUTY' && (
                          <button
                            type="button"
                            onClick={(e) => openAdminEndModal(e, s)}
                            className="py-1 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center gap-1 shadow transition"
                            title="Admin End Duty & Enter Meter Count"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                            <span>End Duty</span>
                          </button>
                        )}
                        {s.status === 'REJECTED' && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, s)}
                            className="py-1 px-2.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-rose-300 font-medium text-xs flex items-center gap-1 transition"
                            title="Delete Rejected Session"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Delete</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedSessionId(s.id)}
                          className="py-1 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > PAGE_LIMIT && (
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-slate-400 font-mono">
            Showing {(currentPage - 1) * PAGE_LIMIT + 1}–{Math.min(currentPage * PAGE_LIMIT, total)} of <span className="text-white font-bold">{total}</span> sessions
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => fetchSessions(true, currentPage - 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Previous
            </button>
            {Array.from({ length: Math.ceil(total / PAGE_LIMIT) }, (_, i) => i + 1).map(pg => (
              <button
                key={pg}
                type="button"
                onClick={() => fetchSessions(true, pg)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  pg === currentPage
                    ? 'bg-brand-600 text-white border border-brand-500 shadow'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {pg}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage >= Math.ceil(total / PAGE_LIMIT)}
              onClick={() => fetchSessions(true, currentPage + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Admin End Duty Modal with Meter Count */}
      {adminEndSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <PowerOff className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Admin End Duty</h3>
                  <p className="text-[11px] text-slate-400">
                    {adminEndSession.supervisor_name} ({adminEndSession.employee_id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminEndSession(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminEndSubmit} className="flex flex-col gap-4">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Start Time</span>
                  <span className="text-white font-mono font-medium">{formatTime(adminEndSession.start_time)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Start KM</span>
                  <span className="text-white font-mono font-bold">{adminEndSession.start_odometer_final ?? '---'} KM</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">GPS Tracked</span>
                  <span className="text-emerald-400 font-mono font-bold">{formatDistance(adminEndSession.gps_distance_km)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Current Status</span>
                  <span className="text-amber-400 font-bold">ON DUTY</span>
                </div>
              </div>

              {/* Meter Count Input (Mandatory) */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/30 flex flex-col gap-2">
                <label className="text-xs font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <Zap className="w-4 h-4 text-cyan-400" /> Today Installed Meter Count
                  </span>
                  <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                    * Mandatory
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  autoFocus
                  placeholder="Enter installed meters count (e.g. 15)"
                  value={adminEndMeters}
                  onChange={(e) => setAdminEndMeters(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xl font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-400">
                  This count will appear in the Monthly Meter Count matrix and daily reports.
                </p>
              </div>

              {/* End KM (Optional/Editable) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Final End Odometer KM (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Estimated from GPS if blank"
                  value={adminEndKm}
                  onChange={(e) => setAdminEndKm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Remarks */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Admin Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="Reason for ending duty..."
                  value={adminEndNotes}
                  onChange={(e) => setAdminEndNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminEndSession(null)}
                  className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminEndSubmitting || adminEndMeters === ''}
                  className="py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{adminEndSubmitting ? 'Ending Duty...' : 'Confirm & End Duty'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
