import React, { useState, useEffect } from 'react';
import { LiveTrackingMap } from '../../components/map/LiveTrackingMap';
import { SessionVerificationModal } from '../../components/verification/SessionVerificationModal';
import { api } from '../../api/client';
import { formatCurrency, formatDistance, formatTime } from '../../utils/formatters';
import { Users, Navigation, Clock, Shield, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';

export function LiveMapPage() {
  const [activeSupervisors, setActiveSupervisors] = useState([]);
  const [selectedSupId, setSelectedSupId] = useState(null);
  const [inspectSessionId, setInspectSessionId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLiveSupervisors = async () => {
    try {
      setLoading(true);
      const res = await api.tracking.getLive();
      setActiveSupervisors(res.supervisors || []);
    } catch (err) {
      console.error('Failed to load active supervisors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveSupervisors();
    const interval = setInterval(fetchLiveSupervisors, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-slate-950">
      {/* Left Sidebar: Active Supervisors Roster */}
      <div className="w-full md:w-80 lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-1/3 md:h-full z-10 shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-white text-base">Active Supervisors</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 font-mono">
              {activeSupervisors.length}
            </span>
          </div>

          <button
            type="button"
            onClick={fetchLiveSupervisors}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {activeSupervisors.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 text-slate-600" />
              <span>No supervisors are currently on duty.</span>
            </div>
          ) : (
            activeSupervisors.map((sup) => {
              const isSelected = selectedSupId === sup.supervisor_id;
              return (
                <div
                  key={sup.supervisor_id}
                  onClick={() => setSelectedSupId(sup.supervisor_id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-slate-800 border-emerald-500 shadow-md shadow-emerald-950/40'
                      : 'bg-slate-850 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{sup.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{sup.employee_id}</div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        sup.isStale
                          ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                          : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                      }`}
                    >
                      {sup.isStale ? '⚠️ STALE GPS' : '🟢 TRACKING'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Map Main Canvas */}
      <div className="flex-1 h-2/3 md:h-full p-2 md:p-4">
        <LiveTrackingMap
          selectedSupervisorId={selectedSupId}
          onSelectSupervisor={(sup) => setSelectedSupId(sup.supervisor_id)}
        />
      </div>

      {/* Inspection Modal */}
      {inspectSessionId && (
        <SessionVerificationModal
          isOpen={!!inspectSessionId}
          onClose={() => setInspectSessionId(null)}
          sessionId={inspectSessionId}
          onActionComplete={fetchLiveSupervisors}
        />
      )}
    </div>
  );
}
