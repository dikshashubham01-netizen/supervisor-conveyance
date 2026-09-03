import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/Badge';
import { RoutePlaybackMap } from '../map/RoutePlaybackMap';
import { api, getUploadUrl } from '../../api/client';
import { formatCurrency, formatDistance, formatDateTime, formatTime } from '../../utils/formatters';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileEdit,
  Navigation,
  Camera,
  Gauge,
  History,
  Info,
  ShieldAlert
} from 'lucide-react';

export function SessionVerificationModal({ isOpen, onClose, sessionId, onActionComplete }) {
  const [details, setDetails] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Override / Action state
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideKm, setOverrideKm] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !sessionId) {
      setDetails(null);
      setRoutePoints([]);
      setIsOverriding(false);
      return;
    }

    async function loadData() {
      setLoading(true);
      try {
        const [detailRes, routeRes] = await Promise.all([
          api.duty.getDetails(sessionId),
          api.tracking.getRoute(sessionId)
        ]);
        setDetails(detailRes);
        setRoutePoints(routeRes.points || []);
        if (detailRes.session) {
          setOverrideKm(detailRes.session.approved_distance_km ?? '');
        }
      } catch (err) {
        console.error('Failed to load session details:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isOpen, sessionId]);

  const handleAction = async (action) => {
    if (action === 'OVERRIDE_KM') {
      if (!overrideKm || isNaN(parseFloat(overrideKm)) || parseFloat(overrideKm) < 0) {
        alert('Please enter a valid non-negative approved distance KM.');
        return;
      }
      if (!overrideReason || !overrideReason.trim()) {
        alert('A mandatory reason is required when manually overriding approved KM.');
        return;
      }
    }

    try {
      setSubmitting(true);
      await api.duty.verify(sessionId, {
        action,
        approvedDistanceKm: action === 'OVERRIDE_KM' ? parseFloat(overrideKm) : undefined,
        reason: overrideReason,
        reviewNotes
      });

      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err) {
      alert('Verification action failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const session = details?.session;
  const auditLogs = details?.auditLogs || [];
  const warnings = session?.warnings ? (typeof session.warnings === 'string' ? JSON.parse(session.warnings) : session.warnings) : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Duty Session Verification & Audit" maxWidth="max-w-4xl">
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading session telemetry...</span>
        </div>
      ) : !session ? (
        <div className="p-6 text-center text-slate-400">Session data could not be found.</div>
      ) : (
        <div className="flex flex-col gap-6 text-slate-200">
          {/* Header Summary Strip */}
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-white">{session.supervisor_name}</h4>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                  {session.employee_id}
                </span>
                <StatusBadge status={session.status} />
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Started: {formatDateTime(session.start_time)} • Ended: {session.end_time ? formatDateTime(session.end_time) : 'In Progress'}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Approved KM</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {formatDistance(session.approved_distance_km)}
                </span>
              </div>
              <div className="text-right pl-4 border-l border-slate-700">
                <span className="text-xs text-slate-400 block">Conveyance ({session.conveyance_rate ? `₹${session.conveyance_rate}/KM` : '₹4.50/KM'})</span>
                <span className="text-xl font-bold font-mono text-brand-400">
                  {formatCurrency(session.conveyance_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Automatic Warnings Alert Banner */}
          {warnings.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-500/70 text-amber-200 flex flex-col gap-2 shadow-lg">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>⚠️ AUTOMATIC WARNINGS DETECTED — ADMIN REVIEW REQUIRED</span>
              </div>
              <ul className="list-disc list-inside text-xs space-y-1 text-amber-200/90 pl-1">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SECTION 1: Attendance Selfies */}
          <div className="flex flex-col gap-3">
            <h5 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-400" />
              1. Live Attendance Verification
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Selfie */}
              <div className="bg-slate-850 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>Start Duty Selfie</span>
                  <span className="text-emerald-400 font-mono">{formatTime(session.start_time)}</span>
                </div>
                <div className="aspect-[4/3] bg-black rounded-lg overflow-hidden border border-slate-800">
                  {session.start_selfie ? (
                    <img
                      src={getUploadUrl(session.start_selfie)}
                      alt="Start Selfie"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">No photo</div>
                  )}
                </div>
                {session.start_latitude && (
                  <div className="text-[11px] text-slate-400 font-mono">
                    GPS: {session.start_latitude.toFixed(4)}, {session.start_longitude.toFixed(4)}
                  </div>
                )}
              </div>

              {/* End Selfie */}
              <div className="bg-slate-850 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>End Duty Selfie</span>
                  <span className="text-amber-400 font-mono">{session.end_time ? formatTime(session.end_time) : 'Pending'}</span>
                </div>
                <div className="aspect-[4/3] bg-black rounded-lg overflow-hidden border border-slate-800">
                  {session.end_selfie ? (
                    <img
                      src={getUploadUrl(session.end_selfie)}
                      alt="End Selfie"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                      {session.status === 'ON_DUTY' ? 'Duty still in progress' : 'No photo'}
                    </div>
                  )}
                </div>
                {session.end_latitude && (
                  <div className="text-[11px] text-slate-400 font-mono">
                    GPS: {session.end_latitude.toFixed(4)}, {session.end_longitude.toFixed(4)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: Bike Odometer Readings */}
          <div className="flex flex-col gap-3">
            <h5 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-brand-400" />
              2. Bike Odometer Verification
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Odometer */}
              <div className="bg-slate-850 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>Start Odometer Photo</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    Confirmed: {session.start_odometer_final ?? '---'} KM
                  </span>
                </div>
                <div className="aspect-[16/9] bg-black rounded-lg overflow-hidden border border-slate-800">
                  {session.start_odometer_image ? (
                    <img
                      src={getUploadUrl(session.start_odometer_image)}
                      alt="Start Odometer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">No image</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                  <div>OCR Detected: <strong className="text-slate-200 font-mono">{session.start_odometer_ocr ?? 'N/A'}</strong></div>
                  <div>Manual Entry: <strong className="text-slate-200 font-mono">{session.start_odometer_manual ?? 'N/A'}</strong></div>
                </div>
              </div>

              {/* End Odometer */}
              <div className="bg-slate-850 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>End Odometer Photo</span>
                  <span className="text-amber-400 font-bold font-mono">
                    Confirmed: {session.end_odometer_final ?? '---'} KM
                  </span>
                </div>
                <div className="aspect-[16/9] bg-black rounded-lg overflow-hidden border border-slate-800">
                  {session.end_odometer_image ? (
                    <img
                      src={getUploadUrl(session.end_odometer_image)}
                      alt="End Odometer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                      {session.status === 'ON_DUTY' ? 'Duty still in progress' : 'No image'}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                  <div>OCR Detected: <strong className="text-slate-200 font-mono">{session.end_odometer_ocr ?? 'N/A'}</strong></div>
                  <div>Manual Entry: <strong className="text-slate-200 font-mono">{session.end_odometer_manual ?? 'N/A'}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: GPS Route Map */}
          <div className="flex flex-col gap-3">
            <h5 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-emerald-400" />
              3. GPS Route & Distance Verification
            </h5>
            <RoutePlaybackMap points={routePoints} session={session} />
          </div>

          {/* SECTION 4: Distance & Conveyance Calculation Breakdown */}
          <div className="bg-slate-850 rounded-2xl p-5 border border-slate-800 flex flex-col gap-4">
            <h5 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-brand-400" />
              4. Calculation Breakdown
            </h5>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">GPS Distance</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {formatDistance(session.gps_distance_km)}
                </span>
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Odometer Distance</span>
                <span className="text-lg font-bold font-mono text-blue-400">
                  {formatDistance(session.odometer_distance_km)}
                </span>
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Approved Distance</span>
                <span className="text-lg font-bold font-mono text-white">
                  {formatDistance(session.approved_distance_km)}
                </span>
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Total Conveyance</span>
                <span className="text-lg font-bold font-mono text-emerald-300">
                  {formatCurrency(session.conveyance_amount)}
                </span>
              </div>
            </div>

            {/* Selection Reason */}
            {session.distance_selection_reason && (
              <div className="text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-slate-300">
                <strong className="text-brand-400">Selection Policy: </strong>
                {session.distance_selection_reason}
              </div>
            )}
          </div>

          {/* SECTION 5: Audit Log Trail */}
          {auditLogs.length > 0 && (
            <div className="flex flex-col gap-2">
              <h5 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-purple-400" />
                5. Audit Trail
              </h5>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-850 rounded-xl border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="font-bold text-slate-200">{log.action}</span>
                      <span>{formatDateTime(log.created_at)}</span>
                    </div>
                    <div className="text-slate-300">
                      by <strong className="text-white">{log.user_name}</strong> ({log.user_role}): {log.reason}
                    </div>
                    {log.new_value && (
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        {log.old_value && <span>{log.old_value} &rarr; </span>}
                        <span className="text-emerald-400">{log.new_value}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 6: Admin Actions */}
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-4">
            {isOverriding ? (
              <div className="p-4 rounded-xl bg-slate-800/90 border border-brand-500/50 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brand-300 flex items-center gap-1.5">
                    <FileEdit className="w-4 h-4" />
                    Manual Distance Override (Audit Logged)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOverriding(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Approved Distance (KM) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={overrideKm}
                      onChange={(e) => setOverrideKm(e.target.value)}
                      placeholder="e.g. 32.50"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Mandatory Reason for Override *</label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g. GPS tunnel drop confirmed by supervisor"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAction('OVERRIDE_KM')}
                  disabled={submitting || !overrideKm || !overrideReason}
                  className="mt-2 py-2.5 px-4 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 transition disabled:opacity-40"
                >
                  Save Override & Approve
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsOverriding(true)}
                  className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm font-medium transition"
                >
                  <FileEdit className="w-4 h-4 text-brand-400" />
                  <span>Manual Override KM</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction('REQUEST_REVIEW')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-amber-500/50 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 text-sm font-medium transition"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Request Review</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('REJECT')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-rose-500/50 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 text-sm font-medium transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('APPROVE')}
                    disabled={submitting}
                    className="flex items-center gap-1.5 py-2.5 px-5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-semibold shadow-lg shadow-emerald-950 text-sm transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Conveyance</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
