import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { db } from '../db/database.js';
import {
  getISTDateString,
  getISTParts,
  isSameISTDay,
  getDaysInMonth,
  isWeeklyOff,
  formatDayHeader,
  MONTH_NAMES
} from '../utils/timezone.js';

/**
 * 1. Server-side Automatic Midnight Duty End
 * Closes any duty sessions that started on a previous calendar day (in IST)
 * and are still in 'ON_DUTY' status.
 * Idempotent: can run repeatedly without duplicate side effects.
 */
export async function autoEndLingeringDutySessions() {
  const todayIST = getISTDateString(new Date());

  // Find lingering ON_DUTY sessions from previous calendar days in IST
  const lingeringSessions = await db.queryAll(
    `SELECT ds.*, (ds.start_time AT TIME ZONE 'Asia/Kolkata')::date::text AS start_date_ist
     FROM duty_sessions ds
     WHERE ds.status = 'ON_DUTY'
       AND (ds.start_time AT TIME ZONE 'Asia/Kolkata')::date < $1::date`,
    [todayIST]
  );

  if (!lingeringSessions || lingeringSessions.length === 0) {
    return { closedCount: 0, sessions: [] };
  }

  const closedSessions = [];

  for (const session of lingeringSessions) {
    const sessionStartDate = session.start_date_ist;
    // End timestamp corresponding to the end of that session's calendar day in IST
    const endTimestamp = `${sessionStartDate} 23:59:59+05:30`;

    // 1. Update duty session to AUTO_ENDED
    await db.run(
      `UPDATE duty_sessions SET
        end_time = $1::timestamptz,
        status = 'AUTO_ENDED',
        end_odometer_final = NULL,
        odometer_distance_km = 0.0,
        approved_distance_km = 0.0,
        conveyance_amount = 0.0,
        review_notes = 'AUTO ENDED - NO END DUTY',
        distance_selection_reason = 'Automatically ended at midnight because supervisor did not complete End Duty.',
        updated_at = NOW()
      WHERE id = $2 AND status = 'ON_DUTY'`,
      [endTimestamp, session.id]
    );

    // 2. Mark attendance as A (Absent)
    await db.run(
      `INSERT INTO attendance (id, supervisor_id, attendance_date, status, duty_session_id, source, notes, created_at, updated_at)
       VALUES ($1, $2, $3::date, 'A', $4, 'MIDNIGHT_AUTO_ABSENT', 'Auto-ended at midnight: supervisor did not complete End Duty.', NOW(), NOW())
       ON CONFLICT (supervisor_id, attendance_date)
       DO UPDATE SET
         status = 'A',
         duty_session_id = EXCLUDED.duty_session_id,
         source = 'MIDNIGHT_AUTO_ABSENT',
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
      [uuidv4(), session.supervisor_id, sessionStartDate, session.id]
    );

    // 3. Create audit log entry
    await db.run(
      `INSERT INTO audit_logs (id, user_id, duty_session_id, action, old_value, new_value, reason, created_at)
       VALUES ($1, $2, $3, 'AUTO_END_DUTY_AT_MIDNIGHT', 'ON_DUTY', 'AUTO_ENDED', 'Automatically ended at midnight because supervisor did not complete End Duty.', NOW())`,
      [uuidv4(), session.supervisor_id, session.id]
    );

    closedSessions.push({ id: session.id, supervisor_id: session.supervisor_id, date: sessionStartDate });
  }

  return { closedCount: closedSessions.length, sessions: closedSessions };
}

/**
 * 2. Synchronize attendance when a supervisor completes End Duty.
 * If Start & End are on the same calendar day in IST -> Present (P)
 * If End is on a different calendar day -> Absent (A)
 */
export async function syncAttendanceForCompletedDuty(sessionId) {
  const session = await db.queryOne(
    `SELECT id, supervisor_id, start_time, end_time, status
     FROM duty_sessions
     WHERE id = $1`,
    [sessionId]
  );

  if (!session) return;

  const startDateStr = getISTDateString(session.start_time);
  const endDateStr = getISTDateString(session.end_time);

  // Present only if completed on the same calendar day
  const isSameDay = startDateStr === endDateStr;
  const attendanceStatus = isSameDay ? 'P' : 'A';
  const notes = isSameDay
    ? 'Completed Start Duty and End Duty on same calendar day'
    : 'End Duty submitted on different calendar day (marked Absent)';

  await db.run(
    `INSERT INTO attendance (id, supervisor_id, attendance_date, status, duty_session_id, source, notes, created_at, updated_at)
     VALUES ($1, $2, $3::date, $4, $5, 'AUTO', $6, NOW(), NOW())
     ON CONFLICT (supervisor_id, attendance_date)
     DO UPDATE SET
       status = EXCLUDED.status,
       duty_session_id = EXCLUDED.duty_session_id,
       source = EXCLUDED.source,
       notes = EXCLUDED.notes,
       updated_at = NOW()`,
    [uuidv4(), session.supervisor_id, startDateStr, attendanceStatus, session.id, notes]
  );
}

/**
 * 3. Monthly Attendance Matrix (day-wise: 01-Sep ... 30-Sep)
 */
export async function getMonthlyAttendanceMatrix({ year, month, supervisorId, employeeId }) {
  await autoEndLingeringDutySessions();

  const numYear = Number(year) || new Date().getFullYear();
  const numMonth = Number(month) || (new Date().getMonth() + 1);
  const daysInMonth = getDaysInMonth(numYear, numMonth);
  const todayIST = getISTDateString(new Date());

  // Build day columns metadata
  const dayColumns = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const paddedDay = String(d).padStart(2, '0');
    const paddedMonth = String(numMonth).padStart(2, '0');
    const dateStr = `${numYear}-${paddedMonth}-${paddedDay}`;
    const header = formatDayHeader(d, numMonth);
    const isOff = isWeeklyOff(numYear, numMonth, d);
    dayColumns.push({ dayNumber: d, dateStr, header, isWeeklyOff: isOff });
  }

  // Get supervisors
  let supQuery = `SELECT id, employee_id, name, phone, status FROM users WHERE role = 'supervisor'`;
  const supParams = [];
  let p = 1;

  if (supervisorId) {
    supQuery += ` AND id = $${p++}`;
    supParams.push(supervisorId);
  }
  if (employeeId) {
    supQuery += ` AND employee_id ILIKE $${p++}`;
    supParams.push(`%${employeeId.trim()}%`);
  }
  supQuery += ` ORDER BY employee_id ASC`;
  const supervisors = await db.queryAll(supQuery, supParams);

  // Fetch all attendance records for this month
  const attendanceRecords = await db.queryAll(
    `SELECT supervisor_id, attendance_date::text AS attendance_date, status, source
     FROM attendance
     WHERE EXTRACT(YEAR FROM attendance_date) = $1
       AND EXTRACT(MONTH FROM attendance_date) = $2`,
    [numYear, numMonth]
  );

  // Fetch all duty sessions for this month
  const dutySessions = await db.queryAll(
    `SELECT id, supervisor_id, (start_time AT TIME ZONE 'Asia/Kolkata')::date::text AS duty_date,
            status, approved_distance_km, conveyance_amount
     FROM duty_sessions
     WHERE EXTRACT(YEAR FROM (start_time AT TIME ZONE 'Asia/Kolkata')) = $1
       AND EXTRACT(MONTH FROM (start_time AT TIME ZONE 'Asia/Kolkata')) = $2`,
    [numYear, numMonth]
  );

  // Lookup maps
  const attMap = new Map(); // `${supervisor_id}_${dateStr}` -> record
  for (const att of attendanceRecords) {
    attMap.set(`${att.supervisor_id}_${att.attendance_date}`, att);
  }

  const dutyMap = new Map(); // `${supervisor_id}_${dateStr}` -> session
  for (const ds of dutySessions) {
    // If multiple on same day, prefer completed one
    const key = `${ds.supervisor_id}_${ds.duty_date}`;
    const existing = dutyMap.get(key);
    if (!existing || ds.status !== 'AUTO_ENDED') {
      dutyMap.set(key, ds);
    }
  }

  // Build matrix rows
  let totalAllPresent = 0;
  let totalAllAbsent = 0;
  let totalAllWorkingDays = 0;

  const rows = supervisors.map((sup) => {
    const dailyStatus = {};
    let presentCount = 0;
    let absentCount = 0;
    let workingDaysCount = 0;

    for (const col of dayColumns) {
      const { dateStr, isWeeklyOff: isOff } = col;
      const key = `${sup.id}_${dateStr}`;
      const attRecord = attMap.get(key);
      const duty = dutyMap.get(key);

      const isFuture = dateStr > todayIST;

      let code = '';
      if (isFuture) {
        // Future calendar day: not yet evaluated
        code = isOff ? 'WO' : '-';
      } else if (isOff) {
        // Sunday / Weekly off: check if worked
        if (attRecord?.status === 'P' || (duty && ['APPROVED', 'PENDING_VERIFICATION', 'NEEDS_REVIEW'].includes(duty.status))) {
          code = 'P';
          presentCount++;
        } else {
          code = 'WO';
        }
      } else {
        // Working day
        workingDaysCount++;
        if (attRecord?.status === 'P') {
          code = 'P';
          presentCount++;
        } else if (duty && ['APPROVED', 'PENDING_VERIFICATION', 'NEEDS_REVIEW'].includes(duty.status)) {
          code = 'P';
          presentCount++;
        } else {
          code = 'A';
          absentCount++;
        }
      }

      dailyStatus[col.header] = code;
    }

    totalAllPresent += presentCount;
    totalAllAbsent += absentCount;
    totalAllWorkingDays += workingDaysCount;

    return {
      supervisorId: sup.id,
      name: sup.name,
      employeeId: sup.employee_id,
      total: presentCount,             // Total Present Days
      grandTotal: workingDaysCount,     // Total Working Days
      inputPresentDay: presentCount,    // Input Present Day (P count)
      dailyStatus
    };
  });

  // Top summary cards data
  const totalEmployees = supervisors.length;
  let presentToday = 0;
  let absentToday = 0;
  let isTodayWeeklyOff = false;

  const currentISTParts = getISTParts(new Date());
  if (currentISTParts.year === numYear && currentISTParts.month === numMonth) {
    const todayHeader = formatDayHeader(currentISTParts.day, numMonth);
    isTodayWeeklyOff = isWeeklyOff(numYear, numMonth, currentISTParts.day);

    for (const r of rows) {
      const st = r.dailyStatus[todayHeader];
      if (st === 'P') presentToday++;
      else if (st === 'A') absentToday++;
    }
  }

  const attendancePercent = totalAllWorkingDays > 0
    ? Number(((totalAllPresent / totalAllWorkingDays) * 100).toFixed(1))
    : 0.0;

  return {
    year: numYear,
    month: numMonth,
    monthName: MONTH_NAMES[numMonth - 1],
    dayColumns,
    rows,
    summary: {
      totalEmployees,
      presentToday,
      absentToday,
      weeklyOffToday: isTodayWeeklyOff ? totalEmployees : 0,
      totalPresent: totalAllPresent,
      totalAbsent: totalAllAbsent,
      totalWorkingDays: totalAllWorkingDays,
      attendancePercent
    }
  };
}

/**
 * 4. Monthly Day-wise Conveyance Matrix (Approved KM per day + Total KM + Total Conveyance)
 */
export async function getMonthlyConveyanceMatrix({ year, month, supervisorId, employeeId }) {
  await autoEndLingeringDutySessions();

  const numYear = Number(year) || new Date().getFullYear();
  const numMonth = Number(month) || (new Date().getMonth() + 1);
  const daysInMonth = getDaysInMonth(numYear, numMonth);

  // Day columns metadata
  const dayColumns = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const paddedDay = String(d).padStart(2, '0');
    const paddedMonth = String(numMonth).padStart(2, '0');
    const dateStr = `${numYear}-${paddedMonth}-${paddedDay}`;
    const header = formatDayHeader(d, numMonth);
    dayColumns.push({ dayNumber: d, dateStr, header });
  }

  // Get supervisors
  let supQuery = `SELECT id, employee_id, name, phone, status FROM users WHERE role = 'supervisor'`;
  const supParams = [];
  let p = 1;

  if (supervisorId) {
    supQuery += ` AND id = $${p++}`;
    supParams.push(supervisorId);
  }
  if (employeeId) {
    supQuery += ` AND employee_id ILIKE $${p++}`;
    supParams.push(`%${employeeId.trim()}%`);
  }
  supQuery += ` ORDER BY employee_id ASC`;
  const supervisors = await db.queryAll(supQuery, supParams);

  // Fetch all duty sessions for this month
  const dutySessions = await db.queryAll(
    `SELECT id, supervisor_id, (start_time AT TIME ZONE 'Asia/Kolkata')::date::text AS duty_date,
            status, approved_distance_km, conveyance_amount, conveyance_rate
     FROM duty_sessions
     WHERE EXTRACT(YEAR FROM (start_time AT TIME ZONE 'Asia/Kolkata')) = $1
       AND EXTRACT(MONTH FROM (start_time AT TIME ZONE 'Asia/Kolkata')) = $2`,
    [numYear, numMonth]
  );

  // Map duty sessions by supervisor and date
  // A supervisor could theoretically have multiple sessions in a day: we sum their approved KM & conveyance
  const dutyMap = new Map(); // `${supervisor_id}_${dateStr}` -> { km, amount }
  for (const ds of dutySessions) {
    // Only count approved/valid completed duties (auto-ended or rejected get 0)
    const isValid = ['APPROVED', 'PENDING_VERIFICATION', 'NEEDS_REVIEW'].includes(ds.status);
    const km = isValid ? (Number(ds.approved_distance_km) || 0.0) : 0.0;
    const amount = isValid ? (Number(ds.conveyance_amount) || 0.0) : 0.0;

    const key = `${ds.supervisor_id}_${ds.duty_date}`;
    const cur = dutyMap.get(key) || { km: 0, amount: 0 };
    cur.km += km;
    cur.amount += amount;
    dutyMap.set(key, cur);
  }

  let grandTotalKm = 0;
  let grandTotalConveyance = 0;

  const rows = supervisors.map((sup) => {
    const dailyKm = {};
    let employeeTotalKm = 0;
    let employeeTotalConveyance = 0;

    for (const col of dayColumns) {
      const key = `${sup.id}_${col.dateStr}`;
      const entry = dutyMap.get(key);
      const km = entry ? Number(entry.km.toFixed(2)) : 0.0;
      const amount = entry ? Number(entry.amount.toFixed(2)) : 0.0;

      dailyKm[col.header] = km;
      employeeTotalKm += km;
      employeeTotalConveyance += amount;
    }

    employeeTotalKm = Number(employeeTotalKm.toFixed(2));
    employeeTotalConveyance = Number(employeeTotalConveyance.toFixed(2));

    grandTotalKm += employeeTotalKm;
    grandTotalConveyance += employeeTotalConveyance;

    return {
      supervisorId: sup.id,
      name: sup.name,
      employeeId: sup.employee_id,
      dailyKm,
      totalKm: employeeTotalKm,
      totalConveyance: employeeTotalConveyance
    };
  });

  grandTotalKm = Number(grandTotalKm.toFixed(2));
  grandTotalConveyance = Number(grandTotalConveyance.toFixed(2));
  const totalEmployees = supervisors.length;
  const avgKmPerEmployee = totalEmployees > 0
    ? Number((grandTotalKm / totalEmployees).toFixed(2))
    : 0.0;

  return {
    year: numYear,
    month: numMonth,
    monthName: MONTH_NAMES[numMonth - 1],
    dayColumns,
    rows,
    summary: {
      totalEmployees,
      totalKm: grandTotalKm,
      totalConveyance: grandTotalConveyance,
      averageKmPerEmployee: avgKmPerEmployee
    }
  };
}

/**
 * 5. Attendance Excel Export (.xlsx buffer)
 * Layout:
 * Installation Field Engg Name | Total | Grand Total | Input Present Day | Employee ID | 01-Sep | 02-Sep ...
 */
export function generateAttendanceExcel(matrixData) {
  const { rows, dayColumns, monthName, year } = matrixData;

  const excelRows = rows.map((r) => {
    const rowObj = {
      'Installation Field Engg Name': r.name,
      'Total': r.total,
      'Grand Total': r.grandTotal,
      'Input Present Day': r.inputPresentDay,
      'Employee ID': r.employeeId
    };

    for (const col of dayColumns) {
      rowObj[col.header] = r.dailyStatus[col.header] || '-';
    }

    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);

  // Freeze top header row and left 5 identification columns
  worksheet['!freeze'] = { xSplit: 5, ySplit: 1 };

  // Set column widths
  const colWidths = [
    { wch: 28 }, // Installation Field Engg Name
    { wch: 10 }, // Total
    { wch: 12 }, // Grand Total
    { wch: 18 }, // Input Present Day
    { wch: 14 }  // Employee ID
  ];
  for (let i = 0; i < dayColumns.length; i++) {
    colWidths.push({ wch: 9 }); // 01-Sep ...
  }
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  const sheetName = `Attendance_${monthName}_${year}`.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 6. Monthly Conveyance Excel Export (.xlsx buffer)
 * Layout:
 * Installation Field Engg Name | Employee ID | 01-Sep | 02-Sep ... | Total KM | Total Conveyance
 */
export function generateMonthlyConveyanceExcel(matrixData) {
  const { rows, dayColumns, monthName, year } = matrixData;

  const excelRows = rows.map((r) => {
    const rowObj = {
      'Installation Field Engg Name': r.name,
      'Employee ID': r.employeeId
    };

    for (const col of dayColumns) {
      rowObj[col.header] = r.dailyKm[col.header] || 0;
    }

    rowObj['Total KM'] = r.totalKm;
    rowObj['Total Conveyance'] = `₹${r.totalConveyance.toFixed(2)}`;

    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);

  // Freeze top header row and left 2 columns
  worksheet['!freeze'] = { xSplit: 2, ySplit: 1 };

  // Set column widths
  const colWidths = [
    { wch: 28 }, // Installation Field Engg Name
    { wch: 14 }  // Employee ID
  ];
  for (let i = 0; i < dayColumns.length; i++) {
    colWidths.push({ wch: 9 }); // 01-Sep ...
  }
  colWidths.push({ wch: 14 }); // Total KM
  colWidths.push({ wch: 18 }); // Total Conveyance
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  const sheetName = `Conveyance_${monthName}_${year}`.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 7. Single Supervisor Monthly Attendance & Day-wise Bike Run
 * Returns calendar day-by-day attendance status, duty timings, start/end odometer,
 * approved KM run on bike, conveyance earned, and monthly totals.
 */
export async function getSupervisorMonthlyAttendanceAndConveyance({ supervisorId, year, month }) {
  const numYear = Number(year) || new Date().getFullYear();
  const numMonth = Number(month) || (new Date().getMonth() + 1);

  const daysInMonth = getDaysInMonth(numYear, numMonth);
  const monthName = MONTH_NAMES[numMonth - 1] || 'Unknown';
  const todayIST = getISTDateString(new Date());

  const supervisor = await db.queryOne(
    `SELECT id, name, employee_id, phone FROM users WHERE id = $1`,
    [supervisorId]
  );
  if (!supervisor) {
    throw new Error('Supervisor not found');
  }

  // Fetch all attendance records for this supervisor in this month
  const attendanceRecords = await db.queryAll(
    `SELECT attendance_date::text AS attendance_date, status, source, notes
     FROM attendance
     WHERE supervisor_id = $1
       AND EXTRACT(YEAR FROM attendance_date) = $2
       AND EXTRACT(MONTH FROM attendance_date) = $3`,
    [supervisorId, numYear, numMonth]
  );
  const attMap = new Map();
  for (const att of attendanceRecords) {
    attMap.set(att.attendance_date, att);
  }

  // Fetch all duty sessions for this supervisor in this month
  const dutySessions = await db.queryAll(
    `SELECT id,
            (start_time AT TIME ZONE 'Asia/Kolkata')::date::text AS duty_date,
            start_time, end_time,
            start_odometer_final, end_odometer_final,
            start_latitude, start_longitude, end_latitude, end_longitude,
            gps_distance_km, odometer_distance_km, approved_distance_km,
            conveyance_rate, conveyance_amount, status, warnings
     FROM duty_sessions
     WHERE supervisor_id = $1
       AND EXTRACT(YEAR FROM (start_time AT TIME ZONE 'Asia/Kolkata')) = $2
       AND EXTRACT(MONTH FROM (start_time AT TIME ZONE 'Asia/Kolkata')) = $3
     ORDER BY start_time ASC`,
    [supervisorId, numYear, numMonth]
  );

  const dutyMap = new Map();
  for (const ds of dutySessions) {
    if (!dutyMap.has(ds.duty_date)) {
      dutyMap.set(ds.duty_date, []);
    }
    dutyMap.get(ds.duty_date).push(ds);
  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = [];
  let presentDays = 0;
  let absentDays = 0;
  let weekOffDays = 0;
  let totalApprovedKm = 0;
  let totalConveyance = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(numYear, numMonth - 1, d));
    const dateStr = `${numYear}-${String(numMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = dateObj.getUTCDay(); // 0 = Sunday
    const isSunday = dayOfWeek === 0;
    const isToday = dateStr === todayIST;
    const isFuture = dateStr > todayIST;

    const attRecord = attMap.get(dateStr);
    const sessions = dutyMap.get(dateStr) || [];
    const primarySession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

    let dayApprovedKm = 0;
    let dayConveyance = 0;
    let hasCompletedOrValidDuty = false;
    let isOnDuty = false;

    for (const s of sessions) {
      if (s.status === 'ON_DUTY') {
        isOnDuty = true;
      }
      hasCompletedOrValidDuty = true;
      const km = Number(s.approved_distance_km ?? s.gps_distance_km ?? 0);
      const amount = Number(s.conveyance_amount ?? (km * (Number(s.conveyance_rate) || 4.5))) || 0;
      dayApprovedKm += km;
      if (s.status !== 'REJECTED') {
        dayConveyance += amount;
      }
    }

    dayApprovedKm = Number(dayApprovedKm.toFixed(2));
    dayConveyance = Number(dayConveyance.toFixed(2));

    let statusCode = 'UPCOMING';
    let statusLabel = 'Upcoming';

    if (isFuture) {
      statusCode = isSunday ? 'WO' : 'UPCOMING';
      statusLabel = isSunday ? 'Week off' : 'Upcoming';
    } else if (isSunday) {
      weekOffDays++;
      if (attRecord?.status === 'P' || hasCompletedOrValidDuty || isOnDuty) {
        statusCode = 'P';
        statusLabel = 'Present (Worked on Sunday)';
        presentDays++;
      } else {
        statusCode = 'WO';
        statusLabel = 'Week off';
      }
    } else {
      // Working day
      if (attRecord?.status === 'P' || hasCompletedOrValidDuty || isOnDuty) {
        statusCode = 'P';
        statusLabel = isOnDuty ? 'On Duty' : 'Present';
        presentDays++;
      } else {
        statusCode = 'A';
        statusLabel = 'Absent';
        absentDays++;
      }
    }

    totalApprovedKm += dayApprovedKm;
    totalConveyance += dayConveyance;

    days.push({
      dateStr,
      dayNumber: d,
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      isWeeklyOff: isSunday,
      isToday,
      isFuture,
      statusCode,
      statusLabel,
      approvedKm: dayApprovedKm,
      conveyanceAmount: dayConveyance,
      session: primarySession ? {
        id: primarySession.id,
        status: primarySession.status,
        startTime: primarySession.start_time,
        endTime: primarySession.end_time,
        startKm: primarySession.start_odometer_final,
        endKm: primarySession.end_odometer_final,
        gpsDistanceKm: Number(primarySession.gps_distance_km) || 0,
        odometerDistanceKm: Number(primarySession.odometer_distance_km) || 0,
        approvedDistanceKm: Number(primarySession.approved_distance_km) || 0,
        conveyanceAmount: Number(primarySession.conveyance_amount) || 0,
        conveyanceRate: Number(primarySession.conveyance_rate) || 4.5
      } : null
    });
  }

  totalApprovedKm = Number(totalApprovedKm.toFixed(2));
  totalConveyance = Number(totalConveyance.toFixed(2));

  return {
    supervisor: {
      id: supervisor.id,
      name: supervisor.name,
      employeeId: supervisor.employee_id
    },
    year: numYear,
    month: numMonth,
    monthName,
    daysInMonth,
    days,
    summary: {
      totalDays: daysInMonth,
      presentDays,
      absentDays,
      weekOffDays,
      totalApprovedKm,
      totalConveyance
    }
  };
}

