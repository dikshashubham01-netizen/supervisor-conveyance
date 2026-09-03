import React, { useState } from 'react';
import { api, getServerUrl, setServerUrl } from '../../api/client';
import { Server, Check, X, Wifi, AlertCircle, RefreshCw } from 'lucide-react';

export function ServerConfigModal({ isOpen, onClose }) {
  const [urlInput, setUrlInput] = useState(getServerUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, msg: string }

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await api.checkConnection(urlInput);
      if (ok) {
        setTestResult({ success: true, msg: 'Connected successfully to backend API!' });
      } else {
        setTestResult({ success: false, msg: 'Server responded with an error.' });
      }
    } catch (err) {
      setTestResult({ success: false, msg: err.message || 'Cannot reach server' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setServerUrl(urlInput);
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Backend Server Host</span>
          </div>
          <button onClick={onClose} className="text-slate-400 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Configure the backend API server address. When running on Android phone, use your computer's local Wi-Fi IP (e.g. <span className="font-mono text-emerald-300">http://192.168.1.14:5000</span>).
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300">Server URL</label>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="http://192.168.1.14:5000"
            className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Quick IP Presets */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => setUrlInput('http://localhost:5000')}
            className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-mono"
          >
            localhost:5000
          </button>
          <button
            type="button"
            onClick={() => setUrlInput('http://10.0.2.2:5000')}
            className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-mono"
          >
            10.0.2.2:5000 (Emulator)
          </button>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
            testResult.success
              ? 'bg-emerald-950 border border-emerald-500/60 text-emerald-300'
              : 'bg-rose-950 border border-rose-500/60 text-rose-300'
          }`}>
            {testResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{testResult.msg}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing...' : 'Test Connection'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="py-2.5 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-950"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
