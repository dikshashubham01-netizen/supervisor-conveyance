import React, { useState } from 'react';
import { NativeCameraModal } from '../components/camera/NativeCameraModal';
import { OdometerScannerModal } from '../components/camera/OdometerScannerModal';
import { useGeolocation } from '../hooks/useGeolocation';
import { api } from '../api/client';
import { Camera, Gauge, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

export function StartDutyWizard({ onDutyStarted, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSelfieModalOpen, setIsSelfieModalOpen] = useState(false);
  const [isOdometerModalOpen, setIsOdometerModalOpen] = useState(false);

  const [selfieData, setSelfieData] = useState(null);
  const [odometerData, setOdometerData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { getCurrentPositionAsync } = useGeolocation(false);

  const handleSelfieCaptured = (data) => {
    setSelfieData(data);
    setCurrentStep(2);
  };

  const handleOdometerConfirmed = (data) => {
    setOdometerData(data);
    setCurrentStep(3);
  };

  const handleFinalStart = async () => {
    if (!selfieData || !odometerData) {
      setError('Please capture both live selfie and odometer reading.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const pos = await getCurrentPositionAsync();

      const formData = new FormData();
      formData.append('selfie', selfieData.file);
      formData.append('odometer', odometerData.image.file);
      formData.append('latitude', pos.latitude);
      formData.append('longitude', pos.longitude);
      formData.append('accuracy', pos.accuracy || 10);
      formData.append('odometerOcr', odometerData.detectedKm ?? '');
      formData.append('odometerManual', odometerData.manualKm ?? '');
      formData.append('odometerFinal', odometerData.finalKm);

      await api.duty.start(formData);
      onDutyStarted();
    } catch (err) {
      console.error('Failed to start duty:', err);
      setError(err.message || 'Failed to start duty session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 flex flex-col justify-between max-w-md mx-auto">
      <div className="flex flex-col gap-5 pt-2">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white tracking-tight">Start Duty Verification</h2>
          <p className="text-xs text-slate-400 mt-0.5">Live Selfie & Bike Odometer Required</p>
        </div>

        {/* Steps Pills */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-semibold">
          <div className={`p-2 rounded-xl border ${
            currentStep === 1 ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : selfieData ? 'bg-slate-800 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            1. Selfie
          </div>
          <div className={`p-2 rounded-xl border ${
            currentStep === 2 ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : odometerData ? 'bg-slate-800 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            2. Odometer
          </div>
          <div className={`p-2 rounded-xl border ${
            currentStep === 3 ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            3. Start
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Step 1: Selfie */}
        {currentStep === 1 && (
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Live Attendance Selfie</h3>
              <p className="text-xs text-slate-400 mt-1">Take a clear live selfie using your mobile camera.</p>
            </div>

            {selfieData ? (
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow">
                  <img src={selfieData.dataUrl} alt="Selfie" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Start Selfie Captured ✓
                </span>
                <button
                  type="button"
                  onClick={() => setIsSelfieModalOpen(true)}
                  className="text-xs text-slate-400 underline"
                >
                  Retake Selfie
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 mt-2 shadow-lg shadow-emerald-950"
                >
                  <span>Continue to Step 2</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSelfieModalOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Camera className="w-5 h-5" />
                <span>Take Live Selfie</span>
              </button>
            )}
          </div>
        )}

        {/* Step 2: Odometer */}
        {currentStep === 2 && (
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Gauge className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bike Odometer Photo</h3>
              <p className="text-xs text-slate-400 mt-1">Capture your bike odometer dial to record start KM.</p>
            </div>

            {odometerData ? (
              <div className="flex flex-col items-center gap-2.5 w-full">
                <div className="w-40 aspect-[16/9] rounded-xl overflow-hidden border-2 border-emerald-500 shadow">
                  <img src={odometerData.image.dataUrl} alt="Odometer" className="w-full h-full object-cover" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  {odometerData.finalKm.toLocaleString()} KM
                </div>
                <button
                  type="button"
                  onClick={() => setIsOdometerModalOpen(true)}
                  className="text-xs text-slate-400 underline"
                >
                  Retake or Edit
                </button>
                <div className="grid grid-cols-2 gap-2 w-full pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="py-3 px-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="py-3 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-950"
                  >
                    Review
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsOdometerModalOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Gauge className="w-5 h-5" />
                <span>Capture Bike Odometer</span>
              </button>
            )}
          </div>
        )}

        {/* Step 3: Confirmation */}
        {currentStep === 3 && (
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col gap-4">
            <div className="text-center">
              <h3 className="text-base font-bold text-white">Confirm & Start Tracking</h3>
              <p className="text-xs text-slate-400 mt-0.5">Your location tracking will start immediately</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 flex flex-col items-center gap-1.5 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Selfie</span>
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-700">
                  <img src={selfieData?.dataUrl} alt="Selfie" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">Verified ✓</span>
              </div>

              <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 flex flex-col items-center gap-1.5 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Odometer</span>
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-700">
                  <img src={odometerData?.image?.dataUrl} alt="Odometer" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-bold font-mono text-emerald-400">
                  {odometerData?.finalKm.toLocaleString()} KM
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Location tracking is active only during your duty session.</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="py-3.5 px-3 rounded-2xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinalStart}
                disabled={submitting}
                className="py-3.5 px-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl shadow-emerald-950 disabled:opacity-50"
              >
                {submitting ? 'Starting...' : 'START DUTY'}
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-slate-500 hover:text-slate-300 text-center py-3"
      >
        Cancel & Return
      </button>

      <NativeCameraModal
        isOpen={isSelfieModalOpen}
        onClose={() => setIsSelfieModalOpen(false)}
        onCapture={handleSelfieCaptured}
        title="Capture Live Selfie"
      />

      <OdometerScannerModal
        isOpen={isOdometerModalOpen}
        onClose={() => setIsOdometerModalOpen(false)}
        onConfirm={handleOdometerConfirmed}
        title="Start Bike Odometer"
      />
    </div>
  );
}
