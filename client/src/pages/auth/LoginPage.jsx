import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigation, Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, RefreshCw, Server } from 'lucide-react';

const SERVER_URL = 'https://supervisor-api-vvba.onrender.com';

async function pingServer() {
  try {
    const res = await fetch(`${SERVER_URL}/api/app/version`, { signal: AbortSignal.timeout(10000) });
    if (res.status === 503) return 'suspended';
    if (res.ok) return 'online';
    return 'error';
  } catch {
    return 'offline';
  }
}

export function LoginPage({ onGoToDownload }) {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState(null); // null | 'checking' | 'online' | 'waking' | 'suspended'
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryTimerRef = useRef(null);
  const countdownRef = useRef(null);

  // On mount, do a quick server ping
  useEffect(() => {
    let mounted = true;
    async function checkOnMount() {
      const status = await pingServer();
      if (!mounted) return;
      if (status === 'online') setServerStatus('online');
      else if (status === 'suspended') setServerStatus('suspended');
      // if offline/error on mount, don't show anything yet — let login attempt trigger it
    }
    checkOnMount();
    return () => {
      mounted = false;
      clearTimeout(retryTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  const startWakeupRetry = () => {
    setServerStatus('waking');
    setRetryCountdown(30);

    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(async () => {
      clearInterval(countdownRef.current);
      const status = await pingServer();
      if (status === 'online') {
        setServerStatus('online');
        setError(null);
      } else if (status === 'suspended') {
        setServerStatus('suspended');
        setError(null);
      } else {
        // Still not up — retry again
        startWakeupRetry();
      }
    }, 30000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const id = employeeId.trim();
    const pw = password.trim();

    if (!id || !pw) {
      setError('Please enter both email/ID and password.');
      setLoading(false);
      return;
    }

    try {
      await login(id, pw);
    } catch (err) {
      const msg = err.message || '';
      if (
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('fetch') ||
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('load failed')
      ) {
        // Detect if server is suspended or just sleeping
        const status = await pingServer();
        if (status === 'suspended') {
          setServerStatus('suspended');
        } else {
          startWakeupRetry();
        }
        setError(null);
      } else if (
        msg.toLowerCase().includes('401') ||
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('credentials') ||
        msg.toLowerCase().includes('unauthorized')
      ) {
        setError('Incorrect email or password. Please check and try again.');
      } else if (msg.toLowerCase().includes('503') || msg.toLowerCase().includes('suspended')) {
        setServerStatus('suspended');
        setError(null);
      } else {
        setError(msg || 'Login failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md flex flex-col gap-6 relative z-10">
        {/* Branding */}
        <div className="text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-700 to-emerald-400 flex items-center justify-center shadow-xl mb-3">
            <Navigation className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">GeoConvey</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Admin Operations Portal &amp; Conveyance System
          </p>
        </div>

        {/* Server Waking Up Banner */}
        {serverStatus === 'waking' && (
          <div className="p-4 rounded-2xl flex flex-col gap-2" style={{ backgroundColor: '#1c1708', border: '1px solid #92400e' }}>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
              <span className="text-amber-300 font-bold text-sm">Server is waking up...</span>
            </div>
            <p className="text-amber-200/70 text-xs leading-relaxed">
              The backend server was in sleep mode (Render.com free tier). It is now starting up — this takes about 30 seconds.
            </p>
            {retryCountdown > 0 && (
              <div className="flex items-center justify-between mt-1 gap-3">
                <span className="text-amber-400/60 text-xs whitespace-nowrap">Auto-retrying in {retryCountdown}s...</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-1000"
                    style={{ width: `${((30 - retryCountdown) / 30) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                clearTimeout(retryTimerRef.current);
                clearInterval(countdownRef.current);
                setServerStatus(null);
                setError(null);
              }}
              className="mt-1 text-xs text-amber-400 hover:text-amber-300 underline text-left w-fit"
            >
              Cancel and try manually
            </button>
          </div>
        )}

        {/* Server Suspended Banner */}
        {serverStatus === 'suspended' && (
          <div className="p-4 rounded-2xl flex flex-col gap-2" style={{ backgroundColor: '#1f1215', border: '1px solid #be123c' }}>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-rose-300 font-bold text-sm">Backend Server Suspended</span>
            </div>
            <p className="text-rose-200/70 text-xs leading-relaxed">
              The Render.com backend has been suspended — this happens when free-tier monthly hours are exhausted or due to an account issue.
            </p>
            <p className="text-rose-200/60 text-xs font-semibold mt-1">
              ➜ Go to{' '}
              <a href="https://dashboard.render.com" target="_blank" rel="noopener noreferrer" className="text-rose-300 underline">
                dashboard.render.com
              </a>{' '}
              → find your service → click <strong className="text-rose-300">Resume Service</strong>.
            </p>
            <button
              type="button"
              onClick={async () => {
                setServerStatus('checking');
                const status = await pingServer();
                if (status === 'online') {
                  setServerStatus('online');
                } else if (status === 'suspended') {
                  setServerStatus('suspended');
                } else {
                  startWakeupRetry();
                }
              }}
              className="mt-2 w-full py-2 rounded-xl text-rose-300 font-bold text-xs border border-rose-500/40 hover:bg-rose-950/40 transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Check Again
            </button>
          </div>
        )}

        {/* Server Online Indicator */}
        {serverStatus === 'online' && (
          <div className="px-3 py-2 rounded-xl flex items-center gap-2" style={{ backgroundColor: '#052e16', border: '1px solid #16a34a' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-emerald-400 text-xs font-semibold">Server is online and ready</span>
          </div>
        )}

        {/* Login Card */}
        <div className="rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-5" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
          <div className="pb-3" style={{ borderBottom: '1px solid #334155' }}>
            <h2 className="text-lg font-bold text-white tracking-tight">Administrator Login</h2>
            <p className="text-xs text-slate-400 mt-0.5">Sign in to manage supervisors, view live tracks, and review conveyance</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl text-rose-300 text-xs flex items-start gap-2" style={{ backgroundColor: '#450a0a', border: '1px solid #ef4444' }}>
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off">
            {/* Admin Email/ID */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5 text-sm">Admin Email / ID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="soumya.ghosh@genus.in"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono focus:outline-none transition"
                  style={{ backgroundColor: '#0f172a', border: '1.5px solid #475569' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5 text-sm">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl pl-10 pr-12 py-3 text-sm text-white focus:outline-none transition"
                  style={{ backgroundColor: '#0f172a', border: '1.5px solid #475569' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || serverStatus === 'waking' || serverStatus === 'suspended' || serverStatus === 'checking'}
              className="mt-2 w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(to right, #16a34a, #059669)' }}
            >
              <span>
                {loading
                  ? 'Authenticating Admin...'
                  : serverStatus === 'waking'
                  ? `Server waking up... (${retryCountdown}s)`
                  : serverStatus === 'suspended'
                  ? 'Server Suspended — See Banner Above'
                  : serverStatus === 'checking'
                  ? 'Checking server...'
                  : 'Sign In as Administrator'}
              </span>
              {loading || serverStatus === 'waking' || serverStatus === 'checking'
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : serverStatus !== 'suspended'
                ? <ArrowRight className="w-4 h-4" />
                : null}
            </button>
          </form>

          {/* Supervisor App Download */}
          <div className="pt-4 flex flex-col gap-2.5" style={{ borderTop: '1px solid #334155' }}>
            <div className="p-3 rounded-2xl text-xs flex flex-col gap-2.5" style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}>
              <div className="flex items-start gap-2">
                <span className="text-base">📱</span>
                <div>
                  <strong className="text-white block font-semibold text-xs">Supervisor Mobile App</strong>
                  <span className="text-slate-400 text-[11px]">Supervisors must use the Android app to record GPS travel &amp; odometers.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onGoToDownload || (() => window.location.href = '/download')}
                className="w-full py-2.5 px-3 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95"
                style={{ background: 'linear-gradient(to right, #16a34a, #059669)' }}
              >
                <span>Download Android APK</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
