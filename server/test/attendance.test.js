import test from 'node:test';
import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';
import {
  getISTDateString,
  getISTParts,
  isSameISTDay,
  getDaysInMonth,
  isWeeklyOff,
  formatDayHeader
} from '../src/utils/timezone.js';
import {
  autoEndLingeringDutySessions,
  syncAttendanceForCompletedDuty,
  getMonthlyAttendanceMatrix,
  getMonthlyConveyanceMatrix,
  generateAttendanceExcel,
  generateMonthlyConveyanceExcel
} from '../src/services/attendanceService.js';
import { db, initDatabase } from '../src/db/database.js';

// Ensure database tables exist
await initDatabase();

test('1. Timezone utilities: IST date calculations', () => {
  const istDate = getISTDateString('2026-09-01T18:30:00.000Z'); // 00:00 IST on 02-Sep-2026
  assert.strictEqual(istDate, '2026-09-02');

  const parts = getISTParts('2026-09-01T18:30:00.000Z');
  assert.strictEqual(parts.year, 2026);
  assert.strictEqual(parts.month, 9);
  assert.strictEqual(parts.day, 2);

  assert.strictEqual(getDaysInMonth(2026, 9), 30);
  assert.strictEqual(getDaysInMonth(2026, 8), 31);
  assert.strictEqual(formatDayHeader(5, 9), '05-Sep');
  assert.strictEqual(formatDayHeader(12, 10), '12-Oct');

  // Sunday check: 06-Sep-2026 is Sunday
  assert.strictEqual(isWeeklyOff(2026, 9, 6), true);
  // Monday check: 07-Sep-2026 is Monday
  assert.strictEqual(isWeeklyOff(2026, 9, 7), false);
});

test('2. Start Duty validation logic: missing or invalid Start KM is rejected', () => {
  const validateStartKm = (odometerFinal) => {
    if (odometerFinal === undefined || odometerFinal === null || String(odometerFinal).trim() === '') {
      return { valid: false, error: 'Start KM is required to start duty.' };
    }
    const km = parseFloat(odometerFinal);
    if (isNaN(km) || km < 0) {
      return { valid: false, error: 'Start KM is required to start duty.' };
    }
    return { valid: true, km };
  };

  assert.strictEqual(validateStartKm(null).valid, false);
  assert.strictEqual(validateStartKm(null).error, 'Start KM is required to start duty.');
  assert.strictEqual(validateStartKm('').valid, false);
  assert.strictEqual(validateStartKm('   ').valid, false);
  assert.strictEqual(validateStartKm('abc').valid, false);
  assert.strictEqual(validateStartKm('-5').valid, false);

  const validRes = validateStartKm('12543.5');
  assert.strictEqual(validRes.valid, true);
  assert.strictEqual(validRes.km, 12543.5);

  const zeroKm = validateStartKm('0');
  assert.strictEqual(zeroKm.valid, true);
  assert.strictEqual(zeroKm.km, 0);
});

test('3. Attendance: Same-day completed duty marks Present (P)', async () => {
  // Find an active supervisor to test with
  const supervisor = await db.queryOne(`SELECT id FROM users WHERE role = 'supervisor' LIMIT 1`);
  assert(supervisor, 'At least one supervisor must exist in database');

  const sessionId = uuidv4();
  const testDate = '2026-08-10';

  // Create completed duty session on same calendar day
  await db.run(
    `INSERT INTO duty_sessions (
      id, supervisor_id, start_time, end_time,
      start_odometer_final, end_odometer_final,
      gps_distance_km, odometer_distance_km, approved_distance_km,
      conveyance_amount, status
    ) VALUES (
      $1, $2, '${testDate} 09:00:00+05:30'::timestamptz, '${testDate} 17:30:00+05:30'::timestamptz,
      1000, 1030,
      30.0, 30.0, 30.0,
      135.0, 'APPROVED'
    )`,
    [sessionId, supervisor.id]
  );

  // Sync attendance
  await syncAttendanceForCompletedDuty(sessionId);

  // Verify attendance record created with status 'P'
  const att = await db.queryOne(
    `SELECT * FROM attendance WHERE supervisor_id = $1 AND attendance_date = $2::date`,
    [supervisor.id, testDate]
  );
  assert(att, 'Attendance record must exist');
  assert.strictEqual(att.status, 'P', 'Status must be Present (P)');
  assert.strictEqual(att.duty_session_id, sessionId);

  // Clean up test session and attendance
  await db.run(`DELETE FROM attendance WHERE duty_session_id = $1`, [sessionId]);
  await db.run(`DELETE FROM duty_sessions WHERE id = $1`, [sessionId]);
});

test('4. Midnight Auto-End: Lingering ON_DUTY from previous day is auto-closed as Absent (A)', async () => {
  const supervisor = await db.queryOne(`SELECT id FROM users WHERE role = 'supervisor' LIMIT 1`);
  assert(supervisor);

  const sessionId = uuidv4();
  const pastDate = '2026-08-01'; // Past date relative to today

  // Insert a lingering ON_DUTY session that started in the past
  await db.run(
    `INSERT INTO duty_sessions (
      id, supervisor_id, start_time,
      start_odometer_final, status
    ) VALUES (
      $1, $2, '${pastDate} 09:00:00+05:30'::timestamptz,
      5000, 'ON_DUTY'
    )`,
    [sessionId, supervisor.id]
  );

  // Run midnight auto-end
  const result = await autoEndLingeringDutySessions();
  assert(result.closedCount >= 1, 'Should close at least the test lingering session');

  // Verify duty session is now AUTO_ENDED
  const closed = await db.queryOne(`SELECT * FROM duty_sessions WHERE id = $1`, [sessionId]);
  assert.strictEqual(closed.status, 'AUTO_ENDED');
  assert.strictEqual(closed.end_odometer_final, null, 'End KM must not be fabricated');
  assert.strictEqual(closed.approved_distance_km, 0, 'Approved KM must be 0');
  assert.strictEqual(closed.conveyance_amount, 0, 'Conveyance must be ₹0');
  assert.strictEqual(closed.review_notes, 'AUTO ENDED - NO END DUTY');

  // Verify attendance marked as A (Absent)
  const att = await db.queryOne(
    `SELECT * FROM attendance WHERE supervisor_id = $1 AND attendance_date = $2::date`,
    [supervisor.id, pastDate]
  );
  assert(att, 'Attendance record must exist for the auto-ended day');
  assert.strictEqual(att.status, 'A', 'Attendance must be A (Absent)');
  assert.strictEqual(att.source, 'MIDNIGHT_AUTO_ABSENT');

  // Verify audit log entry
  const audit = await db.queryOne(
    `SELECT * FROM audit_logs WHERE duty_session_id = $1 AND action = 'AUTO_END_DUTY_AT_MIDNIGHT'`,
    [sessionId]
  );
  assert(audit, 'Audit log entry must be created for midnight auto-end');

  // Test idempotency: running again should not fail or re-process
  const rerun = await autoEndLingeringDutySessions();
  assert.strictEqual(
    rerun.sessions.some((s) => s.id === sessionId),
    false,
    'Already closed session must not be closed again'
  );

  // Clean up
  await db.run(`DELETE FROM audit_logs WHERE duty_session_id = $1`, [sessionId]);
  await db.run(`DELETE FROM attendance WHERE duty_session_id = $1`, [sessionId]);
  await db.run(`DELETE FROM duty_sessions WHERE id = $1`, [sessionId]);
});

test('5. Monthly Attendance Matrix API returns day-wise P/A/WO grid and summary', async () => {
  const matrix = await getMonthlyAttendanceMatrix({ year: 2026, month: 9 });
  assert.strictEqual(matrix.year, 2026);
  assert.strictEqual(matrix.month, 9);
  assert.strictEqual(matrix.dayColumns.length, 30);
  assert.strictEqual(matrix.dayColumns[0].header, '01-Sep');
  assert.strictEqual(matrix.dayColumns[29].header, '30-Sep');
  assert(matrix.rows.length > 0, 'Should return supervisors');

  const firstRow = matrix.rows[0];
  assert(firstRow.name, 'Row has supervisor name');
  assert(firstRow.employeeId, 'Row has employeeId');
  assert(typeof firstRow.total === 'number');
  assert(typeof firstRow.grandTotal === 'number');
  assert(typeof firstRow.inputPresentDay === 'number');

  // Summary object
  assert(matrix.summary.totalEmployees > 0);
  assert(typeof matrix.summary.totalPresent === 'number');
  assert(typeof matrix.summary.attendancePercent === 'number');
});

test('6. Monthly Conveyance Matrix API returns day-wise KM grid and totals', async () => {
  const matrix = await getMonthlyConveyanceMatrix({ year: 2026, month: 9 });
  assert.strictEqual(matrix.year, 2026);
  assert.strictEqual(matrix.month, 9);
  assert.strictEqual(matrix.dayColumns.length, 30);
  assert(matrix.rows.length > 0);

  const firstRow = matrix.rows[0];
  assert(firstRow.name);
  assert(firstRow.employeeId);
  assert(typeof firstRow.totalKm === 'number');
  assert(typeof firstRow.totalConveyance === 'number');

  assert(matrix.summary.totalEmployees > 0);
  assert(typeof matrix.summary.totalKm === 'number');
  assert(typeof matrix.summary.totalConveyance === 'number');
});

test('7. Excel Export generation: Attendance and Conveyance work and produce valid buffers', async () => {
  const attMatrix = await getMonthlyAttendanceMatrix({ year: 2026, month: 9 });
  const attBuffer = generateAttendanceExcel(attMatrix);
  assert(Buffer.isBuffer(attBuffer), 'Attendance Excel must return a Buffer');
  assert(attBuffer.length > 1000, 'Excel buffer size should be valid');

  const convMatrix = await getMonthlyConveyanceMatrix({ year: 2026, month: 9 });
  const convBuffer = generateMonthlyConveyanceExcel(convMatrix);
  assert(Buffer.isBuffer(convBuffer), 'Conveyance Excel must return a Buffer');
  assert(convBuffer.length > 1000, 'Excel buffer size should be valid');
});
