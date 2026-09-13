import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDuty } from '../../context/DutyContext';
import { api } from '../../api/client';
import {
  User,
  Phone,
  Hash,
  Key,
  Lock,
  LogOut,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';

export function ProfileModal({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { isOnDuty } = useDuty();

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  if (!isOpen) return null;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    try {
      setSubmittingPassword(true);
      await api.auth.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleLogout = () => {
    if (isOnDuty) {
      const confirmed = window.confirm(
        'You have an active duty session in progress! Are you sure you want to log out? Your session remains active on the server.'
      );
      if (!confirmed) return;
    }
    logout();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 text-white font-bold text-base">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
              <User className="w-4 h-4" />
            </div>
            <span>My Profile</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info Card */}
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex flex-col gap-3">
          {/* User Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 font-bold text-base">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-bold text-sm truncate">{user?.name || 'Supervisor'}</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="capitalize">{user?.role || 'Supervisor'}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2 text-xs">
            {/* Employee ID */}
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                Employee ID
              </span>
              <span className="text-slate-200 font-mono font-semibold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {user?.employee_id || 'N/A'}
              </span>
            </div>

            {/* Mobile Number */}
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                Mobile Number
              </span>
              <span className="text-slate-200 font-mono font-semibold">
                {user?.phone || 'Not Registered'}
              </span>
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-slate-200 font-bold text-xs uppercase tracking-wider">
            <Key className="w-3.5 h-3.5 text-brand-400" />
            <span>Change Password</span>
          </div>

          {passwordSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="flex flex-col gap-2.5">
            {/* Current Password */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">
                New Password (min 6 characters)
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">
                Confirm New Password
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="mt-1 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{submittingPassword ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-2.5 px-4 rounded-2xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-300 font-semibold text-xs transition flex items-center justify-center gap-2 active:scale-98"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out / Logout</span>
        </button>
      </div>
    </div>
  );
}
