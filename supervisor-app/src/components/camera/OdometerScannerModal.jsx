import React, { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { createWorker } from 'tesseract.js';
import { Camera as CameraIcon, Cpu, Edit3, Check, RefreshCw, AlertTriangle, X, Sparkles, Upload } from 'lucide-react';
import { api } from '../../api/client';

export function OdometerScannerModal({ isOpen, onClose, onConfirm, title = 'Bike Odometer Reading', initialKm = '' }) {
  const [capturedImage, setCapturedImage] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedKm, setDetectedKm] = useState(null);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [manualKm, setManualKm] = useState(initialKm ? String(initialKm) : '');
  const [selectedFinalKm, setSelectedFinalKm] = useState('');
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

        processOdometer(file, photo.dataUrl);
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
      processOdometer(file, event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const processOdometer = async (file, dataUrl) => {
    setCapturedImage({ file, dataUrl });
    setStep('verify');
    setIsScanning(true);

    try {
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_char_whitelist: '0123456789KMkm., ' });
      const ret = await worker.recognize(dataUrl);
      await worker.terminate();

      const rawText = ret.data.text || '';
      const confidence = Math.round(ret.data.confidence || 0);

      const clean = rawText.replace(/[oO]/g, '0').replace(/[lI]/g, '1').replace(/[sS]/g, '5').replace(/[,.]/g, '');
      const match = clean.match(/\b\d{3,7}\b/);
      let detectedNum = match ? parseFloat(match[0]) : null;

      if (detectedNum) {
        setDetectedKm(detectedNum);
        setOcrConfidence(confidence);
        setSelectedFinalKm(String(detectedNum));
      } else {
        // Fallback to server OCR
        try {
          const formData = new FormData();
          formData.append('odometer', file);
          const serverOcr = await api.ocr.scan(formData);
          if (serverOcr.detectedKm) {
            setDetectedKm(serverOcr.detectedKm);
            setOcrConfidence(serverOcr.confidence || 85);
            setSelectedFinalKm(String(serverOcr.detectedKm));
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('OCR error:', err.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Test sample helper
  const handleTestSample = (kmValue) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#1e293b';
    ctx.roundRect(60, 140, 520, 200, 20);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${kmValue.toLocaleString()} KM`, 320, 255);

    canvas.toBlob((blob) => {
      const file = new File([blob], `sample_${kmValue}.jpg`, { type: 'image/jpeg' });
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage({ file, dataUrl });
      setDetectedKm(kmValue);
      setOcrConfidence(98);
      setSelectedFinalKm(String(kmValue));
      setStep('verify');
      setIsScanning(false);
    }, 'image/jpeg');
  };

  const handleFinalConfirm = () => {
    const finalVal = parseFloat(selectedFinalKm || manualKm || detectedKm);
    if (isNaN(finalVal) || finalVal < 0) {
      alert('Please confirm a valid numerical KM reading.');
      return;
    }

    onConfirm({
      image: capturedImage,
      detectedKm: detectedKm != null ? Number(detectedKm) : null,
      ocrConfidence: ocrConfidence || 0,
      manualKm: manualKm ? parseFloat(manualKm) : null,
      finalKm: finalVal
    });
    onClose();
  };

  const hasMismatch =
    detectedKm != null &&
    manualKm &&
    parseFloat(manualKm) !== parseFloat(detectedKm);

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
              <p className="text-[11px] text-slate-500">OCR will automatically detect the number</p>
            </div>

            <button
              type="button"
              onClick={triggerCamera}
              className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950 active:scale-95 transition"
            >
              <CameraIcon className="w-5 h-5" />
              <span>Capture Odometer</span>
            </button>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
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
                className="flex items-center gap-1 hover:text-slate-200"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>

              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Sample:</span>
                <button
                  type="button"
                  onClick={() => handleTestSample(12458)}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono"
                >
                  12,458
                </button>
                <button
                  type="button"
                  onClick={() => handleTestSample(12490)}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono"
                >
                  12,490
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Verification */
          <div className="flex flex-col gap-3.5">
            <div className="relative w-full aspect-[16/9] bg-black rounded-xl overflow-hidden border border-slate-700">
              <img src={capturedImage?.dataUrl} alt="Odometer" className="w-full h-full object-cover" />
              {isScanning && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                  <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-emerald-400 font-semibold tracking-wider">Detecting KM with OCR...</span>
                </div>
              )}
            </div>

            {/* OCR Detection Box */}
            <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" /> OCR Vision
                </span>
                {ocrConfidence != null && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-mono border border-emerald-800">
                    {ocrConfidence}%
                  </span>
                )}
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {detectedKm != null ? `${detectedKm.toLocaleString()} KM` : 'Could not detect'}
              </div>
            </div>

            {/* Manual Input */}
            <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Enter KM Manually
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 12458"
                  value={manualKm}
                  onChange={(e) => {
                    setManualKm(e.target.value);
                    if (e.target.value) setSelectedFinalKm(e.target.value);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-base font-mono text-white focus:outline-none focus:border-brand-500"
                />
                <span className="text-slate-400 text-xs font-bold">KM</span>
              </div>
            </div>

            {/* Mismatch Selector */}
            {hasMismatch && (
              <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500/60 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-1 text-amber-300 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>OCR vs Manual Mismatch</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFinalKm(String(detectedKm))}
                    className={`p-2 rounded-lg text-xs font-mono font-bold border transition ${
                      selectedFinalKm === String(detectedKm)
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    Use OCR: {detectedKm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFinalKm(String(manualKm))}
                    className={`p-2 rounded-lg text-xs font-mono font-bold border transition ${
                      selectedFinalKm === String(manualKm)
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    Use Manual: {manualKm}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmed Display */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Confirmed Reading:</span>
              <strong className="text-emerald-400 font-mono text-base">
                {selectedFinalKm ? `${Number(selectedFinalKm).toLocaleString()} KM` : '---'}
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
                Retake
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                disabled={!selectedFinalKm}
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
