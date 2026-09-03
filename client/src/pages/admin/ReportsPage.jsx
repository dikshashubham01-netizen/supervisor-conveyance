import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatDistance, formatDate, formatTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/Badge';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  Users,
  Search,
  RefreshCw,
  FileText
} from 'lucide-react';

export function ReportsPage() {
  const [reportRows, setReportRows] = useState([]);
  const [totals, setTotals] = useState({ totalApprovedKm: 0, totalConveyance: 0 });
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState('ALL');

  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useEffect(() => {
    // Load supervisors for filter dropdown
    api.supervisors.list().then((res) => setSupervisors(res.supervisors || [])).catch(() => {});
  }, []);

  const fetchReports = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await api.reports.get({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        supervisorId: supervisorId || undefined,
        employeeId: employeeId || undefined,
        status: status !== 'ALL' ? status : undefined
      });

      setReportRows(res.reportRows || []);
      setTotals(res.totals || { totalApprovedKm: 0, totalConveyance: 0 });
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(true);

    // Auto-refresh reports every 10 seconds
    const interval = setInterval(() => {
      fetchReports(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [startDate, endDate, supervisorId, status]);

  // Download links
  const queryParams = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    supervisorId: supervisorId || undefined,
    employeeId: employeeId || undefined,
    status: status !== 'ALL' ? status : undefined
  };

  // Helper: authenticated file download using fetch + blob
  const downloadWithAuth = async (url, filename) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(`Download error: ${err.message}`);
    }
  };

  const handleExportCsv = () => {
    const filename = `Conveyance_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadWithAuth(api.reports.getCsvUrl(queryParams), filename);
  };

  const handleExportExcel = () => {
    const filename = `Conveyance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    downloadWithAuth(api.reports.getExcelUrl(queryParams), filename);
  };

  const setPresetRange = (preset) => {
    const today = new Date();
    const toDateStr = (d) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(toDateStr(today));
      setEndDate(toDateStr(today));
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(today.getDate() - 1);
      setStartDate(toDateStr(y));
      setEndDate(toDateStr(y));
    } else if (preset === 'week') {
      const w = new Date();
      w.setDate(today.getDate() - 7);
      setStartDate(toDateStr(w));
      setEndDate(toDateStr(today));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Daily Conveyance Reports</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-normal flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Auto-Sync
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Filter, verify, and export official 13-column conveyance audit records
          </p>
        </div>

        {/* Export Buttons & Refresh */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => fetchReports(true)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
            title="Refresh Reports"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Totals Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Filtered Duties</span>
          <span className="text-2xl font-black font-mono text-white mt-1 block">
            {reportRows.length}
          </span>
        </div>
        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Total Approved Travel</span>
          <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">
            {formatDistance(totals.totalApprovedKm)}
          </span>
        </div>
        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Total Conveyance Reimbursement</span>
          <span className="text-2xl font-black font-mono text-brand-400 mt-1 block">
            {formatCurrency(totals.totalConveyance)}
          </span>
        </div>
      </div>

      {/* Filters Box */}
      <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-brand-400" />
            Report Filters
          </span>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPresetRange('today')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPresetRange('yesterday')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setPresetRange('week')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setPresetRange('all')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              All Time
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-slate-400 block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Supervisor</label>
            <select
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            >
              <option value="">All Supervisors</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.employee_id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Employee ID Search</label>
            <input
              type="text"
              placeholder="e.g. EMP001"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchReports()}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Approval Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
              <option value="REJECTED">Rejected</option>
              <option value="ON_DUTY">On Duty</option>
            </select>
          </div>
        </div>
      </div>

      {/* 13-COLUMN REPORT TABLE (Specification 20) */}
      <div className="bg-slate-850 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-900/80">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Supervisor</th>
                <th className="py-3 px-3">Employee ID</th>
                <th className="py-3 px-3">Start Time</th>
                <th className="py-3 px-3">End Time</th>
                <th className="py-3 px-3">Start KM</th>
                <th className="py-3 px-3">End KM</th>
                <th className="py-3 px-3">GPS KM</th>
                <th className="py-3 px-3">Odometer KM</th>
                <th className="py-3 px-3">Approved KM</th>
                <th className="py-3 px-3">Rate</th>
                <th className="py-3 px-3">Conveyance</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-500 font-sans">
                    No report records found matching the query.
                  </td>
                </tr>
              ) : (
                reportRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50 transition">
                    <td className="py-2.5 px-3 font-sans text-slate-200">{row['Date']}</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-white">{row['Supervisor']}</td>
                    <td className="py-2.5 px-3 text-slate-300">{row['Employee ID']}</td>
                    <td className="py-2.5 px-3 text-slate-300">{row['Start Time']}</td>
                    <td className="py-2.5 px-3 text-slate-300">{row['End Time']}</td>
                    <td className="py-2.5 px-3 text-slate-300">{row['Start KM']}</td>
                    <td className="py-2.5 px-3 text-slate-300">{row['End KM']}</td>
                    <td className="py-2.5 px-3 text-emerald-400">{row['GPS KM']}</td>
                    <td className="py-2.5 px-3 text-blue-400">{row['Odometer KM']}</td>
                    <td className="py-2.5 px-3 font-bold text-white">{row['Approved KM']}</td>
                    <td className="py-2.5 px-3 text-slate-400">{row['Rate']}</td>
                    <td className="py-2.5 px-3 font-bold text-brand-300">{row['Conveyance']}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <StatusBadge status={row['Status']} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
