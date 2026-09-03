import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigation, Lock, User, Shield, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(employeeId, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (empId, pass) => {
    setEmployeeId(empId);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-brand-500 selection:text-white relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md flex flex-col gap-6 relative z-10">
        {/* Branding header */}
        <div className="text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-950/60 mb-3">
            <Navigation className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">GeoConvey</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Admin Operations Portal & Conveyance System
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl flex flex-col gap-5">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Administrator Login</h2>
            <p className="text-xs text-slate-400 mt-0.5">Sign in to manage supervisors, view live tracks, and review conveyance</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">
                Admin Email / ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="soumya.ghosh@genus.in"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-750 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-750 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/80 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating Admin...' : 'Sign In as Administrator'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Credential Filler for Soumya Ghosh */}
          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => fillCredentials('soumya.ghosh@genus.in', 'Soumya@123')}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs border border-slate-700/80 text-left transition flex items-center justify-between"
            >
              <div>
                <strong className="text-brand-400 block text-[11px] uppercase tracking-wider">Fill Admin Credentials</strong>
                <span className="text-slate-300 font-mono text-xs">soumya.ghosh@genus.in</span>
              </div>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </button>

            {/* Notice that Supervisor Login is on Mobile App Only */}
            <div className="p-2.5 rounded-xl bg-slate-850/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
              <span className="text-sm">📱</span>
              <div>
                <strong className="text-slate-300 block">Supervisor Login Notice:</strong>
                <span>Supervisors can only log in through the <strong>Supervisor Android Mobile App</strong> to record GPS travel & odometers.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
