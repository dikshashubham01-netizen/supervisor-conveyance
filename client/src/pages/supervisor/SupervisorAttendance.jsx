import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatDistance, formatTime } from '../../utils/formatters';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Bike,
  Gauge,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Award,
  Sparkles
} from 'lucide-react';

export function SupervisorAttendance({ onBack }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState(null);
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'PENDING'

  const loadAttendance = async (targetYear, targetMonth) => {
    try {
      setLoading(true);
      const res = await api.attendance.getMyAttendance({
        year: targetYear,
        month: targetMonth
      });
      setAttendanceData(res);
    } catch (err) {
      console.error('Failed to load supervisor attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance(year, month);
  }, [year, month]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((prev) => prev - 1);
      setMonth(12);
    } else {
      setMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((prev) => prev + 1);
      setMonth(1);
    } else {
      setMonth((prev) => prev + 1);
    }
  };

  // Build calendar matrix (including previous month and next month padding)
  const daysList = attendanceData?.days || [];
  const firstDayOfWeek = daysList.length > 0 ? daysList[0].dayOfWeek : 0; // 0 = Sunday
  const daysInMonth = attendanceData?.daysInMonth || 30;

  // Previous month padding
  const prevMonthPaddingCount = firstDayOfWeek;
  const prevMonthLastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const prevPadding = [];
  for (let i = prevMonthPaddingCount - 1; i >= 0; i--) {
    prevPadding.push({
      dayNumber: prevMonthLastDay - i,
      isOtherMonth: true
    });
  }

  // Next month padding to fill out 35 or 42 grid slots
  const totalGridSlots = (prevPadding.length + daysList.length) > 35 ? 42 : 35;
  const nextPaddingCount = Math.max(0, totalGridSlots - (prevPadding.length + daysList.length));
  const nextPadding = [];
  for (let i = 1; i <= nextPaddingCount; i++) {
    nextPadding.push({
      dayNumber: i,
      isOtherMonth: true
    });
  }

  // Find currently selected day
  const selectedDay = daysList.find((d) => d.dateStr === selectedDateStr) || daysList[daysList.length - 1] || null;

  // Pending verification sessions count
  const pendingSessionsCount = daysList.filter(
    (d) => d.session && ['PENDING_VERIFICATION', 'NEEDS_REVIEW'].includes(d.session.status)
  ).length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Header */}
      <div className="bg-emerald-800 text-white px-4 py-3.5 sticky top-0 z-30 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-emerald-700/60 active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Attendance</h1>
        </div>

        <button
          type="button"
          onClick={() => loadAttendance(year, month)}
          className="p-1.5 rounded-full hover:bg-emerald-700/60 transition"
          title="Refresh attendance"
        >
          <RefreshCw className={`w-4 h-4 text-emerald-100 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto w-full pb-10">
        {/* Dropdowns / Action Pills (Matching Screenshot) */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/80 bg-slate-800/80 text-emerald-300 text-xs font-semibold shadow-sm">
            <span>Attendance</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-semibold shadow-sm">
            <span>Attendance regularization</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </div>
        </div>

        {/* Pending Request Indicator */}
        <div className="flex items-center justify-between text-xs px-1">
          <button
            type="button"
            onClick={() => setFilterMode((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'))}
            className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4 flex items-center gap-1.5 transition"
          >
            <span>Your pending request</span>
            {pendingSessionsCount > 0 && (
              <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
                {pendingSessionsCount}
              </span>
            )}
          </button>
          {filterMode === 'PENDING' && (
            <span className="text-[11px] text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-full">
              Showing Pending Days
            </span>
          )}
        </div>

        {/* Monthly Summary Strip */}
        {attendanceData?.summary && (
          <div className="grid grid-cols-4 gap-2 bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80 shadow-sm text-center text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-medium">Present</span>
              <span className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {attendanceData.summary.presentDays}
              </span>
            </div>
            <div className="flex flex-col border-l border-slate-700/80 pl-1">
              <span className="text-[10px] text-slate-400 font-medium">Bike Run</span>
              <span className="text-base font-bold text-white font-mono mt-0.5 truncate">
                {formatDistance(attendanceData.summary.totalApprovedKm)}
              </span>
            </div>
            <div className="flex flex-col border-l border-slate-700/80 pl-1">
              <span className="text-[10px] text-slate-400 font-medium">Conveyance</span>
              <span className="text-base font-bold text-brand-400 font-mono mt-0.5 truncate">
                {formatCurrency(attendanceData.summary.totalConveyance)}
              </span>
            </div>
            <div className="flex flex-col border-l border-slate-700/80 pl-1">
              <span className="text-[10px] text-slate-400 font-medium">Week Off</span>
              <span className="text-base font-bold text-slate-300 font-mono mt-0.5">
                {attendanceData.summary.weekOffDays}
              </span>
            </div>
          </div>
        )}

        {/* Main Calendar Card (Styled to match screenshot) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl text-slate-800 border border-slate-100 flex flex-col gap-4">
          {/* Calendar Month Header */}
          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              {attendanceData?.monthName || 'September'} {year}
            </h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 py-1 border-b border-slate-100">
            <span className="text-sky-600">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span className="text-sky-600">Sat</span>
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center">
            {/* Previous month padding */}
            {prevPadding.map((p, idx) => (
              <div key={`prev-${idx}`} className="flex flex-col items-center justify-center py-1">
                <span className="text-xs text-slate-300 font-medium">{p.dayNumber}</span>
              </div>
            ))}

            {/* Current month days */}
            {daysList.map((day) => {
              const isSelected = day.dateStr === selectedDateStr;
              const isPending = day.session && ['PENDING_VERIFICATION', 'NEEDS_REVIEW'].includes(day.session.status);

              let circleClass = 'text-slate-800 hover:bg-slate-100';

              if (day.statusCode === 'P') {
                circleClass = 'bg-[#a7f3d0] text-emerald-950 font-bold shadow-xs';
              } else if (day.statusCode === 'WO') {
                circleClass = 'bg-slate-100 text-slate-700 font-semibold';
              } else if (day.statusCode === 'A') {
                circleClass = 'bg-rose-100 text-rose-800 font-bold';
              } else if (day.isWeeklyOff) {
                circleClass = 'bg-slate-100 text-slate-500';
              }

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => setSelectedDateStr(day.dateStr)}
                  className={`flex flex-col items-center justify-center py-1 relative group focus:outline-none transition ${
                    filterMode === 'PENDING' && !isPending ? 'opacity-30' : ''
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex flex-col items-center justify-center text-xs transition-transform ${circleClass} ${
                      isSelected ? 'ring-2 ring-emerald-600 ring-offset-2 scale-105' : ''
                    } ${day.isToday ? 'border-2 border-emerald-700' : ''}`}
                  >
                    <span className={day.isToday ? 'font-black text-emerald-800' : ''}>
                      {day.dayNumber}
                    </span>
                  </div>

                  {/* Daily Approved KM Badge underneath date circle */}
                  {day.approvedKm > 0 ? (
                    <span className="text-[9px] font-mono font-bold text-emerald-700 mt-0.5 tracking-tighter truncate max-w-[40px]">
                      {day.approvedKm.toFixed(1)}k
                    </span>
                  ) : day.statusCode === 'P' ? (
                    <span className="text-[9px] text-emerald-600 font-semibold mt-0.5">P</span>
                  ) : null}
                </button>
              );
            })}

            {/* Next month padding */}
            {nextPadding.map((p, idx) => (
              <div key={`next-${idx}`} className="flex flex-col items-center justify-center py-1">
                <span className="text-xs text-slate-300 font-medium">{p.dayNumber}</span>
              </div>
            ))}
          </div>

          {/* Calendar Legend (Matching Screenshot Exactly) */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-y-2 gap-x-2 text-[11px] text-slate-600 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-800" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6ee7b7]" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span>Holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span>Week off</span>
            </div>
          </div>
        </div>

        {/* Day-Wise Bike Run & Duty Details Card (when date is selected) */}
        {selectedDay && (
          <div className="bg-slate-800/90 rounded-3xl p-5 border border-slate-700/80 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Day-wise Details</span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {selectedDay.dayName}, {selectedDay.dayNumber} {attendanceData?.monthName} {year}
                </h3>
              </div>

              {/* Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  selectedDay.statusCode === 'P'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                    : selectedDay.statusCode === 'WO'
                    ? 'bg-slate-700/80 text-slate-300 border-slate-600'
                    : selectedDay.statusCode === 'A'
                    ? 'bg-rose-950/80 text-rose-400 border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                {selectedDay.statusLabel}
              </span>
            </div>

            {selectedDay.session ? (
              <div className="flex flex-col gap-3 pt-1">
                {/* Bike Run KM & Conveyance Hero */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-700 flex flex-col">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-emerald-400" />
                      Approved Bike KM
                    </span>
                    <span className="text-2xl font-black font-mono text-emerald-400 mt-1">
                      {formatDistance(selectedDay.session.approvedDistanceKm || selectedDay.approvedKm)}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      GPS: {formatDistance(selectedDay.session.gpsDistanceKm)}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-700 flex flex-col">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-brand-400" />
                      Day Conveyance
                    </span>
                    <span className="text-2xl font-black font-mono text-brand-400 mt-1">
                      {formatCurrency(selectedDay.session.conveyanceAmount || selectedDay.conveyanceAmount)}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      Rate: ₹{selectedDay.session.conveyanceRate || 4.5}/KM
                    </span>
                  </div>
                </div>

                {/* Duty Timing & Odometer Details */}
                <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Duty Timings
                    </span>
                    <div className="font-mono font-semibold text-white mt-1">
                      {formatTime(selectedDay.session.startTime)}
                      <span className="text-slate-500 mx-1">→</span>
                      {selectedDay.session.endTime ? formatTime(selectedDay.session.endTime) : 'Active'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-blue-400" />
                      Odometer KM
                    </span>
                    <div className="font-mono font-semibold text-blue-300 mt-1">
                      {selectedDay.session.startKm ? `${selectedDay.session.startKm} KM` : '---'}
                      <span className="text-slate-500 mx-1">→</span>
                      {selectedDay.session.endKm ? `${selectedDay.session.endKm} KM` : '---'}
                    </div>
                  </div>
                </div>

                {/* Verification Status */}
                <div className="flex items-center justify-between text-xs px-1 text-slate-400">
                  <span>Verification Status:</span>
                  <span className="font-semibold text-slate-200">
                    {selectedDay.session.status === 'APPROVED' && '✅ Approved by Admin'}
                    {selectedDay.session.status === 'PENDING_VERIFICATION' && '🟠 Waiting for Admin Verification'}
                    {selectedDay.session.status === 'NEEDS_REVIEW' && '⚠️ Under Admin Review'}
                    {selectedDay.session.status === 'REJECTED' && '❌ Rejected'}
                    {selectedDay.session.status === 'AUTO_ENDED' && '⛔ Auto-Ended'}
                    {selectedDay.session.status === 'ON_DUTY' && '🟢 On Duty in Field'}
                  </span>
                </div>
              </div>
            ) : selectedDay.statusCode === 'WO' ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                <span className="text-base block mb-1">🏖️ Weekly Off</span>
                Scheduled Sunday rest day. No duty sessions logged.
              </div>
            ) : selectedDay.isFuture ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                <span className="text-base block mb-1">🗓️ Upcoming Working Day</span>
                This day has not arrived yet.
              </div>
            ) : (
              <div className="p-4 text-center text-rose-400 text-xs bg-rose-950/20 rounded-xl border border-rose-500/20">
                <span className="text-base block mb-1">🔴 Absent (No Duty)</span>
                No duty session was recorded on this working day.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
