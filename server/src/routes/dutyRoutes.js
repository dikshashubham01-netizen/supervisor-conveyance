import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin, requireSupervisor } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { cleanGpsPoints } from '../services/gpsCleaner.js';
import { evaluateConveyance, getActiveRate } from '../services/conveyanceService.js';

const router = express.Router();

// 1. Start Duty
router.post(
  '/start',
  authenticateToken,
  requireSupervisor,
  upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'odometer', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const supervisorId = req.user.id;

      // Check if already on duty
      const activeSession = db.prepare('SELECT id FROM duty_sessions WHERE supervisor_id = ? AND status = ?').get(supervisorId, 'ON_DUTY');
      if (activeSession) {
        return res.status(400).json({ error: 'You already have an active duty session. Please end it before starting a new one.' });
      }

      const files = req.files || {};
      const selfieFile = files.selfie ? files.selfie[0].filename : null;
      const odometerFile = files.odometer ? files.odometer[0].filename : null;

      if (!selfieFile) {
        return res.status(400).json({ error: 'Live Start Selfie photo is required' });
      }
      if (!odometerFile) {
        return res.status(400).json({ error: 'Start Bike Odometer photo is required' });
      }

      const {
        latitude,
        longitude,
        accuracy,
        odometerOcr,
        odometerManual,
        odometerFinal
      } = req.body;

      const finalKm = parseFloat(odometerFinal);
      if (isNaN(finalKm) || finalKm < 0) {
        return res.status(400).json({ error: 'Valid confirmed start KM is required' });
      }

      const sessionId = uuidv4();
      const currentRate = getActiveRate('Bike');
      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;

      db.prepare(`
        INSERT INTO duty_sessions (
          id, supervisor_id, start_time,
          start_latitude, start_longitude,
          start_selfie, start_odometer_image,
          start_odometer_ocr, start_odometer_manual, start_odometer_final,
          conveyance_rate, status
        ) VALUES (
          ?, ?, CURRENT_TIMESTAMP,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, 'ON_DUTY'
        )
      `).run(
        sessionId, supervisorId,
        lat, lng,
        selfieFile, odometerFile,
        odometerOcr ? parseFloat(odometerOcr) : null,
        odometerManual ? parseFloat(odometerManual) : null,
        finalKm,
        currentRate
      );

      // Record initial GPS point if coordinates provided
      if (lat != null && lng != null) {
        db.prepare(`
          INSERT INTO location_points (
            id, client_uuid, duty_session_id, supervisor_id,
            latitude, longitude, accuracy, recorded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(uuidv4(), uuidv4(), sessionId, supervisorId, lat, lng, accuracy ? parseFloat(accuracy) : 10);
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

// 2. Get current active session for logged-in supervisor
router.get('/current', authenticateToken, (req, res) => {
  try {
    const session = db.prepare(`
      SELECT 
        ds.*,
        u.name AS supervisor_name,
        u.employee_id
      FROM duty_sessions ds
      JOIN users u ON u.id = ds.supervisor_id
      WHERE ds.supervisor_id = ? AND ds.status = 'ON_DUTY'
      ORDER BY ds.start_time DESC LIMIT 1
    `).get(req.user.id);

    if (!session) {
      return res.json({ activeDuty: null });
    }

    // Get last location ping & count of synced points
    const lastPoint = db.prepare(`
      SELECT latitude, longitude, accuracy, recorded_at, synced_at
      FROM location_points
      WHERE duty_session_id = ?
      ORDER BY recorded_at DESC LIMIT 1
    `).get(session.id);

    const pointCount = db.prepare(`
      SELECT COUNT(*) as total FROM location_points WHERE duty_session_id = ?
    `).get(session.id);

    // Current estimated conveyance
    const currentRate = session.conveyance_rate || getActiveRate('Bike');
    const estimatedConveyance = Number(((session.gps_distance_km || 0) * currentRate).toFixed(2));

    res.json({
      activeDuty: {
        ...session,
        lastLocation: lastPoint || null,
        totalPoints: pointCount.total,
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
  upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'odometer', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const supervisorId = req.user.id;

      const activeSession = db.prepare(`
        SELECT * FROM duty_sessions WHERE supervisor_id = ? AND status = 'ON_DUTY'
      `).get(supervisorId);

      if (!activeSession) {
        return res.status(404).json({ error: 'No active duty session found to end' });
      }

      const files = req.files || {};
      const selfieFile = files.selfie ? files.selfie[0].filename : null;
      const odometerFile = files.odometer ? files.odometer[0].filename : null;

      if (!selfieFile) {
        return res.status(400).json({ error: 'Live End Selfie photo is required' });
      }
      if (!odometerFile) {
        return res.status(400).json({ error: 'End Bike Odometer photo is required' });
      }

      const {
        latitude,
        longitude,
        accuracy,
        odometerOcr,
        odometerManual,
        odometerFinal
      } = req.body;

      const finalEndKm = parseFloat(odometerFinal);
      if (isNaN(finalEndKm) || finalEndKm < 0) {
        return res.status(400).json({ error: 'Valid confirmed end KM is required' });
      }

      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;

      // Record final GPS point if provided
      if (lat != null && lng != null) {
        db.prepare(`
          INSERT INTO location_points (
            id, client_uuid, duty_session_id, supervisor_id,
            latitude, longitude, accuracy, recorded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(uuidv4(), uuidv4(), activeSession.id, supervisorId, lat, lng, accuracy ? parseFloat(accuracy) : 10);
      }

      // Fetch all GPS points for this session
      const rawPoints = db.prepare(`
        SELECT * FROM location_points WHERE duty_session_id = ? ORDER BY recorded_at ASC
      `).all(activeSession.id);

      // Clean GPS points
      const { cleanedPoints, totalDistanceKm } = cleanGpsPoints(rawPoints);

      // Update filtered flags in DB
      const updateFiltered = db.prepare('UPDATE location_points SET is_filtered = ? WHERE id = ?');
      for (const pt of cleanedPoints) {
        updateFiltered.run(pt.is_filtered, pt.id);
      }

      // Calculate tracking gaps
      let maxGapMinutes = 0;
      for (let i = 1; i < rawPoints.length; i++) {
        const gap = (new Date(rawPoints[i].recorded_at) - new Date(rawPoints[i - 1].recorded_at)) / (1000 * 60);
        if (gap > maxGapMinutes) maxGapMinutes = gap;
      }

      // Evaluate Conveyance (Lower Distance Selection & Anomaly Detection)
      const evaluation = evaluateConveyance({
        startKm: activeSession.start_odometer_final,
        endKm: finalEndKm,
        gpsDistanceKm: totalDistanceKm,
        startOdoOcr: activeSession.start_odometer_ocr,
        startOdoManual: activeSession.start_odometer_manual,
        endOdoOcr: odometerOcr ? parseFloat(odometerOcr) : null,
        endOdoManual: odometerManual ? parseFloat(odometerManual) : null,
        trackingGapMinutes: maxGapMinutes
      });

      // Update Duty Session
      db.prepare(`
        UPDATE duty_sessions
        SET 
          end_time = CURRENT_TIMESTAMP,
          end_latitude = ?,
          end_longitude = ?,
          end_selfie = ?,
          end_odometer_image = ?,
          end_odometer_ocr = ?,
          end_odometer_manual = ?,
          end_odometer_final = ?,
          gps_distance_km = ?,
          odometer_distance_km = ?,
          approved_distance_km = ?,
          distance_selection_reason = ?,
          conveyance_rate = ?,
          conveyance_amount = ?,
          status = ?,
          warnings = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
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
        activeSession.id
      );

      // Audit Log for End Duty
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, duty_session_id, action, new_value, reason)
        VALUES (?, ?, ?, 'END_DUTY', ?, 'Supervisor completed duty')
      `).run(
        uuidv4(), supervisorId, activeSession.id,
        JSON.stringify({
          startKm: activeSession.start_odometer_final,
          endKm: finalEndKm,
          approvedKm: evaluation.approvedDistanceKm,
          conveyance: evaluation.conveyanceAmount
        })
      );

      // Fetch completed session with supervisor details
      const completed = db.prepare(`
        SELECT ds.*, u.name AS supervisor_name, u.employee_id
        FROM duty_sessions ds
        JOIN users u ON u.id = ds.supervisor_id
        WHERE ds.id = ?
      `).get(activeSession.id);

      res.json({
        message: 'Duty ended successfully',
        summary: completed
      });
    } catch (err) {
      console.error('End duty error:', err);
      res.status(500).json({ error: 'Failed to end duty: ' + err.message });
    }
  }
);

// 4. Get duty history
router.get('/history', authenticateToken, (req, res) => {
  try {
    const { supervisorId, status, startDate, endDate, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        ds.*,
        u.name AS supervisor_name,
        u.employee_id
      FROM duty_sessions ds
      JOIN users u ON u.id = ds.supervisor_id
      WHERE 1=1
    `;
    const params = [];

    // Role-based scoping: supervisors can only see their own history
    if (req.user.role === 'supervisor') {
      query += ' AND ds.supervisor_id = ?';
      params.push(req.user.id);
    } else if (supervisorId && supervisorId !== 'undefined' && supervisorId !== 'null') {
      query += ' AND ds.supervisor_id = ?';
      params.push(supervisorId);
    }

    if (status && status !== 'undefined' && status !== 'null' && status !== 'ALL') {
      query += ' AND ds.status = ?';
      params.push(status);
    }

    if (startDate && startDate !== 'undefined' && startDate !== 'null') {
      query += ' AND date(ds.start_time) >= date(?)';
      params.push(startDate);
    }

    if (endDate && endDate !== 'undefined' && endDate !== 'null') {
      query += ' AND date(ds.start_time) <= date(?)';
      params.push(endDate);
    }

    query += ' ORDER BY ds.start_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const sessions = db.prepare(query).all(...params);
    res.json({ sessions });
  } catch (err) {
    console.error('Duty history error:', err);
    res.status(500).json({ error: 'Failed to fetch duty history' });
  }
});

// 5. Get detailed single session
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const session = db.prepare(`
      SELECT 
        ds.*,
        u.name AS supervisor_name,
        u.employee_id,
        u.phone AS supervisor_phone
      FROM duty_sessions ds
      JOIN users u ON u.id = ds.supervisor_id
      WHERE ds.id = ?
    `).get(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Duty session not found' });
    }

    // Authorization check
    if (req.user.role === 'supervisor' && session.supervisor_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to view this session' });
    }

    // Get audit logs for this session
    const auditLogs = db.prepare(`
      SELECT al.*, u.name AS user_name, u.role AS user_role
      FROM audit_logs al
      JOIN users u ON u.id = al.user_id
      WHERE al.duty_session_id = ?
      ORDER BY al.created_at DESC
    `).all(session.id);

    // Get GPS summary
    const pointsCount = db.prepare(`
      SELECT 
        COUNT(*) AS total_points,
        SUM(CASE WHEN is_filtered = 0 THEN 1 ELSE 0 END) AS valid_points,
        SUM(CASE WHEN is_filtered = 1 THEN 1 ELSE 0 END) AS filtered_points
      FROM location_points
      WHERE duty_session_id = ?
    `).get(session.id);

    res.json({
      session,
      auditLogs,
      pointsSummary: pointsCount
    });
  } catch (err) {
    console.error('Get session details error:', err);
    res.status(500).json({ error: 'Failed to get session details' });
  }
});

// 6. Admin Verification & Manual Override
router.post('/:id/verify', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { action, approvedDistanceKm, reviewNotes, reason } = req.body;

    const session = db.prepare('SELECT * FROM duty_sessions WHERE id = ?').get(id);
    if (!session) {
      return res.status(404).json({ error: 'Duty session not found' });
    }

    let newStatus = session.status;
    let newApprovedKm = session.approved_distance_km;
    let newConveyance = session.conveyance_amount;
    let logAction = '';
    let oldValue = '';
    let newValue = '';

    if (action === 'APPROVE') {
      newStatus = 'APPROVED';
      logAction = 'APPROVE_DUTY_SESSION';
      oldValue = session.status;
      newValue = 'APPROVED';
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED';
      logAction = 'REJECT_DUTY_SESSION';
      oldValue = session.status;
      newValue = 'REJECTED';
    } else if (action === 'REQUEST_REVIEW') {
      newStatus = 'NEEDS_REVIEW';
      logAction = 'FLAG_FOR_REVIEW';
      oldValue = session.status;
      newValue = 'NEEDS_REVIEW';
    } else if (action === 'OVERRIDE_KM') {
      const overrideKm = parseFloat(approvedDistanceKm);
      if (isNaN(overrideKm) || overrideKm < 0) {
        return res.status(400).json({ error: 'Valid approved distance KM is required for manual override' });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'A mandatory reason is required when manually overriding approved KM' });
      }

      newApprovedKm = overrideKm;
      newConveyance = Number((overrideKm * session.conveyance_rate).toFixed(2));
      newStatus = 'APPROVED';
      logAction = 'OVERRIDE_APPROVED_KM';
      oldValue = `KM: ${session.approved_distance_km}, Amount: ₹${session.conveyance_amount}`;
      newValue = `KM: ${newApprovedKm}, Amount: ₹${newConveyance}`;
    } else {
      return res.status(400).json({ error: 'Invalid verification action' });
    }

    db.prepare(`
      UPDATE duty_sessions
      SET 
        status = ?,
        approved_distance_km = ?,
        conveyance_amount = ?,
        review_notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newStatus,
      newApprovedKm,
      newConveyance,
      reviewNotes ? reviewNotes.trim() : session.review_notes,
      id
    );

    // Save Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, duty_session_id, action, old_value, new_value, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      req.user.id,
      id,
      logAction,
      oldValue,
      newValue,
      reason ? reason.trim() : (reviewNotes || `${action} by Admin`)
    );

    res.json({
      message: `Duty session updated to ${newStatus}`,
      status: newStatus,
      approvedDistanceKm: newApprovedKm,
      conveyanceAmount: newConveyance
    });
  } catch (err) {
    console.error('Verify duty session error:', err);
    res.status(500).json({ error: 'Failed to verify duty session' });
  }
});

export default router;
