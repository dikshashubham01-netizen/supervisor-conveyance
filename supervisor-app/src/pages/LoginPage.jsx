import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ServerConfigModal } from '../components/common/ServerConfigModal';
import { Navigation, User, Lock, ArrowRight, Settings, AlertCircle, Sparkles } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);

  const handleLogin = async (e) => {
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

  const fill = (emp, pass) => {
    setEmployeeId(emp);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-5 relative overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/60">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">GeoConvey</span>
        </div>

        <button
          type="button"
          onClick={() => setIsServerModalOpen(true)}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          title="Server Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-sm mx-auto my-auto flex flex-col gap-6 z-10">
        <div className="text-center">
          <h1 className="text-2xl font-black text-white tracking-tight">Supervisor Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Attendance, Bike Odometer & GPS Tracking</p>
        </div>

        <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800/90 shadow-2xl flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-3.5 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Employee ID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP001"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-750 rounded-xl pl-9 pr-3 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-750 rounded-xl pl-9 pr-3 py-3 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-brand-600 hover:from-emerald-500 hover:to-brand-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/80 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Fillers */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-1.5 text-slate-400">
            <span className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Demo Supervisor Logins:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => fill('EMP001', 'supervisor123')}
                className="p-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-left border border-slate-800"
              >
                <span className="font-bold text-emerald-400 block">EMP001</span>
                <span className="text-[10px] text-slate-500 font-mono">John Doe</span>
              </button>
              <button
                type="button"
                onClick={() => fill('EMP003', 'supervisor123')}
                className="p-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-left border border-slate-800"
              >
                <span className="font-bold text-blue-400 block">EMP003</span>
                <span className="text-[10px] text-slate-500 font-mono">Amit Patel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-600 py-2">
        GeoConvey Supervisor Native App • v1.0
      </div>

      <ServerConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
    </div>
  );
}
