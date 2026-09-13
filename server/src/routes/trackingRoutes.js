import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin, requireSupervisor } from '../middleware/auth.js';
import { cleanGpsPoints } from '../services/gpsCleaner.js';
import { config } from '../config/index.js';

const router = express.Router();

// Keep track of active SSE client connections
const sseClients = new Set();

export function broadcastLocationUpdate(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// 1. Sync GPS Locations (Batch with validation, deduplication, and quality tracking)
router.post('/sync', authenticateToken, requireSupervisor, async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { points } = req.body;

    if (!Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ error: 'Array of location points required' });
    }

    const activeSession = await db.queryOne(
      `SELECT id, conveyance_rate FROM duty_sessions WHERE supervisor_id = $1 AND status = 'ON_DUTY'`,
      [supervisorId]
    );

    if (!activeSession) {
      return res.status(403).json({
        error: 'Tracking forbidden: No active duty session. Location is ONLY recorded during duty.',
        stopTracking: true
      });
    }

    let insertedCount = 0;
    let hasMock = false;
    let hasJump = false;
    let hasLowAccuracy = false;

    for (const p of points) {
      const lat = parseFloat(p.latitude);
      const lng = parseFloat(p.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      const clientUuid = p.clientUuid || uuidv4();
      const acc = p.accuracy != null ? parseFloat(p.accuracy) : null;
      const spd = p.speed != null ? parseFloat(p.speed) : null;
      const hdg = p.heading != null ? parseFloat(p.heading) : null;
      const alt = p.altitude != null ? parseFloat(p.altitude) : null;
      const prov = p.provider ? String(p.provider) : null;
      const isMock = (p.isMock === true || p.is_mock === 1 || p.is_mock === true) ? 1 : 0;
      const recAt = p.recordedAt || new Date().toISOString();

      if (isMock) hasMock = true;
      if (acc != null && acc > config.gps.maxAccuracyMeters) hasLowAccuracy = true;

      const result = await db.run(
        `INSERT INTO location_points (
          id, client_uuid, duty_session_id, supervisor_id,
          latitude, longitude, accuracy, speed, heading, altitude, provider,
          is_mock, is_filtered, recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13)
        ON CONFLICT (client_uuid) DO NOTHING`,
        [uuidv4(), clientUuid, activeSession.id, supervisorId, lat, lng, acc, spd, hdg, alt, prov, isMock, recAt]
      );
      if (result.rowCount > 0) insertedCount++;
    }

    // Run GPS cleaning across all points in the session to update filter flags and compute valid distance
    const allSessionPoints = await db.queryAll(
      `SELECT * FROM location_points WHERE duty_session_id = $1 ORDER BY recorded_at ASC`,
      [activeSession.id]
    );

    const cleaned = cleanGpsPoints(allSessionPoints);

    // Update is_filtered and filter_reason flags in database
    for (const pt of cleaned.cleanedPoints) {
      await db.run(
        `UPDATE location_points SET is_filtered = $1, filter_reason = $2 WHERE id = $3`,
        [pt.is_filtered, pt.filter_reason || null, pt.id]
      );
      if (pt.filter_reason === 'GPS_JUMP_REJECTED') hasJump = true;
    }

    // Update duty session gps_distance_km strictly from valid continuous points
    await db.run(
      `UPDATE duty_sessions SET gps_distance_km = $1, updated_at = NOW() WHERE id = $2`,
      [cleaned.totalDistanceKm, activeSession.id]
    );

    // Record audit logs for any security or quality issues detected
    if (hasMock) {
      await db.run(
        `INSERT INTO audit_logs (id, user_id, duty_session_id, action, new_value, reason, created_at)
         VALUES ($1, $2, $3, 'MOCK_LOCATION_DETECTED', 'is_mock = 1', 'Mock GPS location detected during active tracking', NOW())`,
        [uuidv4(), supervisorId, activeSession.id]
      );
    }
    if (hasJump) {
      await db.run(
        `INSERT INTO audit_logs (id, user_id, duty_session_id, action, new_value, reason, created_at)
         VALUES ($1, $2, $3, 'GPS_JUMP_REJECTED', 'Speed > 100 km/h', 'Teleportation jump rejected from route and conveyance', NOW())`,
        [uuidv4(), supervisorId, activeSession.id]
      );
    }
    if (hasLowAccuracy) {
      await db.run(
        `INSERT INTO audit_logs (id, user_id, duty_session_id, action, new_value, reason, created_at)
         VALUES ($1, $2, $3, 'LOW_ACCURACY_LOCATION', 'Accuracy > 50m', 'Poor GPS accuracy point excluded from route calculation', NOW())`,
        [uuidv4(), supervisorId, activeSession.id]
      );
    }

    // Find the latest VALID point to broadcast for live map
    const latestValidPt = cleaned.validPoints.length > 0 ? cleaned.validPoints[cleaned.validPoints.length - 1] : null;
    if (latestValidPt) {
      broadcastLocationUpdate({
        type: 'LOCATION_UPDATE',
        supervisorId,
        dutySessionId: activeSession.id,
        latitude: latestValidPt.latitude,
        longitude: latestValidPt.longitude,
        accuracy: latestValidPt.accuracy,
        speed: latestValidPt.speed,
        recordedAt: latestValidPt.recorded_at,
        currentGpsDistanceKm: cleaned.totalDistanceKm
      });
    }

    res.json({
      success: true,
      syncedCount: insertedCount,
      totalSessionPoints: allSessionPoints.length,
      validSessionPoints: cleaned.validPoints.length,
      currentGpsDistanceKm: cleaned.totalDistanceKm,
      filterStats: {
        filteredCount: cleaned.filteredCount,
        jumpCount: cleaned.jumpCount,
        lowAccuracyCount: cleaned.lowAccuracyCount,
        mockCount: cleaned.mockCount
      }
    });
  } catch (err) {
    console.error('Location sync error:', err);
    res.status(500).json({ error: 'Failed to sync locations: ' + err.message });
  }
});

// 2. Live supervisors for admin map (always picks latest VALID location)
router.get('/live', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const activeSupervisors = await db.queryAll(`
      SELECT
        u.id AS supervisor_id,
        u.name,
        u.employee_id,
        u.phone,
        ds.id AS duty_session_id,
        ds.start_time,
        ds.start_odometer_final AS start_km,
        ds.gps_distance_km,
        ds.conveyance_rate,
        (
          SELECT json_build_object(
            'latitude', lp.latitude,
            'longitude', lp.longitude,
            'accuracy', lp.accuracy,
            'speed', lp.speed,
            'heading', lp.heading,
            'recorded_at', lp.recorded_at,
            'synced_at', lp.synced_at,
            'is_filtered', lp.is_filtered,
            'filter_reason', lp.filter_reason
          )
          FROM location_points lp
          WHERE lp.duty_session_id = ds.id AND lp.is_filtered = 0
          ORDER BY lp.recorded_at DESC LIMIT 1
        ) AS last_location_json
      FROM users u
      JOIN duty_sessions ds ON ds.supervisor_id = u.id AND ds.status = 'ON_DUTY'
      WHERE u.role = 'supervisor'
    `);

    const now = Date.now();
    const result = activeSupervisors.map((item) => {
      const lastLoc = item.last_location_json || null;
      let isStale = true;
      let minutesSinceLastUpdate = null;
      let accuracyQuality = 'POOR';

      if (lastLoc?.recorded_at) {
        const lastTime = new Date(lastLoc.recorded_at).getTime();
        minutesSinceLastUpdate = Math.round((now - lastTime) / (1000 * 60));
        isStale = minutesSinceLastUpdate > config.gps.staleLocationMinutes;

        const acc = Number(lastLoc.accuracy) || 100;
        if (acc <= config.gps.preferredAccuracyMeters) {
          accuracyQuality = 'GOOD';
        } else if (acc <= config.gps.maxAccuracyMeters) {
          accuracyQuality = 'FAIR';
        } else {
          accuracyQuality = 'POOR';
        }
      }

      const rate = item.conveyance_rate || config.defaultBikeRate;
      const currentConveyance = Number(((item.gps_distance_km || 0) * rate).toFixed(2));

      return {
        ...item,
        last_location_json: undefined,
        lastLocation: lastLoc,
        isStale,
        minutesSinceLastUpdate,
        accuracyQuality,
        currentConveyance
      };
    });

    res.json({ supervisors: result });
  } catch (err) {
    console.error('Live tracking error:', err);
    res.status(500).json({ error: 'Failed to fetch live tracking data' });
  }
});

// 3. Route points and segmented polylines for a session
router.get('/routes/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await db.queryOne(
      `SELECT ds.*, u.name as supervisor_name, u.employee_id
       FROM duty_sessions ds JOIN users u ON u.id = ds.supervisor_id WHERE ds.id = $1`,
      [sessionId]
    );

    if (!session) return res.status(404).json({ error: 'Duty session not found' });

    if (req.user.role === 'supervisor' && session.supervisor_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to view this route' });
    }

    const points = await db.queryAll(
      `SELECT id, latitude, longitude, accuracy, speed, heading, altitude, provider, is_mock, is_filtered, filter_reason, recorded_at
       FROM location_points WHERE duty_session_id = $1 ORDER BY recorded_at ASC`,
      [sessionId]
    );

    // Compute route segments and signal gaps
    const cleaned = cleanGpsPoints(points);

    res.json({
      session,
      points,
      validPoints: cleaned.validPoints,
      segments: cleaned.segments,
      gaps: cleaned.gaps,
      stats: {
        totalPoints: points.length,
        validPointsCount: cleaned.validPoints.length,
        filteredCount: cleaned.filteredCount,
        jumpCount: cleaned.jumpCount,
        lowAccuracyCount: cleaned.lowAccuracyCount,
        mockCount: cleaned.mockCount,
        totalDistanceKm: cleaned.totalDistanceKm
      }
    });
  } catch (err) {
    console.error('Route points error:', err);
    res.status(500).json({ error: 'Failed to fetch route points' });
  }
});

// 4. Report Device Security Event (Developer Options enabled, Mock GPS detected, etc.)
router.post('/security-event', authenticateToken, async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { action, dutySessionId, reason, latitude, longitude, metadata } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Security action is required' });
    }

    const eventId = uuidv4();
    const reasonText = reason || `Security event detected: ${action}`;
    const payloadStr = JSON.stringify({
      latitude,
      longitude,
      metadata: metadata || {}
    });

    await db.run(
      `INSERT INTO audit_logs (id, user_id, duty_session_id, action, new_value, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [eventId, supervisorId, dutySessionId || null, action, payloadStr, reasonText]
    );

    // If developer options enabled during active duty session, flag session
    if (action === 'DEVELOPER_OPTIONS_ENABLED' && dutySessionId) {
      await db.run(
        `UPDATE duty_sessions
         SET warnings = COALESCE(warnings::text, '[]') || $1::text, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(['DEVELOPER_OPTIONS_ENABLED_DURING_DUTY']), dutySessionId]
      );
    }

    res.status(201).json({ success: true, eventId, action });
  } catch (err) {
    console.error('Security event logging error:', err);
    res.status(500).json({ error: 'Failed to record security event: ' + err.message });
  }
});

// 5. SSE Stream for Live Tracking
router.get('/stream', authenticateToken, requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => { sseClients.delete(res); });
});

export default router;
