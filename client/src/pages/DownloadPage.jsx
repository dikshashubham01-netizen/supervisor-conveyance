import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Navigation,
  Sparkles,
  HardDrive,
  FileCheck
} from 'lucide-react';

export function DownloadPage({ onBackToLogin }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadedMb, setDownloadedMb] = useState(0);
  const [totalMb, setTotalMb] = useState(7.01);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(null);

  const startDownload = async () => {
    try {
      setDownloading(true);
      setProgress(0);
      setDownloadedMb(0);
      setCompleted(false);
      setError(null);

      const apkUrl = '/Supervisor-App.apk';
      const response = await fetch(apkUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch APK (${response.statusText})`);
      }

      const contentLengthHeader = response.headers.get('Content-Length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 7351590;
      setTotalMb((totalBytes / (1024 * 1024)).toFixed(2));

      const reader = response.body.getReader();
      let receivedBytes = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
        setProgress(percent);
        setDownloadedMb((receivedBytes / (1024 * 1024)).toFixed(2));
      }

      // Assemble blob and trigger browser download
      const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'Supervisor-App.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      setProgress(100);
      setCompleted(true);
      setDownloading(false);
    } catch (err) {
      console.error('Download error:', err);
      setError(err.message || 'Download failed. Please try again.');
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-brand-500 selection:text-white relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md flex flex-col gap-5 relative z-10 my-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToLogin || (() => window.location.href = '/')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 py-1.5 px-3 rounded-xl transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Admin Portal</span>
          </button>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Android Official Release
          </span>
        </div>

        {/* Main App Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl flex flex-col gap-6 text-center">
          {/* App Icon */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-2xl shadow-emerald-950/80 mb-4 ring-4 ring-slate-800/80">
              <Smartphone className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">GeoConvey Supervisor</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Supervisor Location Monitoring & Bike Conveyance Android App
            </p>
          </div>

          {/* App Specs Badges */}
          <div className="grid grid-cols-3 gap-2 bg-slate-850/80 p-3 rounded-2xl border border-slate-800 text-xs">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400">Version</span>
              <span className="font-bold text-white font-mono">v1.0.0</span>
            </div>
            <div className="flex flex-col items-center border-x border-slate-750">
              <span className="text-[10px] text-slate-400">Size</span>
              <span className="font-bold text-white font-mono">{totalMb} MB</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400">OS</span>
              <span className="font-bold text-emerald-400">Android 8+</span>
            </div>
          </div>

          {/* Download Progress / Action Area */}
          <div className="flex flex-col gap-3">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {downloading && (
              <div className="bg-slate-850 p-4 rounded-2xl border border-slate-750 flex flex-col gap-2.5 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Downloading Supervisor-App.apk...
                  </span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">{progress}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/80">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-150 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{downloadedMb} MB downloaded</span>
                  <span>{totalMb} MB total</span>
                </div>
              </div>
            )}

            {completed && (
              <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/80 text-emerald-300 text-xs flex flex-col gap-2 text-left">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Download Complete! (100%)</span>
                </div>
                <p className="text-[11px] text-emerald-300/90">
                  Check your browser downloads or swipe down on your phone's notification bar to open <strong>Supervisor-App.apk</strong> and tap <strong>Install</strong>.
                </p>
              </div>
            )}

            {!downloading && (
              <button
                type="button"
                onClick={startDownload}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-brand-600 to-emerald-500 hover:from-emerald-500 hover:to-brand-400 text-white font-black text-base shadow-xl shadow-emerald-950/80 active:scale-95 transition flex items-center justify-center gap-2.5 group"
              >
                <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                <span>{completed ? 'Download APK Again' : 'Download Android App (APK)'}</span>
              </button>
            )}

            {/* Direct fallback link */}
            <a
              href="/Supervisor-App.apk"
              download="Supervisor-App.apk"
              className="text-[11px] text-slate-500 hover:text-slate-300 transition underline underline-offset-4"
            >
              Having issues? Click here for direct instant download
            </a>
          </div>

          {/* 3 Step Installation Instructions */}
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-3 text-left">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-brand-400" />
              Easy 3-Step Installation:
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-850/50 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-brand-950 border border-brand-600 text-brand-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-slate-300 text-[11px]">
                  Tap <strong>Download Android App (APK)</strong> above.
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-850/50 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-brand-950 border border-brand-600 text-brand-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-slate-300 text-[11px]">
                  When download finishes, tap on <strong>Supervisor-App.apk</strong> in your notifications or Downloads folder.
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-850/50 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-brand-950 border border-brand-600 text-brand-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-slate-300 text-[11px]">
                  Tap <strong>Install</strong>. <em>(If prompted, enable "Allow from this source" in Android settings).</em>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Verified Safe APK • Direct Production Release</span>
        </div>
      </div>
    </div>
  );
}
