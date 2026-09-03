import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { formatCurrency, formatDistance, formatDate, formatTime } from '../utils/formatters';
import { Calendar, Clock, Gauge, ChevronRight, X } from 'lucide-react';

export function SupervisorHistory({ onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.duty.getHistory();
        setSessions(res.sessions || []);
      } catch (err) {
        console.error('History load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-4 max-w-md mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xl font-bold text-white tracking-tight">Duty History</h2>
        <button
          type="button"
          onClick={onBack}
          className="text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300"
        >
          &larr; Back
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading duty history...</div>
      ) : sessions.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 rounded-3xl border border-slate-800 text-xs text-slate-400">
          No previous duties found.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedSession(s)}
              className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-between transition active:scale-[0.99] cursor-pointer shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{formatDate(s.start_time)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    s.status === 'APPROVED' ? 'bg-teal-950 text-teal-300 border border-teal-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {s.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{formatTime(s.start_time)} &rarr; {s.end_time ? formatTime(s.end_time) : 'Active'}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-white block">
                  {formatDistance(s.approved_distance_km)}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {formatCurrency(s.conveyance_amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">{formatDate(selectedSession.start_time)}</h3>
              <button onClick={() => setSelectedSession(null)} className="text-slate-400 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Start Time</span>
                <strong className="text-white">{formatTime(selectedSession.start_time)}</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">End Time</span>
                <strong className="text-white">{selectedSession.end_time ? formatTime(selectedSession.end_time) : 'Active'}</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Start KM</span>
                <strong className="text-white font-mono">{selectedSession.start_odometer_final} KM</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">End KM</span>
                <strong className="text-white font-mono">{selectedSession.end_odometer_final} KM</strong>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-500/50 flex items-center justify-between">
              <div>
                <span className="text-emerald-300 font-bold block">Approved Distance</span>
                <span className="text-[10px] text-emerald-200/80">Rate: ₹{selectedSession.conveyance_rate?.toFixed(2)}/KM</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-emerald-300 font-bold text-sm block">
                  {formatDistance(selectedSession.approved_distance_km)}
                </span>
                <span className="font-mono text-brand-400 font-bold text-base">
                  {formatCurrency(selectedSession.conveyance_amount)}
                </span>
              </div>
            </div>

            {selectedSession.distance_selection_reason && (
              <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <strong className="text-slate-300">Note: </strong>{selectedSession.distance_selection_reason}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="w-full py-3 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
