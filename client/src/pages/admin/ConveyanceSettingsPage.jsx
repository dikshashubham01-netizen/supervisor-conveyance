import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Settings, IndianRupee, ShieldCheck, Check, AlertCircle, RefreshCw } from 'lucide-react';

export function ConveyanceSettingsPage() {
  const [currentRate, setCurrentRate] = useState(4.50);
  const [effectiveFrom, setEffectiveFrom] = useState(null);
  const [newRateInput, setNewRateInput] = useState('4.50');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchRate = async () => {
    try {
      setLoading(true);
      const res = await api.settings.getRate();
      setCurrentRate(res.rate);
      setNewRateInput(String(res.rate));
      setEffectiveFrom(res.effectiveFrom);
    } catch (err) {
      console.error('Failed to load rate:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRate();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const parsed = parseFloat(newRateInput);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg('Please enter a valid positive rate.');
      return;
    }

    try {
      setSaving(true);
      const res = await api.settings.updateRate(parsed);
      setCurrentRate(res.rate);
      setEffectiveFrom(res.effectiveFrom);
      setSuccessMsg(`Rate updated to ₹${res.rate.toFixed(2)}/KM successfully! Past duty records remain protected.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update rate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Conveyance Settings</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure vehicle reimbursement rates per kilometer
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="bg-slate-850 rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col gap-6">
        {/* Current Active Rate Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-700/80">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Active Vehicle Type
            </span>
            <div className="text-xl font-bold text-white mt-0.5">🏍️ Bike Conveyance</div>
            {effectiveFrom && (
              <span className="text-xs text-slate-400 block mt-1">
                Effective Since: {formatDateTime(effectiveFrom)}
              </span>
            )}
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Current Rate
            </span>
            <span className="text-3xl font-black font-mono text-emerald-400">
              ₹{Number(currentRate).toFixed(2)} / KM
            </span>
          </div>
        </div>

        {/* Update Form */}
        <form onSubmit={handleUpdate} className="flex flex-col gap-4 text-xs">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Update Bike Rate</h3>

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="text-slate-300 font-semibold block mb-1.5">
              New Rate per Kilometer (₹) *
            </label>
            <div className="flex items-center gap-2 max-w-xs">
              <div className="relative w-full">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                <input
                  type="number"
                  step="0.10"
                  min="0.10"
                  required
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-base font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <span className="text-slate-400 font-semibold">/ KM</span>
            </div>
          </div>

          {/* Historical Rate Protection Notice (Specification 16) */}
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-200 text-xs flex items-start gap-3 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">Historical Rate Locking Guarantee</strong>
              When this rate is updated, previously completed duty sessions are strictly protected and will permanently retain the exact rate that was effective when those duties were completed.
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950 transition disabled:opacity-50"
            >
              {saving ? 'Updating Rate...' : 'Save New Conveyance Rate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
