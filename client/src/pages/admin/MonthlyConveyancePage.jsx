import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatDistance } from '../../utils/formatters';
import {
  Bike,
  Download,
  RefreshCw,
  Search,
  Filter,
  TrendingUp,
  MapPin,
  FileSpreadsheet
} from 'lucide-react';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const YEAR_OPTIONS = [2025, 2026, 2027];

export function MonthlyConveyancePage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [supervisorId, setSupervisorId] = useState('');
  const [employeeIdSearch, setEmployeeIdSearch] = useState('');

  const [supervisors, setSupervisors] = useState([]);
  const [conveyanceData, setConveyanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Load supervisors for filter dropdown
  useEffect(() => {
    api.supervisors
      .list()
      .then((res) => setSupervisors(res.supervisors || []))
      .catch(() => {});
  }, []);

  // Fetch Conveyance Matrix
  const fetchConveyance = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await api.attendance.getMonthlyConveyance({
        year: selectedYear,
        month: selectedMonth,
        supervisorId: supervisorId || undefined,
        employeeId: employeeIdSearch || undefined
      });
      setConveyanceData(res);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load monthly conveyance:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConveyance(true);
  }, [selectedYear, selectedMonth, supervisorId]);

  // Authenticated Excel Download
  const handleExportExcel = async () => {
    try {
      setDownloading(true);
      const url = api.attendance.getConveyanceExcelUrl({
        year: selectedYear,
        month: selectedMonth,
        supervisorId: supervisorId || undefined,
        employeeId: employeeIdSearch || undefined
      });
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const monthName = MONTH_OPTIONS.find((m) => m.value === Number(selectedMonth))?.label || 'Month';
      a.download = `Conveyance_Monthly_${monthName}_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert('Failed to export Excel: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const summary = conveyanceData?.summary || {
    totalEmployees: 0,
    totalKm: 0,
    totalConveyance: 0,
    averageKmPerEmployee: 0
  };

  const dayColumns = conveyanceData?.dayColumns || [];
  const rows = conveyanceData?.rows || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Bike className="w-7 h-7 text-brand-400" />
            <span>Monthly Conveyance Report</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Day-wise approved travel KM and conveyance reimbursement per supervisor
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchConveyance(false)}
            title="Refresh Conveyance"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={downloading || rows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition shadow-lg shadow-brand-950 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Exporting...' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Total Supervisors</span>
          <span className="text-2xl font-black font-mono text-white mt-1 block">
            {summary.totalEmployees}
          </span>
        </div>

        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Total Approved Travel</span>
          <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">
            {formatDistance(summary.totalKm)}
          </span>
        </div>

        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Total Conveyance Reimbursement</span>
          <span className="text-2xl font-black font-mono text-brand-400 mt-1 block">
            {formatCurrency(summary.totalConveyance)}
          </span>
        </div>

        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Average KM / Supervisor</span>
          <span className="text-2xl font-black font-mono text-blue-400 mt-1 block">
            {formatDistance(summary.averageKmPerEmployee)}
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] mr-2">
          <Filter className="w-3.5 h-3.5 text-brand-400" />
          <span>Filters</span>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400">Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-brand-500"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-brand-500"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Supervisor Filter */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400">Supervisor:</label>
          <select
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-brand-500 max-w-[180px] truncate"
          >
            <option value="">All Supervisors</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.employee_id})
              </option>
            ))}
          </select>
        </div>

        {/* Employee ID Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search Employee ID..."
              value={employeeIdSearch}
              onChange={(e) => setEmployeeIdSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchConveyance()}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-white focus:outline-none focus:border-brand-500 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => fetchConveyance()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium"
          >
            Search
          </button>
        </div>
      </div>

      {/* Day-wise Conveyance Table */}
      <div className="bg-slate-850 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
            <thead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm">
              <tr className="text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-3.5 sticky left-0 z-30 bg-slate-900 min-w-[180px] border-r border-slate-800">
                  Installation Field Engg Name
                </th>
                <th className="py-3 px-3 text-center bg-slate-900 min-w-[100px] border-r border-slate-800">
                  Employee ID
                </th>
                {dayColumns.map((col) => (
                  <th
                    key={col.dayNumber}
                    className="py-3 px-2 text-center min-w-[48px] font-mono bg-slate-900 text-slate-300"
                  >
                    <div>{col.header.split('-')[0]}</div>
                    <div className="text-[9px] text-slate-500 font-sans">{col.header.split('-')[1]}</div>
                  </th>
                ))}
                <th className="py-3 px-3 text-center bg-slate-900 min-w-[90px] border-l border-slate-800 text-emerald-400 font-bold">
                  Total KM
                </th>
                <th className="py-3 px-3 text-center bg-slate-900 min-w-[110px] text-brand-400 font-bold">
                  Total Conveyance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={4 + dayColumns.length} className="py-12 text-center text-slate-400 font-sans">
                    <div className="inline-block w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading monthly conveyance records...</div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4 + dayColumns.length} className="py-10 text-center text-slate-500 font-sans">
                    No supervisor records found matching query.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.supervisorId} className="hover:bg-slate-800/40 transition">
                    {/* Sticky Installation Field Engg Name */}
                    <td className="py-2.5 px-3.5 font-sans font-bold text-white sticky left-0 z-10 bg-slate-850 border-r border-slate-800 truncate max-w-[200px]">
                      {row.name}
                    </td>

                    {/* Employee ID */}
                    <td className="py-2.5 px-3 text-center text-slate-300 border-r border-slate-800 font-semibold">
                      {row.employeeId}
                    </td>

                    {/* Day-wise Approved KM */}
                    {dayColumns.map((col) => {
                      const km = row.dailyKm[col.header] ?? 0;
                      return (
                        <td key={col.dayNumber} className="py-2 px-1 text-center">
                          <span
                            className={`inline-block min-w-[36px] px-1 py-0.5 rounded text-[10px] ${
                              km > 0
                                ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30'
                                : 'text-slate-600'
                            }`}
                          >
                            {km > 0 ? km.toFixed(1) : '0'}
                          </span>
                        </td>
                      );
                    })}

                    {/* Total KM */}
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-400 bg-emerald-950/20 border-l border-slate-800">
                      {row.totalKm.toFixed(2)} KM
                    </td>

                    {/* Total Conveyance */}
                    <td className="py-2.5 px-3 text-center font-bold text-brand-300 bg-brand-950/20">
                      {formatCurrency(row.totalConveyance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Note: Daily KM reflects verified and approved travel distance for successfully completed duties.</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Timezone: Asia/Kolkata (IST)
          </div>
        </div>
      </div>
    </div>
  );
}
