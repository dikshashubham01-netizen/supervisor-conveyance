import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin, requireSupervisor } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { cleanGpsPoints } from '../services/gpsCleaner.js';
import { evaluateConveyance, getActiveRate } from '../services/conveyanceService.js';
import {
  syncAttendanceForCompletedDuty,
  getMonthlyMetersMatrix,
  generateMonthlyMetersExcel
} from '../services/attendanceService.js';

const router = express.Router();

// 1. Start Duty
router.post(
  '/start',
  authenticateToken,
  requireSupervisor,
  upload.fields([{ name: 'selfie', maxCount: 1 }, { name: 'odometer', maxCount: 1 }]),
  async (req, res) => {
    try {
      const supervisorId = req.user.id;

      const activeSession = await db.queryOne(
        `SELECT id FROM duty_sessions WHERE supervisor_id = $1 AND status = 'ON_DUTY'`,
        [supervisorId]
      );
      if (activeSession) {
        return res.status(400).json({ error: 'You already have an active duty session. Please end it before starting a new one.' });
      }

      const files = req.files || {};
      const selfieFile = files.selfie ? files.selfie[0].filename : null;
      const odometerFile = files.odometer ? files.odometer[0].filename : null;

      if (!selfieFile) return res.status(400).json({ error: 'Live Start Selfie photo is required' });
      if (!odometerFile) return res.status(400).json({ error: 'Start Bike Odometer photo is required' });

      const { latitude, longitude, accuracy, odometerOcr, odometerManual, odometerFinal } = req.body;

      if (odometerManual === undefined || odometerManual === null || String(odometerManual).trim() === '') {
        return res.status(400).json({ error: 'Manual bike odometer KM reading is mandatory to start duty.' });
      }
      const parsedManualStart = parseFloat(odometerManual);
      if (isNaN(parsedManualStart) || parsedManualStart < 0) {
        return res.status(400).json({ error: 'Valid manual start bike odometer KM reading (>= 0) is mandatory.' });
      }

      if (odometerFinal === undefined || odometerFinal === null || String(odometerFinal).trim() === '') {
        await db.run(
          `INSERT INTO audit_logs (id, user_id, action, new_value, reason, created_at)
           VALUES ($1, $2, 'START_DUTY_BLOCKED_MISSING_START_KM', 'Missing odometerFinal', 'Blocked start duty: Start KM is required', NOW())`,
          [uuidv4(), supervisorId]
        );
        return res.status(400).json({ error: 'Start KM is required to start duty.' });
      }

      const finalKm = parseFloat(odometerFinal);
      if (isNaN(finalKm) || finalKm < 0) {
        await db.run(
          `INSERT INTO audit_logs (id, user_id, action, new_value, reason, created_at)
           VALUES ($1, $2, 'START_DUTY_BLOCKED_MISSING_START_KM', $3, 'Blocked start duty: Start KM must be a valid numeric value >= 0', NOW())`,
          [uuidv4(), supervisorId, String(odometerFinal)]
        );
        return res.status(400).json({ error: 'Start KM is required to start duty.' });
      }

      const sessionId = uuidv4();
      const currentRate = await getActiveRate('Bike');
      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;

      await db.run(
        `INSERT INTO duty_sessions (
          id, supervisor_id, start_time,
          start_latitude, start_longitude,
          start_selfie, start_odometer_image,
          start_odometer_ocr, start_odometer_manual, start_odometer_final,
          conveyance_rate, status
        ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, 'ON_DUTY')`,
        [
          sessionId, supervisorId,
          lat, lng,
          selfieFile, odometerFile,
          odometerOcr ? parseFloat(odometerOcr) : null,
          odometerManual ? parseFloat(odometerManual) : null,
          finalKm,
          currentRate
        ]
      );

      if (lat != null && lng != null) {
        await db.run(
          `INSERT INTO location_points (id, client_uuid, duty_session_id, supervisor_id, latitude, longitude, accuracy, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [uuidv4(), uuidv4(), sessionId, supervisorId, lat, lng, accuracy ? parseFloat(accuracy) : 10]
        );
      }

      res.status(201).json({
        message: 'Duty started successfully',
        sessionId,
        status: 'ON_DUTY',
        startKm: finalKm,
        startTime: new Date().toISOString()
      });
    } catch (err) {
      console.error('Start duty error:', err);
      res.status(500).json({ error: 'Failed to start duty: ' + err.message });
    }
  }
);

// 2. Get current active session
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const session = await db.queryOne(
      `SELECT ds.*, u.name AS supervisor_name, u.employee_id
       FROM duty_sessions ds
       JOIN users u ON u.id = ds.supervisor_id
       WHERE ds.supervisor_id = $1 AND ds.status = 'ON_DUTY'
       ORDER BY ds.start_time DESC LIMIT 1`,
      [req.user.id]
    );

    if (!session) return res.json({ activeDuty: null });

    const lastPoint = await db.queryOne(
      `SELECT latitude, longitude, accuracy, recorded_at, synced_at
       FROM location_points WHERE duty_session_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [session.id]
    );

    const pointCountRow = await db.queryOne(
      `SELECT COUNT(*) as total FROM location_points WHERE duty_session_id = $1`,
      [session.id]
    );

    const currentRate = session.conveyance_rate || await getActiveRate('Bike');
    const estimatedConveyance = Number(((session.gps_distance_km || 0) * currentRate).toFixed(2));

    res.json({
      activeDuty: {
        ...session,
        lastLocation: lastPoint || null,
        totalPoints: parseInt(pointCountRow?.total || 0),
        estimatedConveyance
      }
    });
  } catch (err) {
    console.error('Get current duty error:', err);
    res.status(500).json({ error: 'Failed to get active duty session' });
  }
});

// 3. End Duty
router.post(
  '/end',
  authenticateToken,
  requireSupervisor,
  upload.fields([{ name: 'selfie', maxCount: 1 }, { name: 'odometer', maxCount: 1 }]),
  async (req, res) => {
    try {
      const supervisorId = req.user.id;

      const activeSession = await db.queryOne(
        `SELECT * FROM duty_sessions WHERE supervisor_id = $1 AND status = 'ON_DUTY'`,
        [supervisorId]
      );

      if (!activeSession) return res.status(404).json({ error: 'No active duty session found to end' });

      const files = req.files || {};
      const selfieFile = files.selfie ? files.selfie[0].filename : null;
      const odometerFile = files.odometer ? files.odometer[0].filename : null;

      if (!selfieFile) return res.status(400).json({ error: 'Live End Selfie photo is required' });
      if (!odometerFile) return res.status(400).json({ error: 'End Bike Odometer photo is required' });

      const { latitude, longitude, accuracy, odometerOcr, odometerManual, odometerFinal, metersInstalled, meters_installed } = req.body;

      // 1. Enforce mandatory manual odometer reading
      if (odometerManual === undefined || odometerManual === null || String(odometerManual).trim() === '') {
        return res.status(400).json({ error: 'Manual bike odometer KM reading is mandatory to end duty.' });
      }
      const parsedManualEnd = parseFloat(odometerManual);
      if (isNaN(parsedManualEnd) || parsedManualEnd < 0) {
        return res.status(400).json({ error: 'Valid manual end bike odometer KM reading (>= 0) is mandatory.' });
      }

      // 2. Enforce mandatory installed meter count
      const rawMeterInput = metersInstalled !== undefined ? metersInstalled : meters_installed;
      if (rawMeterInput === undefined || rawMeterInput === null || String(rawMeterInput).trim() === '') {
        return res.status(400).json({ error: 'Today installed meter count is mandatory to end duty. Please enter meter count.' });
      }
      const meterCount = parseInt(rawMeterInput, 10);
      if (isNaN(meterCount) || meterCount < 0) {
        return res.status(400).json({ error: 'Valid installed meter count is mandatory to end duty (must be >= 0).' });
      }

      // 3. Enforce valid end KM
      if (odometerFinal === undefined || odometerFinal === null || String(odometerFinal).trim() === '') {
        return res.status(400).json({ error: 'End KM reading is required to end duty.' });
      }
      const finalEndKm = parseFloat(odometerFinal);
      if (isNaN(finalEndKm) || finalEndKm < 0) return res.status(400).json({ error: 'Valid confirmed end KM is required' });

      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;

      if (lat != null && lng != null) {
        await db.run(
          `INSERT INTO location_points (id, client_uuid, duty_session_id, supervisor_id, latitude, longitude, accuracy, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [uuidv4(), uuidv4(), activeSession.id, supervisorId, lat, lng, accuracy ? parseFloat(accuracy) : 10]
        );
      }

      const rawPoints = await db.queryAll(
        `SELECT * FROM location_points WHERE duty_session_id = $1 ORDER BY recorded_at ASC`,
        [activeSession.id]
      );

      const { cleanedPoints, totalDistanceKm } = cleanGpsPoints(rawPoints);

      // Update filtered flags
      for (const pt of cleanedPoints) {
        await db.run('UPDATE location_points SET is_filtered = $1 WHERE id = $2', [pt.is_filtered, pt.id]);
      }

      let maxGapMinutes = 0;
      for (let i = 1; i < rawPoints.length; i++) {
        const gap = (new Date(rawPoints[i].recorded_at) - new Date(rawPoints[i - 1].recorded_at)) / (1000 * 60);
        if (gap > maxGapMinutes) maxGapMinutes = gap;
      }

      const rate = await getActiveRate('Bike');
      const evaluation = evaluateConveyance({
        startKm: activeSession.start_odometer_final,
        endKm: finalEndKm,
        gpsDistanceKm: totalDistanceKm,
        startOdoOcr: activeSession.start_odometer_ocr,
        startOdoManual: activeSession.start_odometer_manual,
        endOdoOcr: odometerOcr ? parseFloat(odometerOcr) : null,
        endOdoManual: odometerManual ? parseFloat(odometerManual) : null,
        trackingGapMinutes: maxGapMinutes,
        rate
      });

      await db.run(
        `UPDATE duty_sessions SET
          end_time = NOW(), end_latitude = $1, end_longitude = $2,
          end_selfie = $3, end_odometer_image = $4,
          end_odometer_ocr = $5, end_odometer_manual = $6, end_odometer_final = $7,
          gps_distance_km = $8, odometer_distance_km = $9, approved_distance_km = $10,
          distance_selection_reason = $11, conveyance_rate = $12, conveyance_amount = $13,
          status = $14, warnings = $15, meters_installed = $16, updated_at = NOW()
        WHERE id = $17`,
        [
          lat, lng,
          selfieFile, odometerFile,
          odometerOcr ? parseFloat(odometerOcr) : null,
          odometerManual ? parseFloat(odometerManual) : null,
          finalEndKm,
          evaluation.gpsDistanceKm,
          evaluation.odometerDistanceKm,
          evaluation.approvedDistanceKm,
          evaluation.selectionReason,
          evaluation.conveyanceRate,
          evaluation.conveyanceAmount,
          evaluation.status,
          JSON.stringify(evaluation.warnings),
          meterCount,
          activeSession.id
        ]
      );

      await db.run(
        `INSERT INTO audit_logs (id, user_id, duty_session_id, action, new_value, reason)
         VALUES ($1, $2, $3, 'END_DUTY', $4, 'Supervisor completed duty with meter count')`,
        [
          uuidv4(), supervisorId, activeSession.id,
          JSON.stringify({
            startKm: activeSession.start_odometer_final,
            endKm: finalEndKm,
            approvedKm: evaluation.approvedDistanceKm,
            conveyance: evaluation.conveyanceAmount,
            metersInstalled: meterCount
          })
        ]
      );

      await syncAttendanceForCompletedDuty(activeSession.id);

      const completed = await db.queryOne(
        `SELECT ds.*, u.name AS supervisor_name, u.employee_id, u.subdivision AS supervisor_subdivision
         FROM duty_sessions ds JOIN users u ON u.id = ds.supervisor_id WHERE ds.id = $1`,
        [activeSession.id]
      );

      res.json({ message: 'Duty ended successfully', summary: completed });
    } catch (err) {
      console.error('End duty error:', err);
      res.status(500).json({ error: 'Failed to end duty: ' + err.message });
    }
  }
);

// 4. Duty history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { supervisorId, status, startDate, endDate, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT ds.*, u.name AS supervisor_name, u.employee_id
      FROM duty_sessions ds
      JOIN users u ON u.id = ds.supervisor_id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (req.user.role === 'supervisor') {
      query += ` AND ds.supervisor_id = $${p++}`;
      params.push(req.user.id);
    } else if (supervisorId && supervisorId !== 'undefined' && supervisorId !== 'null') {
      query += ` AND ds.supervisor_id = $${p++}`;
      params.push(supervisorId);
    }

    if (status && status !== 'undefined' && status !== 'null' && status !== 'ALL') {
      query += ` AND ds.status = $${p++}`;
      params.push(status);
    }

    if (startDate && startDate !== 'undefined' && startDate !== 'null') {
      query += ` AND ds.start_time::date >= $${p++}::date`;
      params.push(startDate);
    }

    if (endDate && endDate !== 'undefined' && endDate !== 'null') {
      query += ` AND ds.start_time::date <= $${p++}::date`;
      params.push(endDate);
    }

    query += ` ORDER BY ds.start_time DESC LIMIT $${p++} OFFSET $${p++}`;
    params.push(parseInt(limit), offset);

    const sessions = await db.queryAll(query, params);
    res.json({ sessions });
  } catch (err) {
    console.error('Duty history error:', err);
    res.status(500).json({ error: 'Failed to fetch duty history' });
  }
});

// 4.1 Meter Installation Report (Day-wise and Supervisor-wise)
router.get('/meters-report', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, supervisorId, subdivision } = req.query;

    const params = [
      startDate || null,
      endDate || null,
      supervisorId || null,
      subdivision || null
    ];

    // Day-wise breakdown per supervisor
    const sessions = await db.queryAll(`
      SELECT
        ds.id,
        ds.supervisor_id,
        u.name AS supervisor_name,
        u.employee_id,
        u.subdivision,
        u.phone,
        DATE(ds.start_time AT TIME ZONE 'Asia/Kolkata') AS duty_date,
        ds.start_time,
        ds.end_time,
        COALESCE(ds.meters_installed, 0) AS meters_installed,
        ds.gps_distance_km,
        ds.odometer_distance_km,
        ds.approved_distance_km,
        ds.conveyance_amount,
        ds.status
      FROM duty_sessions ds
      JOIN users u ON u.id = ds.supervisor_id
      WHERE ds.status != 'ON_DUTY'
        AND ($1::text IS NULL OR DATE(ds.start_time AT TIME ZONE 'Asia/Kolkata') >= $1::date)
        AND ($2::text IS NULL OR DATE(ds.start_time AT TIME ZONE 'Asia/Kolkata') <= $2::date)
        AND ($3::text IS NULL OR ds.supervisor_id = $3)
        AND ($4::text IS NULL OR LOWER(u.subdivision) = LOWER($4))
      ORDER BY ds.start_time DESC
    `, params);

    // Supervisor-wise aggregated totals
    const supervisorSummary = await db.queryAll(`
      SELECT
        u.id AS supervisor_id,
        u.name AS supervisor_name,
        u.employee_id,
        u.subdivision,
        COUNT(ds.id) AS total_duties,
        COALESCE(SUM(ds.meters_installed), 0) AS total_meters,
        ROUND(COALESCE(AVG(ds.meters_installed), 0)::numeric, 1) AS avg_meters_per_duty,
        ROUND(COALESCE(SUM(ds.approved_distance_km), 0)::numeric, 2) AS total_km,
        ROUND(COALESCE(SUM(ds.conveyance_amount), 0)::numeric, 2) AS total_conveyance
      FROM users u
      LEFT JOIN duty_sessions ds ON ds.supervisor_id = u.id AND ds.status != 'ON_DUTY'
        AND ($1::text IS NULL OR DATE(ds.start_time AT TIME ZONE 'Asia/Kolkata') >= $1::date)
        AND ($2::text IS NULL OR DATE(ds.start_time AT TIME ZONE 'Asia/Kolkata') <= $2::date)
      WHERE u.role = 'supervisor'
        AND ($3::text IS NULL OR u.id = $3)
        AND ($4::text IS NULL OR LOWER(u.subdivision) = LOWER($4))
      GROUP BY u.id, u.name, u.employee_id, u.subdivision
      ORDER BY total_meters DESC, u.name ASC
    `, params);

    // Day-wise aggregated totals
    const daySummary = await db.queryAll(`
      SELECT
        DATE(ds.start_time AT TIME ZONE 'Asia/Kolkata') AS duty_date,
        COUNT(DISTINCT ds.supervisor_id) AS active_supervisors,
        COUNT(ds.id) AS total_duties,
        COALESCE(SUM(ds.meters_installed), 0) AS total_meters,
        ROUND(COALESCE(SUM(ds.approved_distance_km), 0)::numeric, 2) AS total_km
      FROM duty_sessions ds
      JOIN users u ON u.id = ds.supervisor_id
      WHERE ds.status != 'ON_DUTY'
        AND ($1::text IS NULL OR DATE(ds.start_time AT TIME ZONE 'Asia/Kolkata') >= $1::date)
        AND ($2::text IS NULL OR DATE(ds.start_time AT TIME ZONE 'Asia/Kolkata') <= $2::date)
        AND ($3::text IS NULL OR ds.supervisor_id = $3)
        AND ($4::text IS NULL OR LOWER(u.subdivision) = LOWER($4))
      GROUP BY DATE(ds.start_time AT TIME ZONE 'Asia/Kolkata')
      ORDER BY duty_date DESC
    `, params);

    let totalMetersInstalled = 0;
    let totalApprovedKm = 0;
    for (const s of sessions) {
      totalMetersInstalled += Number(s.meters_installed) || 0;
      totalApprovedKm += Number(s.approved_distance_km) || 0;
    }

    res.json({
      summary: {
        totalMetersInstalled,
        totalApprovedKm: Number(totalApprovedKm.toFixed(2)),
        totalDuties: sessions.length,
        activeSupervisorsCount: supervisorSummary.filter(s => Number(s.total_duties) > 0).length
      },
      supervisorSummary,
      daySummary,
      sessions
    });
  } catch (err) {
    console.error('Error fetching meters report:', err);
    res.status(500).json({ error: 'Failed to fetch meter report: ' + err.message });
  }
});

// 4.2 Monthly Smart Meters Matrix (Grid format like Attendance/Conveyance)
router.get('/meters-monthly', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { year, month, supervisorId, employeeId, subdivision } = req.query;
    const matrix = await getMonthlyMetersMatrix({
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      supervisorId,
      employeeId,
      subdivision
    });
    res.json(matrix);
  } catch (err) {
    console.error('Error fetching monthly meters matrix:', err);
    res.status(500).json({ error: 'Failed to fetch monthly meters matrix: ' + err.message });
  }
});

// 4.3 Export Monthly Smart Meters Matrix as Excel (.xlsx)
router.get('/meters-monthly/export/excel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { year, month, supervisorId, employeeId, subdivision } = req.query;
    const matrix = await getMonthlyMetersMatrix({
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      supervisorId,
      employeeId,
      subdivision
    });
    const buffer = generateMonthlyMetersExcel(matrix);
    const filename = `Meters_${matrix.monthName}_${matrix.year}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting monthly meters excel:', err);
    res.status(500).json({ error: 'Failed to export meters excel: ' + err.message });
  }
});

// 4.4 Admin update meter count for a specific session
router.put('/:id/meter-count', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { metersInstalled } = req.body;
    const count = Math.max(0, parseInt(metersInstalled, 10) || 0);

    const existing = await db.queryOne('SELECT id, meters_installed FROM duty_sessions WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'Duty session not found' });

    await db.run('UPDATE duty_sessions SET meters_installed = $1, updated_at = NOW() WHERE id = $2', [count, id]);
    res.json({ message: 'Meter count updated successfully', meters_installed: count });
  } catch (err) {
    console.error('Update meter count error:', err);
    res.status(500).json({ error: 'Failed to update meter count: ' + err.message });
  }
});

// 5. Single session details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const session = await db.queryOne(
      `SELECT ds.*, u.name AS supervisor_name, u.employee_id, u.phone AS supervisor_phone
       FROM duty_sessions ds JOIN users u ON u.id = ds.supervisor_id WHERE ds.id = $1`,
      [req.params.id]
    );

    if (!session) return res.status(404).json({ error: 'Duty session not found' });

    if (req.user.role === 'supervisor' && session.supervisor_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to view this session' });
    }

    const auditLogs = await db.queryAll(
      `SELECT al.*, COALESCE(u.name, 'System') AS user_name, COALESCE(u.role, 'system') AS user_role
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
       WHERE al.duty_session_id = $1 ORDER BY al.created_at DESC`,
      [session.id]
    );

    const pointsCount = await db.queryOne(
      `SELECT
         COUNT(*) AS total_points,
         COALESCE(SUM(CASE WHEN is_filtered = 0 THEN 1 ELSE 0 END), 0) AS valid_points,
         COALESCE(SUM(CASE WHEN is_filtered = 1 THEN 1 ELSE 0 END), 0) AS filtered_points
       FROM location_points WHERE duty_session_id = $1`,
      [session.id]
    );

    res.json({ session, auditLogs, pointsSummary: pointsCount });
  } catch (err) {
    console.error('Get session details error:', err);
    res.status(500).json({ error: 'Failed to get session details' });
  }
});

// 6. Admin Verification
router.post('/:id/verify', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, approvedDistanceKm, reviewNotes, reason } = req.body;

    const session = await db.queryOne('SELECT * FROM duty_sessions WHERE id = $1', [id]);
    if (!session) return res.status(404).json({ error: 'Duty session not found' });

    let newStatus = session.status;
    let newApprovedKm = session.approved_distance_km;
    let newConveyance = session.conveyance_amount;
    let logAction = '';
    let oldValue = '';
    let newValue = '';

    if (action === 'APPROVE') {
      newStatus = 'APPROVED'; logAction = 'APPROVE_DUTY_SESSION'; oldValue = session.status; newValue = 'APPROVED';
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED'; logAction = 'REJECT_DUTY_SESSION'; oldValue = session.status; newValue = 'REJECTED';
    } else if (action === 'REQUEST_REVIEW') {
      newStatus = 'NEEDS_REVIEW'; logAction = 'FLAG_FOR_REVIEW'; oldValue = session.status; newValue = 'NEEDS_REVIEW';
    } else if (action === 'OVERRIDE_KM') {
      const overrideKm = parseFloat(approvedDistanceKm);
      if (isNaN(overrideKm) || overrideKm < 0) return res.status(400).json({ error: 'Valid approved distance KM is required' });
      if (!reason?.trim()) return res.status(400).json({ error: 'A mandatory reason is required when overriding KM' });

      newApprovedKm = overrideKm;
      newConveyance = Number((overrideKm * session.conveyance_rate).toFixed(2));
      newStatus = 'APPROVED';
      logAction = 'OVERRIDE_APPROVED_KM';
      oldValue = `KM: ${session.approved_distance_km}, Amount: ₹${session.conveyance_amount}`;
      newValue = `KM: ${newApprovedKm}, Amount: ₹${newConveyance}`;
    } else {
      return res.status(400).json({ error: 'Invalid verification action' });
    }

    await db.run(
      `UPDATE duty_sessions SET status = $1, approved_distance_km = $2, conveyance_amount = $3, review_notes = $4, updated_at = NOW() WHERE id = $5`,
      [newStatus, newApprovedKm, newConveyance, reviewNotes ? reviewNotes.trim() : session.review_notes, id]
    );

    await db.run(
      `INSERT INTO audit_logs (id, user_id, duty_session_id, action, old_value, new_value, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuidv4(), req.user.id, id, logAction, oldValue, newValue, reason ? reason.trim() : (reviewNotes || `${action} by Admin`)]
    );

    res.json({ message: `Duty session updated to ${newStatus}`, status: newStatus, approvedDistanceKm: newApprovedKm, conveyanceAmount: newConveyance });
  } catch (err) {
    console.error('Verify duty session error:', err);
    res.status(500).json({ error: 'Failed to verify duty session' });
  }
});

export default router;
