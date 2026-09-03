import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatDistance, formatDate, formatTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/Badge';
import { SessionVerificationModal } from '../../components/verification/SessionVerificationModal';
import { Calendar, Clock, Gauge, IndianRupee, ChevronRight } from 'lucide-react';

export function SupervisorHistory() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await api.duty.getHistory();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading your duty records...</div>
      ) : sessions.length === 0 ? (
        <div className="p-8 text-center bg-slate-850 rounded-2xl border border-slate-800 text-sm text-slate-400">
          No previous duty sessions found.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setSelectedSessionId(session.id)}
              className="bg-slate-850 hover:bg-slate-800/90 rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <Calendar className="w-4 h-4 text-brand-400 mb-0.5" />
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDate(session.start_time).split(' ')[0]}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">
                      {formatDate(session.start_time)}
                    </span>
                    <StatusBadge status={session.status} />
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatTime(session.start_time)} - {session.end_time ? formatTime(session.end_time) : 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                <div className="text-left sm:text-right">
                  <span className="text-[11px] text-slate-400 block">Approved KM</span>
                  <span className="font-bold text-white text-sm font-mono">
                    {formatDistance(session.approved_distance_km)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Conveyance</span>
                  <span className="font-bold text-emerald-400 text-sm font-mono">
                    {formatCurrency(session.conveyance_amount)}
                  </span>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-500 hidden sm:block" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSessionId && (
        <SessionVerificationModal
          isOpen={!!selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          sessionId={selectedSessionId}
          onActionComplete={fetchHistory}
        />
      )}
    </div>
  );
}
