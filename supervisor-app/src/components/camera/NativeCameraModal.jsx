import React, { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera as CameraIcon, RefreshCw, Check, X, Upload } from 'lucide-react';

export function NativeCameraModal({ isOpen, onClose, onCapture, title = 'Take Photo' }) {
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Trigger Capacitor native camera
  const triggerNativeCamera = async () => {
    setIsCapturing(true);
    setError(null);

    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (photo && photo.dataUrl) {
        // Convert dataUrl to blob/file
        const res = await fetch(photo.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `photo_${Date.now()}.${photo.format || 'jpg'}`, {
          type: `image/${photo.format || 'jpeg'}`
        });

        setCapturedImage({ file, dataUrl: photo.dataUrl });
      }
    } catch (err) {
      console.warn('Native camera issue, opening fallback picker:', err.message);
      // User cancelled or camera denied
      if (!err.message?.includes('User cancelled')) {
        fileInputRef.current?.click();
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage({ file, dataUrl: event.target.result });
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Preview */}
        <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center">
          {capturedImage ? (
            <img src={capturedImage.dataUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <CameraIcon className="w-12 h-12 text-slate-600 animate-pulse" />
              <p className="text-xs text-slate-400">Click below to open device camera</p>
            </div>
          )}
        </div>

        {/* Controls */}
        {capturedImage ? (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setCapturedImage(null)}
              className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retake</span>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950"
            >
              <Check className="w-4 h-4" />
              <span>Use Photo</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={triggerNativeCamera}
              disabled={isCapturing}
              className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950 active:scale-95 transition"
            >
              <CameraIcon className="w-5 h-5" />
              <span>{isCapturing ? 'Opening Camera...' : 'Open Mobile Camera'}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-slate-400 hover:text-slate-200 text-center py-1 flex items-center justify-center gap-1"
            >
              <Upload className="w-3 h-3" />
              <span>Choose photo from gallery or file</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
