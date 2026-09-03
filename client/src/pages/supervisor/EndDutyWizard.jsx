import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { LiveCameraModal } from '../../components/camera/LiveCameraModal';
import { OdometerScannerModal } from '../../components/camera/OdometerScannerModal';
import { useGeolocation } from '../../hooks/useGeolocation';
import { api } from '../../api/client';
import { formatCurrency, formatDistance, formatTime } from '../../utils/formatters';
import {
  Camera,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw
} from 'lucide-react';

export function EndDutyWizard({ activeDuty, onDutyEnded, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1); // 1: Confirmation, 2: Selfie, 3: Odometer, 4: Summary
  const [isSelfieModalOpen, setIsSelfieModalOpen] = useState(false);
  const [isOdometerModalOpen, setIsOdometerModalOpen] = useState(false);

  const [selfieData, setSelfieData] = useState(null);
  const [odometerData, setOdometerData] = useState(null);
  const [completedSummary, setCompletedSummary] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { getCurrentPositionAsync } = useGeolocation(false);

  const handleSelfieCaptured = (data) => {
    setSelfieData(data);
    setCurrentStep(3);
  };

  const handleOdometerConfirmed = (data) => {
    setOdometerData(data);
    // Proceed to submission
    submitEndDuty(data);
  };

  const submitEndDuty = async (odoData) => {
    if (!selfieData || !odoData) {
      setError('Please capture both live end selfie and end odometer photo.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const pos = await getCurrentPositionAsync();

      const formData = new FormData();
      formData.append('selfie', selfieData.file);
      formData.append('odometer', odoData.image.file);
      formData.append('latitude', pos.latitude);
      formData.append('longitude', pos.longitude);
      formData.append('accuracy', pos.accuracy || 10);
      formData.append('odometerOcr', odoData.detectedKm ?? '');
      formData.append('odometerManual', odoData.manualKm ?? '');
      formData.append('odometerFinal', odoData.finalKm);

      const res = await api.duty.end(formData);
      setCompletedSummary(res.summary);
      setCurrentStep(4);

      // Celebration effect
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    } catch (err) {
      console.error('Failed to end duty:', err);
      setError(err.message || 'Failed to end duty session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      {/* Step 1: Confirmation */}
      {currentStep === 1 && (
        <div className="bg-slate-850 rounded-2xl p-6 border border-slate-800 flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">End Today's Duty Session?</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Ending duty will finalize your GPS route and calculate your bike conveyance. You will need to take an End Selfie and End Bike Odometer photo.
            </p>
          </div>

          <div className="w-full bg-slate-900 rounded-xl p-4 border border-slate-800 grid grid-cols-2 gap-3 text-left">
            <div>
              <span className="text-xs text-slate-400 block">Duty Start</span>
              <strong className="text-white text-sm">{formatTime(activeDuty?.start_time)}</strong>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Start KM</span>
              <strong className="text-white text-sm font-mono">{activeDuty?.start_odometer_final} KM</strong>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Current GPS Track</span>
              <strong className="text-emerald-400 text-sm font-mono">{formatDistance(activeDuty?.gps_distance_km)}</strong>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Est. Conveyance</span>
              <strong className="text-brand-400 text-sm font-mono">{formatCurrency(activeDuty?.estimatedConveyance)}</strong>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold"
            >
              Continue Duty
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="py-3 px-4 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 shadow-lg shadow-amber-950 flex items-center justify-center gap-2"
            >
              <span>Yes, End Duty</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: End Selfie */}
      {currentStep === 2 && (
        <div className="bg-slate-850 rounded-2xl p-6 border border-slate-800 flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Camera className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">End Attendance — Live Selfie</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Please capture your end-of-day live selfie to complete duty attendance.
            </p>
          </div>

          {selfieData ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg">
                <img src={selfieData.dataUrl} alt="End Selfie" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> End Selfie Captured ✓
              </span>
              <button
                type="button"
                onClick={() => setIsSelfieModalOpen(true)}
                className="text-xs text-slate-400 underline hover:text-white"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="py-3 px-6 rounded-xl bg-emerald-600 text-white font-semibold flex items-center gap-2"
              >
                <span>Continue to End Odometer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSelfieModalOpen(true)}
              className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950"
            >
              <Camera className="w-5 h-5" />
              <span>Take Live End Selfie</span>
            </button>
          )}

          <button type="button" onClick={() => setCurrentStep(1)} className="text-xs text-slate-500 hover:text-slate-300">
            Cancel
          </button>
        </div>
      )}

      {/* Step 3: End Odometer */}
      {currentStep === 3 && (
        <div className="bg-slate-850 rounded-2xl p-6 border border-slate-800 flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Gauge className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">End Bike Odometer Photo</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Capture your bike's final odometer dial. Start KM was: <strong className="text-white font-mono">{activeDuty?.start_odometer_final} KM</strong>
            </p>
          </div>

          {error && (
            <div className="w-full p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs text-left">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsOdometerModalOpen(true)}
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950 disabled:opacity-40"
          >
            <Gauge className="w-5 h-5" />
            <span>{submitting ? 'Calculating Conveyance...' : 'Capture End Odometer & Finish'}</span>
          </button>

          <button type="button" onClick={() => setCurrentStep(2)} className="text-xs text-slate-500 hover:text-slate-300">
            &larr; Back to Selfie
          </button>
        </div>
      )}

      {/* Step 4: End Duty Summary (Specification 17) */}
      {currentStep === 4 && completedSummary && (
        <div className="bg-slate-850 rounded-2xl p-6 border border-slate-800 flex flex-col gap-5">
          <div className="text-center pb-2 border-b border-slate-800">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-2 shadow">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Duty Completed</h2>
            <p className="text-xs text-slate-400 mt-0.5">Session recorded and submitted for Admin verification</p>
          </div>

          {/* Supervisor Information */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">Supervisor</span>
              <strong className="text-white">{completedSummary.supervisor_name}</strong>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">Employee ID</span>
              <strong className="text-white font-mono">{completedSummary.employee_id}</strong>
            </div>
          </div>

          {/* Time & KM Summary */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block">Start Time</span>
              <strong className="text-white text-sm">{formatTime(completedSummary.start_time)}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">End Time</span>
              <strong className="text-white text-sm">{formatTime(completedSummary.end_time)}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Start KM</span>
              <strong className="text-white text-sm font-mono">{completedSummary.start_odometer_final} KM</strong>
            </div>
            <div>
              <span className="text-slate-400 block">End KM</span>
              <strong className="text-white text-sm font-mono">{completedSummary.end_odometer_final} KM</strong>
            </div>
          </div>

          {/* Distance Comparison Card (Specification 15) */}
          <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-700/80 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800">
                <span className="text-slate-400 block">GPS Distance</span>
                <strong className="text-emerald-400 text-base font-mono">
                  {formatDistance(completedSummary.gps_distance_km)}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-800">
                <span className="text-slate-400 block">Odometer Distance</span>
                <strong className="text-blue-400 text-base font-mono">
                  {formatDistance(completedSummary.odometer_distance_km)}
                </strong>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-300 font-semibold block">Approved Distance</span>
                <span className="text-xs text-emerald-200/80">Reason: Lower Valid Distance Selected</span>
              </div>
              <span className="text-xl font-bold font-mono text-emerald-300">
                {formatDistance(completedSummary.approved_distance_km)}
              </span>
            </div>
          </div>

          {/* Conveyance Calculation (Specification 16) */}
          <div className="p-4 rounded-xl bg-brand-950/50 border border-brand-500/40 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block">Rate (Bike)</span>
              <span className="text-sm font-bold text-white">₹{completedSummary.conveyance_rate?.toFixed(2)} / KM</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Conveyance</span>
              <span className="text-2xl font-black text-brand-300 font-mono">
                {formatCurrency(completedSummary.conveyance_amount)}
              </span>
            </div>
          </div>

          {/* Status Badge (Specification 17) */}
          <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-center gap-2 text-amber-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Status: Waiting for Admin Verification</span>
          </div>

          <button
            type="button"
            onClick={onDutyEnded}
            className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-xl shadow-emerald-950 transition active:scale-95"
          >
            Back to Dashboard
          </button>
        </div>
      )}

      {/* Camera Modals */}
      <LiveCameraModal
        isOpen={isSelfieModalOpen}
        onClose={() => setIsSelfieModalOpen(false)}
        onCapture={handleSelfieCaptured}
        title="Capture Live End Selfie"
        facingModeDefault="user"
      />

      <OdometerScannerModal
        isOpen={isOdometerModalOpen}
        onClose={() => setIsOdometerModalOpen(false)}
        onConfirm={handleOdometerConfirmed}
        title="Capture End Bike Odometer"
        initialKm={activeDuty?.start_odometer_final}
      />
    </div>
  );
}
