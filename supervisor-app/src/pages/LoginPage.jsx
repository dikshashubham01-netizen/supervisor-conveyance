import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ServerConfigModal } from '../components/common/ServerConfigModal';
import { Navigation, User, Lock, ArrowRight, Settings, AlertCircle, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(employeeId.trim(), password);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col justify-between p-5 relative overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-green-600 to-emerald-400 flex items-center justify-center shadow-lg">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">GeoConvey</span>
        </div>

        <button
          type="button"
          onClick={() => setIsServerModalOpen(true)}
          className="p-2 rounded-xl bg-[#1e293b] border border-[#334155] text-[#94a3b8] active:opacity-70"
          title="Server Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-sm mx-auto my-auto flex flex-col gap-6 z-10">
        <div className="text-center">
          <h1 className="text-2xl font-black text-white tracking-tight">Supervisor Portal</h1>
          <p className="text-xs text-[#94a3b8] mt-1">Attendance, Bike Odometer & GPS Tracking</p>
        </div>

        <div className="bg-[#1e293b] rounded-3xl p-6 border border-[#334155] shadow-2xl flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950 border border-red-500 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Employee ID Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[#cbd5e1] font-semibold text-sm">Employee ID</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748b] pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter your Employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="characters"
                  style={{ backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#475569' }}
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm font-mono focus:outline-none border-2"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[#cbd5e1] font-semibold text-sm">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748b] pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#475569' }}
                  className="w-full rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none border-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#64748b] hover:text-[#94a3b8]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
              style={{ background: loading ? '#166534' : 'linear-gradient(to right, #16a34a, #15803d)' }}
            >
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Info note */}
          <div className="pt-3 border-t border-[#334155] text-[11px] text-[#64748b] text-center leading-relaxed">
            Use the <strong className="text-[#94a3b8]">Employee ID</strong> and <strong className="text-[#94a3b8]">Password</strong> provided by your Admin.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-[#475569] py-2">
        GeoConvey Supervisor App • v1.0 • Live Cloud
      </div>

      <ServerConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
    </div>
  );
}
