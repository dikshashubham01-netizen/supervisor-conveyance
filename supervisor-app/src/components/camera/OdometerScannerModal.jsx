import React, { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera as CameraIcon, Edit3, Check, RefreshCw, X } from 'lucide-react';

export function OdometerScannerModal({ isOpen, onClose, onConfirm, title = 'Bike Odometer Reading', initialKm = '' }) {
  const [capturedImage, setCapturedImage] = useState(null);
  const [manualKm, setManualKm] = useState(initialKm ? String(initialKm) : '');
  const [step, setStep] = useState('capture'); // 'capture' | 'verify'

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const triggerCamera = async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (photo?.dataUrl) {
        const res = await fetch(photo.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `odometer_${Date.now()}.${photo.format || 'jpg'}`, {
          type: `image/${photo.format || 'jpeg'}`
        });

        handlePhotoCaptured(file, photo.dataUrl);
      }
    } catch (err) {
      if (!err.message?.includes('User cancelled')) {
        fileInputRef.current?.click();
      }
    }
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
    setCapturedImage({ file, dataUrl });
    setStep('verify');
  };

  const handleFinalConfirm = () => {
    if (!manualKm || isNaN(parseFloat(manualKm)) || parseFloat(manualKm) < 0) {
      alert('Manual bike odometer KM reading is strictly mandatory. Please enter your bike KM reading.');
      return;
    }

    const val = parseFloat(manualKm);
    onConfirm({
      image: capturedImage,
      detectedKm: null,
      ocrConfidence: 0,
      manualKm: val,
      finalKm: val
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'capture' ? (
          <div className="flex flex-col gap-4">
            <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-700 flex flex-col items-center justify-center p-6 text-center gap-2">
              <CameraIcon className="w-12 h-12 text-blue-400 animate-pulse" />
              <p className="text-xs text-slate-300 font-medium">Position bike odometer clearly</p>
              <p className="text-[11px] text-slate-500">Capture your bike meter photo, then enter the KM reading</p>
            </div>

            <button
              type="button"
              onClick={triggerCamera}
              className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950 active:scale-95 transition"
            >
              <CameraIcon className="w-5 h-5" />
              <span>Capture Odometer Photo</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        ) : (
          /* Step 2: Verification — Manual KM Entry Only */
          <div className="flex flex-col gap-3.5">
            <div className="relative w-full aspect-[16/9] bg-black rounded-xl overflow-hidden border border-slate-700">
              <img src={capturedImage?.dataUrl} alt="Odometer" className="w-full h-full object-cover" />
            </div>

            {/* Manual Input */}
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300 uppercase flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-blue-400" /> Enter Bike Odometer KM
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-brand-500"
                />
                <span className="text-slate-400 text-sm font-bold">KM</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Check your odometer photo above and type the exact KM number shown on your bike meter.
              </p>
            </div>

            {/* Confirmed Display */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Confirmed Reading:</span>
              <strong className="text-emerald-400 font-mono text-base font-bold">
                {manualKm && !isNaN(parseFloat(manualKm)) ? `${Number(manualKm).toLocaleString()} KM` : '---'}
              </strong>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCapturedImage(null);
                  setStep('capture');
                }}
                className="py-3 px-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Retake Photo
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                disabled={!manualKm || isNaN(parseFloat(manualKm)) || parseFloat(manualKm) < 0}
                className="py-3 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-950 disabled:opacity-40"
              >
                Confirm KM
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
