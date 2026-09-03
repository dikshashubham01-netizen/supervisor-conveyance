import React, { useState, useEffect } from 'react';
import { api, getServerUrl, setServerUrl } from '../../api/client';
import { Server, Check, X, AlertCircle, RefreshCw } from 'lucide-react';

const LIVE_RENDER_URL = 'https://supervisor-api-vvba.onrender.com';

export function ServerConfigModal({ isOpen, onClose }) {
  const [urlInput, setUrlInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(getServerUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await api.checkConnection(urlInput);
      if (ok) {
        setTestResult({ success: true, msg: '✅ Connected to backend API successfully!' });
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

  const handleReset = () => {
    setUrlInput(LIVE_RENDER_URL);
    setServerUrl(LIVE_RENDER_URL);
    setTestResult({ success: true, msg: '✅ Reset to live production server!' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid #334155' }}>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Backend Server Settings</span>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
          The app is connected to the <strong className="text-emerald-400">live cloud backend</strong>. Only change this if instructed by your Admin.
        </div>

        {/* Current live server badge */}
        <div className="p-2.5 rounded-xl text-xs flex items-center gap-2" style={{ backgroundColor: '#052e16', border: '1px solid #166534', color: '#86efac' }}>
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <div>
            <strong className="text-emerald-300 block">Live Production Server</strong>
            <span className="font-mono text-[10px]">{LIVE_RENDER_URL}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: '#cbd5e1' }}>Custom Server URL (optional)</label>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://supervisor-api-vvba.onrender.com"
            style={{ backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#475569' }}
            className="w-full rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none border-2"
          />
        </div>

        {testResult && (
          <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2`}
            style={{
              backgroundColor: testResult.success ? '#052e16' : '#450a0a',
              border: `1px solid ${testResult.success ? '#166534' : '#7f1d1d'}`,
              color: testResult.success ? '#86efac' : '#fca5a5'
            }}>
            {testResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{testResult.msg}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="py-2.5 px-2 rounded-xl text-xs font-semibold"
            style={{ backgroundColor: '#1e3a2e', border: '1px solid #166534', color: '#86efac' }}
          >
            Reset Live
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="py-2.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
            style={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? '...' : 'Test'}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="py-2.5 px-2 rounded-xl text-xs font-bold text-white"
            style={{ background: 'linear-gradient(to right, #16a34a, #15803d)' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
