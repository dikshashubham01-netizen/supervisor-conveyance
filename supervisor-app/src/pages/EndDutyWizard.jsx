import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { NativeCameraModal } from '../components/camera/NativeCameraModal';
import { OdometerScannerModal } from '../components/camera/OdometerScannerModal';
import { useGeolocation } from '../hooks/useGeolocation';
import { api } from '../api/client';
import { formatCurrency, formatDistance, formatTime } from '../utils/formatters';
import { Camera, Gauge, CheckCircle2, AlertTriangle, ArrowRight, Check } from 'lucide-react';

export function EndDutyWizard({ activeDuty, onDutyEnded, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1);
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
    submitEnd(data);
  };

  const submitEnd = async (odoData) => {
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

      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}
    } catch (err) {
      setError(err.message || 'Failed to complete end duty');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between max-w-md mx-auto">
      <div className="flex flex-col gap-4 pt-2">
        {/* Step 1: Confirmation */}
        {currentStep === 1 && (
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">End Today's Duty?</h2>
              <p className="text-xs text-slate-400 mt-1">
                You will need to take an End Selfie and End Bike Odometer photo to calculate conveyance.
              </p>
            </div>

            <div className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 gap-3 text-left text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Start Time</span>
                <strong className="text-white">{formatTime(activeDuty?.start_time)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Start KM</span>
                <strong className="text-white font-mono">{activeDuty?.start_odometer_final} KM</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">GPS Distance</span>
                <strong className="text-emerald-400 font-mono">{formatDistance(activeDuty?.gps_distance_km)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Est. Conveyance</span>
                <strong className="text-brand-400 font-mono">{formatCurrency(activeDuty?.estimatedConveyance)}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="py-3 px-3 rounded-2xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Continue Duty
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="py-3 px-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-950"
              >
                Yes, End Duty
              </button>
            </div>
          </div>
        )}

        {/* Step 2: End Selfie */}
        {currentStep === 2 && (
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">End Attendance Selfie</h3>
              <p className="text-xs text-slate-400 mt-1">Capture your live selfie at the end of duty.</p>
            </div>

            {selfieData ? (
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow">
                  <img src={selfieData.dataUrl} alt="Selfie" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> End Selfie Captured ✓
                </span>
                <button
                  type="button"
                  onClick={() => setIsSelfieModalOpen(true)}
                  className="text-xs text-slate-400 underline"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="py-3 px-6 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950 mt-1"
                >
                  <span>Continue to End Odometer</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSelfieModalOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                <span>Take End Selfie</span>
              </button>
            )}
          </div>
        )}

        {/* Step 3: End Odometer */}
        {currentStep === 3 && (
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Gauge className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">End Bike Odometer</h3>
              <p className="text-xs text-slate-400 mt-1">
                Capture your final bike odometer. Start was: <strong className="text-white font-mono">{activeDuty?.start_odometer_final} KM</strong>
              </p>
            </div>

            {error && (
              <div className="w-full p-3 rounded-xl bg-rose-950 border border-rose-500/60 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsOdometerModalOpen(true)}
              disabled={submitting}
              className="w-full py-4 px-6 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Gauge className="w-5 h-5" />
              <span>{submitting ? 'Calculating Conveyance...' : 'Capture End Odometer & Finish'}</span>
            </button>
          </div>
        )}

        {/* Step 4: End Duty Summary */}
        {currentStep === 4 && completedSummary && (
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col gap-4">
            <div className="text-center pb-2 border-b border-slate-800">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-1.5 shadow">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Duty Completed</h2>
              <p className="text-xs text-slate-400 mt-0.5">Submitted for Admin Verification</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Start Time</span>
                <strong className="text-white">{formatTime(completedSummary.start_time)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">End Time</span>
                <strong className="text-white">{formatTime(completedSummary.end_time)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Start KM</span>
                <strong className="text-white font-mono">{completedSummary.start_odometer_final} KM</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">End KM</span>
                <strong className="text-white font-mono">{completedSummary.end_odometer_final} KM</strong>
              </div>
            </div>

            {/* Lower Distance Selection Display */}
            <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/60 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-300 font-bold block">Approved Distance</span>
                  <span className="text-[10px] text-emerald-200/80">Lower Valid Distance Selected</span>
                </div>
                <span className="text-xl font-black font-mono text-emerald-300">
                  {formatDistance(completedSummary.approved_distance_km)}
                </span>
              </div>
              <div className="text-[10px] text-emerald-300/80 pt-1 border-t border-emerald-800">
                GPS: {formatDistance(completedSummary.gps_distance_km)} • Odometer: {formatDistance(completedSummary.odometer_distance_km)}
              </div>
            </div>

            {/* Conveyance Calculation */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">Rate (Bike)</span>
                <span className="text-xs font-bold text-white">₹{completedSummary.conveyance_rate?.toFixed(2)} / KM</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Conveyance Amount</span>
                <span className="text-2xl font-black text-brand-400 font-mono">
                  {formatCurrency(completedSummary.conveyance_amount)}
                </span>
              </div>
            </div>

            {/* Status */}
            <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-300 text-xs font-bold text-center">
              Status: Waiting for Admin Verification
            </div>

            <button
              type="button"
              onClick={onDutyEnded}
              className="w-full py-4 px-6 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-xl shadow-emerald-950"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>

      <NativeCameraModal
        isOpen={isSelfieModalOpen}
        onClose={() => setIsSelfieModalOpen(false)}
        onCapture={handleSelfieCaptured}
        title="End Attendance Selfie"
      />

      <OdometerScannerModal
        isOpen={isOdometerModalOpen}
        onClose={() => setIsOdometerModalOpen(false)}
        onConfirm={handleOdometerConfirmed}
        title="End Bike Odometer"
        initialKm={activeDuty?.start_odometer_final}
      />
    </div>
  );
}
