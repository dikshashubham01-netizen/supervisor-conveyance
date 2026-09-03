import React, { useState } from 'react';
import { Download, Sparkles, CheckCircle2, AlertCircle, ExternalLink, X, Smartphone, ArrowDownCircle } from 'lucide-react';

export function UpdateModal({ isOpen, onClose, currentVersion, remoteInfo }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadedMb, setDownloadedMb] = useState(0);
  const [totalMb, setTotalMb] = useState(7.2);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const latestVersion = remoteInfo?.version || '1.0.1';
  const hasUpdate = latestVersion !== currentVersion;
  const downloadPageUrl = remoteInfo?.downloadUrl || 'https://supervisor-conveyance.vercel.app/download';
  const apkUrl = remoteInfo?.apkUrl || 'https://supervisor-conveyance.vercel.app/Supervisor-App.apk';
  const changelog = remoteInfo?.changelog || 'Latest performance enhancements, live GPS tracking sync, and auto-update support.';

  const startInAppDownload = async () => {
    try {
      setDownloading(true);
      setProgress(0);
      setDownloadedMb(0);
      setCompleted(false);
      setError(null);

      const response = await fetch(apkUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch APK (${response.statusText})`);
      }

      const contentLengthHeader = response.headers.get('Content-Length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 7477260;
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

      // Assemble blob & trigger system download / package install
      const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Supervisor-App-v${latestVersion}.apk`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      setProgress(100);
      setCompleted(true);
      setDownloading(false);
    } catch (err) {
      console.error('In-app download error:', err);
      setError(err.message || 'Direct download failed. Please use browser download option.');
      setDownloading(false);
    }
  };

  const openInBrowser = () => {
    window.open(downloadPageUrl, '_system');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4 shadow-2xl" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
        {/* Header */}
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid #334155' }}>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>App Version & Updates</span>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Version Status Box */}
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#94a3b8] uppercase font-semibold">Installed Version</span>
              <span className="text-white font-mono font-bold text-base">v{currentVersion}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-[#94a3b8] uppercase font-semibold">Latest Available</span>
              <span className="text-emerald-400 font-mono font-bold text-base">v{latestVersion}</span>
            </div>
          </div>

          {hasUpdate ? (
            <div className="p-2.5 rounded-xl flex items-center gap-2 text-xs" style={{ backgroundColor: '#052e16', border: '1px solid #166534', color: '#86efac' }}>
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>New update available!</strong> Tap below to download the latest version.</span>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl flex items-center gap-2 text-xs" style={{ backgroundColor: '#0f291e', border: '1px solid #14532d', color: '#86efac' }}>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>You are using the latest version of GeoConvey!</span>
            </div>
          )}
        </div>

        {/* Release Notes */}
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-[#94a3b8] font-semibold">What's New in v{latestVersion}:</span>
          <div className="p-3 rounded-xl text-[11px] text-[#cbd5e1] leading-relaxed" style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}>
            {changelog}
          </div>
        </div>

        {/* Download Progress / Errors */}
        {error && (
          <div className="p-3 rounded-xl text-xs flex items-start gap-2" style={{ backgroundColor: '#450a0a', border: '1px solid #ef4444', color: '#fca5a5' }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {downloading && (
          <div className="p-3.5 rounded-2xl flex flex-col gap-2" style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}>
            <div className="flex items-center justify-between text-xs text-white">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Downloading APK...
              </span>
              <span className="font-mono text-emerald-400 font-bold">{progress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(to right, #16a34a, #10b981)'
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#94a3b8] font-mono">
              <span>{downloadedMb} MB</span>
              <span>{totalMb} MB total</span>
            </div>
          </div>
        )}

        {completed && (
          <div className="p-3 rounded-xl text-xs flex flex-col gap-1 text-left" style={{ backgroundColor: '#052e16', border: '1px solid #166534', color: '#86efac' }}>
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Download Complete (100%)!</span>
            </div>
            <span className="text-[11px] text-[#86efac]">
              Tap on the downloaded <strong>Supervisor-App.apk</strong> in your phone notifications or Downloads folder to install.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {!downloading && (
            <button
              type="button"
              onClick={startInAppDownload}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 active:scale-95 transition"
              style={{ background: 'linear-gradient(to right, #16a34a, #15803d)' }}
            >
              <Download className="w-4 h-4" />
              <span>{completed ? 'Download APK Again' : hasUpdate ? `Download Update (v${latestVersion})` : 'Re-download Current APK'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={openInBrowser}
            className="w-full py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#94a3b8' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Download Webpage</span>
          </button>
        </div>
      </div>
    </div>
  );
}
