import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, Upload, FlipHorizontal } from 'lucide-react';
import { Modal } from '../common/Modal';

export function LiveCameraModal({ isOpen, onClose, onCapture, title = 'Take Live Photo', facingModeDefault = 'user' }) {
  const [facingMode, setFacingMode] = useState(facingModeDefault); // 'user' (selfie) or 'environment' (odometer)
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Start camera when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setCameraError(null);
      return;
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async (mode) => {
    stopCamera();
    setIsStarting(true);
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
      console.warn('Camera access issue:', err.name, err.message);
      setCameraError(err.message || 'Camera permission denied or camera unavailable');
    } finally {
      setIsStarting(false);
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

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      // Mirror selfie
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage({ file, dataUrl });
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
      setCapturedImage({
        file,
        dataUrl: event.target.result
      });
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    if (!stream) {
      startCamera(facingMode);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col items-center gap-4">
        {/* Viewfinder or Preview */}
        <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-700">
          {capturedImage ? (
            <img
              src={capturedImage.dataUrl}
              alt="Captured preview"
              className="w-full h-full object-cover"
            />
          ) : cameraError ? (
            <div className="p-6 text-center flex flex-col items-center gap-3">
              <Camera className="w-12 h-12 text-slate-600" />
              <p className="text-sm text-rose-400 font-medium">{cameraError}</p>
              <p className="text-xs text-slate-400">
                You can select or take a photo using your device file picker below.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                onLoadedMetadata={() => videoRef.current?.play()}
              />
              {/* Camera flip button */}
              <button
                type="button"
                onClick={toggleCamera}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-slate-900/70 backdrop-blur-md text-white border border-slate-700 hover:bg-slate-800 transition shadow"
                title="Switch Camera"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Timestamp overlay */}
          <div className="absolute bottom-2 left-3 text-[11px] font-mono text-white/80 bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs">
            {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Action Controls */}
        {capturedImage ? (
          <div className="w-full grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleRetake}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retake</span>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition shadow-lg shadow-emerald-950 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Use Photo</span>
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-center gap-4 py-2">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!!cameraError || isStarting}
                className="w-16 h-16 rounded-full bg-white border-4 border-emerald-500 shadow-lg shadow-emerald-950 flex items-center justify-center active:scale-90 transition disabled:opacity-40 disabled:pointer-events-none"
                title="Capture Live Photo"
              >
                <div className="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                  <Camera className="w-6 h-6" />
                </div>
              </button>
            </div>

            {/* Fallback File/Camera Input */}
            <div className="pt-2 border-t border-slate-800 flex justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture={facingMode}
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-800/80 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose photo or sample file</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
