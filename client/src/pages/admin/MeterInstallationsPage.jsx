import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatDistance, formatDate, formatTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/Badge';
import {
  Zap,
  Calendar,
  Users,
  Search,
  RefreshCw,
  Download,
  Filter,
  Award,
  TrendingUp,
  MapPin,
  Clock,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export function MeterInstallationsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {
      totalMetersInstalled: 0,
      totalApprovedKm: 0,
      totalDuties: 0,
      activeSupervisorsCount: 0
    },
    daySummary: [],
    supervisorSummary: [],
    sessions: []
  });

  // Active view: 'DAY_WISE' | 'SUPERVISOR_WISE' | 'SESSIONS'
  const [viewTab, setViewTab] = useState('DAY_WISE');

  // Filters
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSubdivision, setSelectedSubdivision] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state for sessions
  const [editingSession, setEditingSession] = useState(null);
  const [editCount, setEditCount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Expanded days for day-wise view
  const [expandedDays, setExpandedDays] = useState({});

  // Quick preset handler
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const formatYMD = (d) => d.toISOString().split('T')[0];

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = formatYMD(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = formatYMD(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'WEEK') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      setStartDate(formatYMD(weekAgo));
      setEndDate(formatYMD(today));
    } else if (preset === 'MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(today));
    }
  };

  const fetchReport = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await api.meters.getReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        subdivision: selectedSubdivision || undefined
      });
      setData(res || { summary: {}, daySummary: [], supervisorSummary: [], sessions: [] });
    } catch (err) {
      console.error('Failed to fetch meter report:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(true);
  }, [startDate, endDate, selectedSubdivision]);

  // Extract unique sub-divisions from data for dropdown
  const subDivisions = React.useMemo(() => {
    const set = new Set();
    data.sessions.forEach((s) => {
      if (s.subdivision) set.add(s.subdivision.trim());
    });
    data.supervisorSummary.forEach((s) => {
      if (s.subdivision) set.add(s.subdivision.trim());
    });
    return Array.from(set).sort();
  }, [data]);

  // Filter supervisor summary by search term
  const filteredSupervisorSummary = React.useMemo(() => {
    if (!searchTerm.trim()) return data.supervisorSummary;
    const term = searchTerm.toLowerCase();
    return data.supervisorSummary.filter(
      (s) =>
        s.supervisor_name?.toLowerCase().includes(term) ||
        s.employee_id?.toLowerCase().includes(term) ||
        s.subdivision?.toLowerCase().includes(term)
    );
  }, [data.supervisorSummary, searchTerm]);

  // Filter sessions by search term
  const filteredSessions = React.useMemo(() => {
    if (!searchTerm.trim()) return data.sessions;
    const term = searchTerm.toLowerCase();
    return data.sessions.filter(
      (s) =>
        s.supervisor_name?.toLowerCase().includes(term) ||
        s.employee_id?.toLowerCase().includes(term) ||
        s.subdivision?.toLowerCase().includes(term)
    );
  }, [data.sessions, searchTerm]);

  // Group filtered sessions by day for Day-wise view
  const groupedDays = React.useMemo(() => {
    const map = {};
    filteredSessions.forEach((s) => {
      const d = s.duty_date || 'Unknown';
      if (!map[d]) {
        map[d] = {
          date: d,
          totalMeters: 0,
          totalApprovedKm: 0,
          supervisorsMap: {}
        };
      }
      map[d].totalMeters += Number(s.meters_installed) || 0;
      map[d].totalApprovedKm += Number(s.approved_distance_km) || 0;

      if (!map[d].supervisorsMap[s.supervisor_id]) {
        map[d].supervisorsMap[s.supervisor_id] = {
          supervisor_name: s.supervisor_name,
          employee_id: s.employee_id,
          subdivision: s.subdivision,
          phone: s.phone,
          meters: 0,
          approvedKm: 0,
          sessions: []
        };
      }
      map[d].supervisorsMap[s.supervisor_id].meters += Number(s.meters_installed) || 0;
      map[d].supervisorsMap[s.supervisor_id].approvedKm += Number(s.approved_distance_km) || 0;
      map[d].supervisorsMap[s.supervisor_id].sessions.push(s);
    });

    return Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [filteredSessions]);

  const toggleDayExpanded = (dateStr) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const handleOpenEdit = (session) => {
    setEditingSession(session);
    setEditCount(String(session.meters_installed ?? 0));
    setEditNote('');
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    const countNum = parseInt(editCount, 10);
    if (isNaN(countNum) || countNum < 0) {
      alert('Please enter a valid meter count (>= 0)');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      await api.meters.updateCount(editingSession.id, countNum, editNote);
      setEditingSession(null);
      await fetchReport(false);
    } catch (err) {
      alert('Failed to update meter count: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // CSV Export
  const exportToCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (viewTab === 'DAY_WISE') {
      csvContent += 'Date,Supervisor Name,Employee ID,Sub-Division,Meters Installed,Approved KM\n';
      groupedDays.forEach((d) => {
        Object.values(d.supervisorsMap).forEach((sup) => {
          csvContent += `"${d.date}","${sup.supervisor_name}","${sup.employee_id}","${sup.subdivision || ''}",${sup.meters},${sup.approvedKm.toFixed(2)}\n`;
        });
      });
    } else if (viewTab === 'SUPERVISOR_WISE') {
      csvContent += 'Rank,Supervisor Name,Employee ID,Sub-Division,Total Duties,Total Meters Installed,Avg Meters/Duty,Total Approved KM,Total Conveyance (INR)\n';
      filteredSupervisorSummary.forEach((s, idx) => {
        csvContent += `${idx + 1},"${s.supervisor_name}","${s.employee_id}","${s.subdivision || ''}",${s.total_duties},${s.total_meters},${s.avg_meters_per_duty},${s.total_km},${s.total_conveyance}\n`;
      });
    } else {
      csvContent += 'Date,Supervisor Name,Employee ID,Sub-Division,Meters Installed,Approved KM,Conveyance (INR),Status\n';
      filteredSessions.forEach((s) => {
        csvContent += `"${s.duty_date || ''}","${s.supervisor_name}","${s.employee_id}","${s.subdivision || ''}",${s.meters_installed || 0},${s.approved_distance_km || 0},${s.conveyance_amount || 0},"${s.status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smart_meters_${viewTab.toLowerCase()}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate top installer
  const topInstaller = data.supervisorSummary.length > 0 && Number(data.supervisorSummary[0].total_meters) > 0
    ? data.supervisorSummary[0]
    : null;

  // Calculate today's installed count
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDayObj = data.daySummary.find((d) => d.duty_date === todayStr);
  const todayCount = todayDayObj ? Number(todayDayObj.total_meters) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Smart Meter Installations
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Day-wise & Supervisor-wise smart meter installation counts & performance analytics
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchReport(true)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={exportToCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Installed */}
        <div className="bg-slate-850 rounded-2xl p-4 sm:p-5 border border-cyan-500/30 relative overflow-hidden shadow-lg">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Installed</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">
            {data.summary.totalMetersInstalled?.toLocaleString() || 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">In selected period</span>
        </div>

        {/* Today's Count */}
        <div className="bg-slate-850 rounded-2xl p-4 sm:p-5 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Installed</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            {todayCount.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Live today ({todayStr})</span>
        </div>

        {/* Active Supervisors */}
        <div className="bg-slate-850 rounded-2xl p-4 sm:p-5 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Installers</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">
            {data.summary.activeSupervisorsCount || 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Supervisors deployed</span>
        </div>

        {/* Top Installer */}
        <div className="bg-slate-850 rounded-2xl p-4 sm:p-5 border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Top Installer</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white truncate">
            {topInstaller ? topInstaller.supervisor_name : '---'}
          </div>
          <span className="text-[11px] text-amber-400 font-mono font-bold mt-1 block">
            {topInstaller ? `${topInstaller.total_meters} meters installed` : 'No data yet'}
          </span>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="bg-slate-850 rounded-2xl p-4 border border-slate-800 flex flex-col gap-4">
        {/* Top row: Tab Switcher & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* View Tab Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewTab('DAY_WISE')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewTab === 'DAY_WISE'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Day-Wise Breakdown</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('SUPERVISOR_WISE')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewTab === 'SUPERVISOR_WISE'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Supervisor-Wise Leaderboard</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('SESSIONS')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewTab === 'SESSIONS'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>All Duty Logs</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search supervisor or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none w-full"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom row: Preset dates, Custom dates, Sub-division */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Presets:
            </span>
            {['ALL', 'TODAY', 'YESTERDAY', 'WEEK', 'MONTH'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetChange(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  datePreset === p
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {p === 'ALL' ? 'All Time' : p === 'TODAY' ? 'Today' : p === 'YESTERDAY' ? 'Yesterday' : p === 'WEEK' ? 'Last 7 Days' : 'This Month'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-[10px] text-slate-400">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="bg-transparent text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-[10px] text-slate-400">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="bg-transparent text-xs text-white focus:outline-none"
              />
            </div>

            {/* Sub-Division Dropdown */}
            {subDivisions.length > 0 && (
              <select
                value={selectedSubdivision}
                onChange={(e) => setSelectedSubdivision(e.target.value)}
                className="bg-slate-900 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Sub-Divisions</option>
                {subDivisions.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Areas based on selected tab */}

      {/* ─── 1. DAY-WISE BREAKDOWN VIEW ─────────────────────────────────────── */}
      {viewTab === 'DAY_WISE' && (
        <div className="flex flex-col gap-4">
          {groupedDays.length === 0 ? (
            <div className="bg-slate-850 rounded-2xl p-12 text-center text-slate-500 border border-slate-800">
              No meter installation records found for the selected filter.
            </div>
          ) : (
            groupedDays.map((dayGroup) => {
              const isExpanded = expandedDays[dayGroup.date] !== false; // expanded by default
              const supervisorsList = Object.values(dayGroup.supervisorsMap);

              return (
                <div
                  key={dayGroup.date}
                  className="bg-slate-850 rounded-2xl border border-slate-800 overflow-hidden shadow-lg transition"
                >
                  {/* Day Header Strip */}
                  <div
                    onClick={() => toggleDayExpanded(dayGroup.date)}
                    className="p-4 sm:px-6 bg-slate-900/80 hover:bg-slate-850 flex items-center justify-between cursor-pointer border-b border-slate-800 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <span>{formatDate(dayGroup.date)}</span>
                          <span className="text-xs font-mono font-normal text-slate-400">({dayGroup.date})</span>
                        </h3>
                        <p className="text-xs text-slate-400">
                          {supervisorsList.length} {supervisorsList.length === 1 ? 'supervisor' : 'supervisors'} submitted meter counts
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Day's Total</span>
                        <span className="text-xl font-black font-mono text-cyan-300">
                          {dayGroup.totalMeters.toLocaleString()} Meters
                        </span>
                      </div>
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Day Supervisors Table (Collapsible) */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-900/40">
                            <th className="py-3 px-6">Supervisor</th>
                            <th className="py-3 px-4">Sub-Division</th>
                            <th className="py-3 px-4 text-center">Sessions</th>
                            <th className="py-3 px-4 text-center font-bold text-cyan-400">Meters Installed</th>
                            <th className="py-3 px-4 text-right">Approved KM</th>
                            <th className="py-3 px-6 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {supervisorsList.map((sup) => (
                            <tr key={sup.employee_id} className="hover:bg-slate-800/40 transition">
                              <td className="py-3 px-6">
                                <div className="font-bold text-white text-sm">{sup.supervisor_name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{sup.employee_id}</div>
                              </td>
                              <td className="py-3 px-4">
                                {sup.subdivision ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700">
                                    {sup.subdivision}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">---</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center font-mono text-slate-300">
                                {sup.sessions.length}
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-base text-cyan-300">
                                {sup.meters}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-emerald-400">
                                {formatDistance(sup.approvedKm)}
                              </td>
                              <td className="py-3 px-6 text-right">
                                {sup.sessions.length === 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(sup.sessions[0])}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-900/60 text-slate-400 hover:text-cyan-300 transition"
                                    title="Edit Count"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── 2. SUPERVISOR-WISE LEADERBOARD VIEW ────────────────────────────── */}
      {viewTab === 'SUPERVISOR_WISE' && (
        <div className="bg-slate-850 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 sm:px-6 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Supervisor Performance Leaderboard</span>
            </h3>
            <span className="text-xs text-slate-400">
              Ranked by total smart meters installed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-900/40">
                  <th className="py-3.5 px-4 text-center w-14">Rank</th>
                  <th className="py-3.5 px-4">Supervisor</th>
                  <th className="py-3.5 px-4">Sub-Division</th>
                  <th className="py-3.5 px-4 text-center">Duties</th>
                  <th className="py-3.5 px-4 text-center font-bold text-cyan-400">Total Meters</th>
                  <th className="py-3.5 px-4 text-center">Avg / Duty</th>
                  <th className="py-3.5 px-4 text-right">Total Approved KM</th>
                  <th className="py-3.5 px-4 text-right">Conveyance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSupervisorSummary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No supervisors found.
                    </td>
                  </tr>
                ) : (
                  filteredSupervisorSummary.map((s, idx) => {
                    const rank = idx + 1;
                    const maxMeters = Number(data.supervisorSummary[0]?.total_meters) || 1;
                    const pct = Math.min(100, Math.round(((Number(s.total_meters) || 0) / maxMeters) * 100));

                    return (
                      <tr key={s.supervisor_id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 text-center">
                          {rank === 1 ? (
                            <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold mx-auto text-xs">
                              🥇
                            </span>
                          ) : rank === 2 ? (
                            <span className="w-7 h-7 rounded-full bg-slate-300/20 text-slate-300 border border-slate-400/40 flex items-center justify-center font-bold mx-auto text-xs">
                              🥈
                            </span>
                          ) : rank === 3 ? (
                            <span className="w-7 h-7 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/40 flex items-center justify-center font-bold mx-auto text-xs">
                              🥉
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400 font-bold">#{rank}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-sm">{s.supervisor_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{s.employee_id}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {s.subdivision ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700">
                              {s.subdivision}
                            </span>
                          ) : (
                            <span className="text-slate-500">---</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                          {s.total_duties}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="font-mono font-bold text-base text-cyan-300">
                            {Number(s.total_meters).toLocaleString()}
                          </div>
                          {/* Relative bar */}
                          <div className="w-20 mx-auto bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                            <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                          {s.avg_meters_per_duty}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                          {formatDistance(s.total_km)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-brand-300">
                          {formatCurrency(s.total_conveyance)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 3. DETAILED DUTY SESSIONS LOG VIEW ─────────────────────────────── */}
      {viewTab === 'SESSIONS' && (
        <div className="bg-slate-850 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 sm:px-6 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Session-by-Session Installations Log</span>
            </h3>
            <span className="text-xs text-slate-400">
              {filteredSessions.length} duty sessions recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-900/40">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Supervisor</th>
                  <th className="py-3.5 px-4">Sub-Division</th>
                  <th className="py-3.5 px-4">Duty Time</th>
                  <th className="py-3.5 px-4 text-center font-bold text-cyan-400">Meters Installed</th>
                  <th className="py-3.5 px-4 text-right">Approved KM</th>
                  <th className="py-3.5 px-4 text-right">Conveyance</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No duty sessions found.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-medium text-slate-200">{formatDate(s.start_time)}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-sm">{s.supervisor_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{s.employee_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        {s.subdivision ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700">
                            {s.subdivision}
                          </span>
                        ) : (
                          <span className="text-slate-500">---</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        {formatTime(s.start_time)} &rarr; {s.end_time ? formatTime(s.end_time) : 'Active'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-base text-cyan-300">
                        {s.meters_installed ?? 0}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatDistance(s.approved_distance_km)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-brand-300">
                        {formatCurrency(s.conveyance_amount)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-900/60 text-slate-400 hover:text-cyan-300 transition"
                          title="Edit Meter Count"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inline Edit Meter Count Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-850 rounded-2xl max-w-md w-full border border-slate-700 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Zap className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Edit Meter Count</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400">Supervisor:</span>{' '}
                <strong className="text-white">{editingSession.supervisor_name}</strong> ({editingSession.employee_id})
              </div>
              <div className="mt-1">
                <span className="text-slate-400">Duty Date:</span>{' '}
                <strong className="text-white">{formatDate(editingSession.start_time)}</strong>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-slate-300">
                Correct Meter Count <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={editCount}
                onChange={(e) => setEditCount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 font-mono font-bold text-lg text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-slate-300">Reason / Audit Note</label>
              <textarea
                rows={2}
                placeholder="Reason for adjusting meter count..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSubmittingEdit}
                className="py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition disabled:opacity-50"
              >
                {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
