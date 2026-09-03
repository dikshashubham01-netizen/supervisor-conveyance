import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Check, AlertTriangle, Cpu, Edit3, FlipHorizontal, Upload, Sparkles } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { Modal } from '../common/Modal';
import { api } from '../../api/client';

export function OdometerScannerModal({ isOpen, onClose, onConfirm, title = 'Bike Odometer Reading', initialKm = '' }) {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // default rear camera for bike meter

  const [isScanning, setIsScanning] = useState(false);
  const [detectedKm, setDetectedKm] = useState(null);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [manualKm, setManualKm] = useState(initialKm ? String(initialKm) : '');
  const [selectedFinalKm, setSelectedFinalKm] = useState('');
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
    setIsScanning(false);
    setDetectedKm(null);
    setOcrConfidence(null);
    setManualKm('');
    setSelectedFinalKm('');
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
        processOdometerImage(file, dataUrl, canvas);
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
      const dataUrl = event.target.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        processOdometerImage(file, dataUrl, canvas);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Pre-process canvas & run OCR
  const processOdometerImage = async (file, dataUrl, canvas) => {
    stopCamera();
    setCapturedImage({ file, dataUrl });
    setStep('verify');
    setIsScanning(true);

    try {
      // 1. Client-side OCR via Tesseract.js Worker
      const worker = await createWorker('eng');
      // Set OCR parameters for digit recognition
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789KMkm., '
      });

      const ret = await worker.recognize(canvas);
      await worker.terminate();

      const rawText = ret.data.text || '';
      const confidence = Math.round(ret.data.confidence || 0);

      // Extract 3 to 7 consecutive digits
      const clean = rawText.replace(/[oO]/g, '0').replace(/[lI]/g, '1').replace(/[sS]/g, '5').replace(/[,.]/g, '');
      const match = clean.match(/\b\d{3,7}\b/);
      let detectedNum = match ? parseFloat(match[0]) : null;

      if (detectedNum) {
        setDetectedKm(detectedNum);
        setOcrConfidence(confidence);
        setSelectedFinalKm(String(detectedNum));
      } else {
        // Fallback: try server OCR
        try {
          const formData = new FormData();
          formData.append('odometer', file);
          const serverOcr = await api.ocr.scan(formData);
          if (serverOcr.detectedKm) {
            setDetectedKm(serverOcr.detectedKm);
            setOcrConfidence(serverOcr.confidence || 85);
            setSelectedFinalKm(String(serverOcr.detectedKm));
          } else {
            setOcrConfidence(confidence || 40);
          }
        } catch (e) {
          console.warn('Server fallback OCR also found no digits');
        }
      }
    } catch (err) {
      console.error('Client OCR failed, trying server:', err);
      try {
        const formData = new FormData();
        formData.append('odometer', file);
        const serverOcr = await api.ocr.scan(formData);
        if (serverOcr.detectedKm) {
          setDetectedKm(serverOcr.detectedKm);
          setOcrConfidence(serverOcr.confidence);
          setSelectedFinalKm(String(serverOcr.detectedKm));
        }
      } catch (e) {}
    } finally {
      setIsScanning(false);
    }
  };

  const handleRetake = () => {
    resetState();
    startCamera(facingMode);
  };

  // Sample presets for quick demo
  const handlePresetSample = (kmValue) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#1e293b';
    ctx.roundRect(80, 140, 480, 200, 20);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
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

  const handleFinalSubmit = () => {
    const finalVal = parseFloat(selectedFinalKm || manualKm || detectedKm);
    if (isNaN(finalVal) || finalVal < 0) {
      alert('Please confirm a valid numerical KM reading before continuing.');
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
                    Capture using device camera or select a sample image below.
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
                    onLoadedMetadata={() => videoRef.current?.play()}
                  />
                  {/* HUD Targeting Box for Odometer */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-3/4 h-24 border-2 border-dashed border-emerald-400/90 rounded-xl bg-emerald-500/10 backdrop-blur-[1px] flex items-center justify-center shadow-lg">
                      <span className="text-xs font-mono text-emerald-300 font-semibold px-2 py-0.5 bg-black/60 rounded">
                        ALIGN ODOMETER HERE
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
                    className="absolute top-3 right-3 p-2.5 rounded-full bg-slate-900/70 backdrop-blur-md text-white border border-slate-700"
                    title="Switch Camera"
                  >
                    <FlipHorizontal className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Shutter Button */}
            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!!cameraError}
                className="w-16 h-16 rounded-full bg-white border-4 border-emerald-500 shadow-lg shadow-emerald-950 flex items-center justify-center active:scale-90 transition disabled:opacity-40"
              >
                <div className="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                  <Camera className="w-6 h-6" />
                </div>
              </button>

              {/* Upload file or pick realistic sample for rapid testing */}
              <div className="w-full flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
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
                  <span>Upload Photo</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test:</span>
                  <button
                    type="button"
                    onClick={() => handlePresetSample(12458)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono"
                  >
                    12,458
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSample(12490)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono"
                  >
                    12,490
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Step 2: Verification & Diff Confirmation */
          <div className="flex flex-col gap-4">
            {/* Captured preview with scan badge */}
            <div className="relative w-full aspect-[16/9] bg-black rounded-xl overflow-hidden border border-slate-700">
              <img
                src={capturedImage?.dataUrl}
                alt="Captured Odometer"
                className="w-full h-full object-cover"
              />
              {isScanning && (
                <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-emerald-400 font-semibold tracking-wider uppercase animate-pulse">
                    Scanning Odometer with OCR...
                  </span>
                </div>
              )}
            </div>

            {/* OCR Detection Box */}
            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  OCR Computer Vision
                </span>
                {ocrConfidence != null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-mono">
                    {ocrConfidence}% Confident
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-300">Detected KM:</span>
                <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
                  {detectedKm != null ? `${detectedKm.toLocaleString()} KM` : 'Could not detect automatically'}
                </span>
              </div>
            </div>

            {/* Manual Entry */}
            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Edit3 className="w-4 h-4 text-brand-400" />
                Enter KM Manually
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 12458"
                  value={manualKm}
                  onChange={(e) => {
                    setManualKm(e.target.value);
                    if (e.target.value) {
                      setSelectedFinalKm(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-lg font-mono text-white focus:outline-none focus:border-brand-500 transition"
                />
                <span className="text-slate-400 font-semibold text-sm">KM</span>
              </div>
            </div>

            {/* Mismatch Warning & Confirmation */}
            {hasMismatch && (
              <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/60 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>OCR & Manual Value Mismatch</span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  The detected OCR reading differs from your manual entry. Please select which reading is correct:
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedFinalKm(String(detectedKm))}
                    className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold border transition ${
                      selectedFinalKm === String(detectedKm)
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    Use OCR: {detectedKm} KM
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFinalKm(String(manualKm))}
                    className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold border transition ${
                      selectedFinalKm === String(manualKm)
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    Use Manual: {manualKm} KM
                  </button>
                </div>
              </div>
            )}

            {/* Confirmed Value Summary */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Final Confirmed KM:</span>
              <span className="text-lg font-bold font-mono text-white">
                {selectedFinalKm ? `${Number(selectedFinalKm).toLocaleString()} KM` : '---'}
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
                disabled={!selectedFinalKm}
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
