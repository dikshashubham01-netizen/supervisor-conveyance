import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigation, Lock, User, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

export function LoginPage({ onGoToDownload }) {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setError('Cannot reach server. The server may be waking up — please wait 30 seconds and try again.');
      } else if (msg.toLowerCase().includes('401') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        setError('Incorrect email or password. Please check and try again.');
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
            Admin Operations Portal & Conveyance System
          </p>
        </div>

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
              disabled={loading}
              className="mt-2 w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(to right, #16a34a, #059669)' }}
            >
              <span>{loading ? 'Authenticating Admin...' : 'Sign In as Administrator'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Supervisor App Download */}
          <div className="pt-4 flex flex-col gap-2.5" style={{ borderTop: '1px solid #334155' }}>
            <div className="p-3 rounded-2xl text-xs flex flex-col gap-2.5" style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}>
              <div className="flex items-start gap-2">
                <span className="text-base">📱</span>
                <div>
                  <strong className="text-white block font-semibold text-xs">Supervisor Mobile App</strong>
                  <span className="text-slate-400 text-[11px]">Supervisors must use the Android app to record GPS travel & odometers.</span>
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
