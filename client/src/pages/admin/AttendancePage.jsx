import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  Calendar,
  Users,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  UserCheck
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

export function AttendancePage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [supervisorId, setSupervisorId] = useState('');
  const [employeeIdSearch, setEmployeeIdSearch] = useState('');

  const [supervisors, setSupervisors] = useState([]);
  const [attendanceData, setAttendanceData] = useState(null);
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

  // Fetch Attendance Matrix
  const fetchAttendance = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await api.attendance.getMonthly({
        year: selectedYear,
        month: selectedMonth,
        supervisorId: supervisorId || undefined,
        employeeId: employeeIdSearch || undefined
      });
      setAttendanceData(res);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance(true);
  }, [selectedYear, selectedMonth, supervisorId]);

  // Authenticated Excel Download
  const handleExportExcel = async () => {
    try {
      setDownloading(true);
      const url = api.attendance.getExcelUrl({
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
      a.download = `Attendance_Report_${monthName}_${selectedYear}.xlsx`;
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

  const summary = attendanceData?.summary || {
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    weeklyOffToday: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalWorkingDays: 0,
    attendancePercent: 0
  };

  const dayColumns = attendanceData?.dayColumns || [];
  const rows = attendanceData?.rows || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-emerald-400" />
            <span>Monthly Attendance Matrix</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Day-wise employee attendance tracking (P = Present, A = Absent, WO = Weekly Off)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchAttendance(false)}
            title="Refresh Attendance"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={downloading || rows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Exporting...' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Total Supervisors</span>
          <span className="text-2xl font-black font-mono text-white mt-1 block">
            {summary.totalEmployees}
          </span>
        </div>

        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Present Today</span>
          <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">
            {summary.presentToday}
          </span>
        </div>

        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Absent Today</span>
          <span className="text-2xl font-black font-mono text-rose-400 mt-1 block">
            {summary.absentToday}
          </span>
        </div>

        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block font-medium">Weekly Off Today</span>
          <span className="text-2xl font-black font-mono text-slate-300 mt-1 block">
            {summary.weeklyOffToday}
          </span>
        </div>

        <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-400 block font-medium">Attendance Rate</span>
          <span className="text-2xl font-black font-mono text-brand-400 mt-1 block">
            {summary.attendancePercent}%
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
              onKeyDown={(e) => e.key === 'Enter' && fetchAttendance()}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-white focus:outline-none focus:border-brand-500 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => fetchAttendance()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium"
          >
            Search
          </button>
        </div>
      </div>

      {/* Day-wise Attendance Table (Template Style) */}
      <div className="bg-slate-850 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
            <thead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shadow-sm">
              <tr className="text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-3.5 sticky left-0 z-30 bg-slate-900 min-w-[180px] border-r border-slate-800">
                  Installation Field Engg Name
                </th>
                <th className="py-3 px-3 text-center bg-slate-900 min-w-[60px]">Total</th>
                <th className="py-3 px-3 text-center bg-slate-900 min-w-[80px]">Grand Total</th>
                <th className="py-3 px-3 text-center bg-slate-900 min-w-[110px]">Input Present Day</th>
                <th className="py-3 px-3 text-center bg-slate-900 min-w-[100px] border-r border-slate-800">
                  Employee ID
                </th>
                {dayColumns.map((col) => (
                  <th
                    key={col.dayNumber}
                    className={`py-3 px-2 text-center min-w-[42px] font-mono ${
                      col.isWeeklyOff ? 'bg-slate-950 text-slate-500' : 'bg-slate-900 text-slate-300'
                    }`}
                  >
                    <div>{col.header.split('-')[0]}</div>
                    <div className="text-[9px] text-slate-500 font-sans">{col.header.split('-')[1]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={5 + dayColumns.length} className="py-12 text-center text-slate-400 font-sans">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading attendance records...</div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5 + dayColumns.length} className="py-10 text-center text-slate-500 font-sans">
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

                    {/* Total Present Days */}
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-400 bg-emerald-950/20">
                      {row.total}
                    </td>

                    {/* Grand Total Working Days */}
                    <td className="py-2.5 px-3 text-center text-slate-300">
                      {row.grandTotal}
                    </td>

                    {/* Input Present Day */}
                    <td className="py-2.5 px-3 text-center font-bold text-brand-300 bg-brand-950/20">
                      {row.inputPresentDay}
                    </td>

                    {/* Employee ID */}
                    <td className="py-2.5 px-3 text-center text-slate-300 border-r border-slate-800 font-semibold">
                      {row.employeeId}
                    </td>

                    {/* Daily Status Columns */}
                    {dayColumns.map((col) => {
                      const code = row.dailyStatus[col.header] || '-';
                      let badgeClass = 'text-slate-600';

                      if (code === 'P') {
                        badgeClass = 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30';
                      } else if (code === 'A') {
                        badgeClass = 'bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30';
                      } else if (code === 'WO') {
                        badgeClass = 'bg-slate-800/60 text-slate-400 font-medium';
                      }

                      return (
                        <td
                          key={col.dayNumber}
                          className={`py-2 px-1 text-center ${
                            col.isWeeklyOff ? 'bg-slate-950/40' : ''
                          }`}
                        >
                          <span
                            className={`inline-block w-7 py-0.5 rounded text-[10px] text-center ${badgeClass}`}
                          >
                            {code}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend Footer */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-300">Legend:</span>
            <span className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/40">P</span>
              <span>Present (Completed Same-Day Duty)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/40">A</span>
              <span>Absent (No Duty / Auto-ended Incomplete)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold text-[10px]">WO</span>
              <span>Weekly Off (Sunday)</span>
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Timezone: Asia/Kolkata (IST)
          </div>
        </div>
      </div>
    </div>
  );
}
