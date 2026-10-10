import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Check, Edit3, FlipHorizontal, Upload, X } from 'lucide-react';
import { Modal } from '../common/Modal';

export function OdometerScannerModal({ isOpen, onClose, onConfirm, title = 'Bike Odometer Reading', initialKm = '' }) {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // rear camera for bike meter
  const [manualKm, setManualKm] = useState(initialKm ? String(initialKm) : '');
  const [step, setStep] = useState('capture'); // 'capture' -> 'verify'
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      resetState();
      return;
    }
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const resetState = () => {
    setCapturedImage(null);
    setManualKm('');
    setStep('capture');
    setCameraError(null);
  };

  const startCamera = async (mode) => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device/browser');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn('Camera error:', err.message);
      setCameraError(err.message || 'Unable to open camera');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `odometer_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        handlePhotoCaptured(file, dataUrl);
      },
      'image/jpeg',
      0.9
    );
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      handlePhotoCaptured(file, event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoCaptured = (file, dataUrl) => {
    stopCamera();
    setCapturedImage({ file, dataUrl });
    setStep('verify');
  };

  const handleRetake = () => {
    resetState();
    startCamera(facingMode);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleFinalSubmit = () => {
    if (!manualKm || isNaN(parseFloat(manualKm)) || parseFloat(manualKm) < 0) {
      alert('Manual bike odometer KM reading is strictly mandatory. Please enter your bike KM reading.');
      return;
    }

    const finalVal = parseFloat(manualKm);
    onConfirm({
      image: capturedImage,
      detectedKm: null,
      ocrConfidence: 0,
      manualKm: finalVal,
      finalKm: finalVal
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        {step === 'capture' ? (
          <>
            {/* Viewfinder with Odometer HUD Guide */}
            <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-700">
              {cameraError ? (
                <div className="p-6 text-center flex flex-col items-center gap-3">
                  <Camera className="w-12 h-12 text-slate-600" />
                  <p className="text-sm text-rose-400 font-medium">{cameraError}</p>
                  <p className="text-xs text-slate-400">
                    Capture using device camera or upload a photo below.
                  </p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* HUD Overlay Frame */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                    <div className="w-full max-w-[280px] h-32 border-2 border-dashed border-emerald-400/70 rounded-xl relative flex flex-col items-center justify-between py-2 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 bg-slate-950/80 px-2 py-0.5 rounded">
                        Frame Bike Odometer
                      </span>
                      <span className="text-[9px] text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded">
                        Photo required for audit verification
                      </span>
                    </div>
                  </div>

                  {/* Camera Controls Overlay */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleCamera}
                      title="Flip Camera"
                      className="p-2.5 rounded-full bg-slate-950/70 text-white backdrop-blur hover:bg-slate-900 border border-slate-700 transition"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Shutter Button & Upload Options */}
            <div className="flex flex-col gap-2.5">
              {!cameraError && (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 hover:bg-emerald-500 transition active:scale-98"
                >
                  <Camera className="w-5 h-5" />
                  <span>Capture Odometer Photo</span>
                </button>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Odometer Photo</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Step 2: Verification & Manual KM Entry */
          <div className="flex flex-col gap-4">
            {/* Captured preview */}
            <div className="relative w-full aspect-[16/9] bg-black rounded-xl overflow-hidden border border-slate-700">
              <img
                src={capturedImage?.dataUrl}
                alt="Captured Odometer"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Manual Entry */}
            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-brand-400" />
                  Enter Bike Odometer KM
                </span>
                <span className="text-[10px] text-rose-400 font-bold tracking-normal bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                  * Mandatory
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  autoFocus
                  required
                  placeholder="Enter bike KM (e.g. 12458)"
                  value={manualKm}
                  onChange={(e) => setManualKm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-brand-500 transition"
                />
                <span className="text-slate-400 font-bold text-sm">KM</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Check your odometer photo above and enter the exact numerical KM reading.
              </p>
            </div>

            {/* Confirmed Value Summary */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Confirmed KM Reading:</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {manualKm && !isNaN(parseFloat(manualKm)) ? `${Number(manualKm).toLocaleString()} KM` : '---'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleRetake}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retake Photo</span>
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={!manualKm || isNaN(parseFloat(manualKm)) || parseFloat(manualKm) < 0}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition shadow-lg shadow-emerald-950 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Check className="w-4 h-4" />
                <span>Confirm KM</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
