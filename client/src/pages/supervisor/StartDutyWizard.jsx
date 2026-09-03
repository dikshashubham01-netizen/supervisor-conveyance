import React, { useState } from 'react';
import { LiveCameraModal } from '../../components/camera/LiveCameraModal';
import { OdometerScannerModal } from '../../components/camera/OdometerScannerModal';
import { useGeolocation } from '../../hooks/useGeolocation';
import { api } from '../../api/client';
import { Camera, Gauge, CheckCircle2, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';

export function StartDutyWizard({ onDutyStarted, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1); // 1: Selfie, 2: Odometer, 3: Review & Start
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

      // Get current GPS position for Start Duty
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
    <div className="max-w-xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      {/* Wizard Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white tracking-tight">Start Duty Session</h2>
        <p className="text-sm text-slate-400 mt-1">Complete attendance verification to activate tracking</p>
      </div>

      {/* Steps Indicator */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`p-2.5 rounded-xl border text-center transition ${
          currentStep === 1 
            ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold' 
            : selfieData ? 'bg-slate-800 border-emerald-700/50 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500'
        }`}>
          <div className="text-xs">Step 1</div>
          <div className="text-xs font-semibold truncate">Live Selfie</div>
        </div>
        <div className={`p-2.5 rounded-xl border text-center transition ${
          currentStep === 2 
            ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold' 
            : odometerData ? 'bg-slate-800 border-emerald-700/50 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500'
        }`}>
          <div className="text-xs">Step 2</div>
          <div className="text-xs font-semibold truncate">Bike Odometer</div>
        </div>
        <div className={`p-2.5 rounded-xl border text-center transition ${
          currentStep === 3 ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-500'
        }`}>
          <div className="text-xs">Step 3</div>
          <div className="text-xs font-semibold truncate">Confirm</div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Step 1 Content: Selfie */}
      {currentStep === 1 && (
        <div className="bg-slate-850 rounded-2xl p-6 border border-slate-800 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Camera className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Step 1 — Live Selfie</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Please take a clear live selfie using your mobile camera. GPS location and timestamp will be attached.
            </p>
          </div>

          {selfieData ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg">
                <img src={selfieData.dataUrl} alt="Selfie" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Start Selfie Captured ✓
              </span>
              <button
                type="button"
                onClick={() => setIsSelfieModalOpen(true)}
                className="text-xs text-slate-400 underline hover:text-white"
              >
                Retake Selfie
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full py-3 px-6 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950"
              >
                <span>Continue to Step 2</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSelfieModalOpen(true)}
              className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950 active:scale-95"
            >
              <Camera className="w-5 h-5" />
              <span>Open Camera & Take Selfie</span>
            </button>
          )}
        </div>
      )}

      {/* Step 2 Content: Bike Odometer */}
      {currentStep === 2 && (
        <div className="bg-slate-850 rounded-2xl p-6 border border-slate-800 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Gauge className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Step 2 — Bike Odometer Photo</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Capture your bike's odometer dial. The OCR engine will auto-detect the KM reading for your confirmation.
            </p>
          </div>

          {odometerData ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="w-44 aspect-[16/9] rounded-xl overflow-hidden border-2 border-emerald-500 shadow-lg">
                <img src={odometerData.image.dataUrl} alt="Odometer" className="w-full h-full object-cover" />
              </div>
              <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 text-center">
                <span className="text-xs text-slate-400 block">Confirmed Start KM</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {odometerData.finalKm.toLocaleString()} KM
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOdometerModalOpen(true)}
                className="text-xs text-slate-400 underline hover:text-white"
              >
                Change or Retake Odometer
              </button>
              <div className="w-full grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="py-3 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 flex items-center justify-center gap-2"
                >
                  <span>Review</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setIsOdometerModalOpen(true)}
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950 active:scale-95"
              >
                <Gauge className="w-5 h-5" />
                <span>Capture Bike Odometer</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-slate-400 hover:text-white"
              >
                &larr; Back to Selfie
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 Content: Review & Confirm Start */}
      {currentStep === 3 && (
        <div className="bg-slate-850 rounded-2xl p-6 border border-slate-800 flex flex-col gap-5">
          <div className="text-center">
            <h3 className="text-lg font-bold text-white">Review Duty Details</h3>
            <p className="text-xs text-slate-400 mt-1">
              Verify your attendance photos before starting GPS tracking
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Live Selfie</span>
              <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-700">
                <img src={selfieData?.dataUrl} alt="Selfie" className="w-full h-full object-cover" />
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold">Captured ✓</span>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Bike Odometer</span>
              <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-700">
                <img src={odometerData?.image?.dataUrl} alt="Odometer" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm font-bold font-mono text-emerald-400">
                {odometerData?.finalKm.toLocaleString()} KM
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>
              By clicking Start Duty, GPS location tracking will become active for your travel conveyance.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinalStart}
              disabled={submitting}
              className="py-3.5 px-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-xl shadow-emerald-950/80 active:scale-95 transition disabled:opacity-40"
            >
              {submitting ? 'Starting Duty...' : 'START DUTY'}
            </button>
          </div>
        </div>
      )}

      {/* Cancel button */}
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-slate-500 hover:text-slate-300 text-center"
      >
        Cancel & Return
      </button>

      {/* Modals */}
      <LiveCameraModal
        isOpen={isSelfieModalOpen}
        onClose={() => setIsSelfieModalOpen(false)}
        onCapture={handleSelfieCaptured}
        title="Capture Live Selfie"
        facingModeDefault="user"
      />

      <OdometerScannerModal
        isOpen={isOdometerModalOpen}
        onClose={() => setIsOdometerModalOpen(false)}
        onConfirm={handleOdometerConfirmed}
        title="Capture Start Bike Odometer"
      />
    </div>
  );
}
