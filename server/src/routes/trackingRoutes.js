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

// 1. Sync GPS Locations (Batch with deduplication via ON CONFLICT DO NOTHING)
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
    for (const p of points) {
      const lat = parseFloat(p.latitude);
      const lng = parseFloat(p.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      const clientUuid = p.clientUuid || uuidv4();
      const acc = p.accuracy != null ? parseFloat(p.accuracy) : null;
      const spd = p.speed != null ? parseFloat(p.speed) : null;
      const hdg = p.heading != null ? parseFloat(p.heading) : null;
      const recAt = p.recordedAt || new Date().toISOString();

      const result = await db.run(
        `INSERT INTO location_points (id, client_uuid, duty_session_id, supervisor_id, latitude, longitude, accuracy, speed, heading, is_filtered, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10)
         ON CONFLICT (client_uuid) DO NOTHING`,
        [uuidv4(), clientUuid, activeSession.id, supervisorId, lat, lng, acc, spd, hdg, recAt]
      );
      if (result.rowCount > 0) insertedCount++;
    }

    const allSessionPoints = await db.queryAll(
      `SELECT * FROM location_points WHERE duty_session_id = $1 ORDER BY recorded_at ASC`,
      [activeSession.id]
    );

    const { totalDistanceKm } = cleanGpsPoints(allSessionPoints);

    await db.run(
      `UPDATE duty_sessions SET gps_distance_km = $1, updated_at = NOW() WHERE id = $2`,
      [totalDistanceKm, activeSession.id]
    );

    const latestPt = points[points.length - 1];
    broadcastLocationUpdate({
      type: 'LOCATION_UPDATE',
      supervisorId,
      dutySessionId: activeSession.id,
      latitude: latestPt.latitude,
      longitude: latestPt.longitude,
      accuracy: latestPt.accuracy,
      speed: latestPt.speed,
      recordedAt: latestPt.recordedAt || new Date().toISOString(),
      currentGpsDistanceKm: totalDistanceKm
    });

    res.json({
      success: true,
      syncedCount: insertedCount,
      totalSessionPoints: allSessionPoints.length,
      currentGpsDistanceKm: totalDistanceKm
    });
  } catch (err) {
    console.error('Location sync error:', err);
    res.status(500).json({ error: 'Failed to sync locations: ' + err.message });
  }
});

// 2. Live supervisors for admin map
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
            'synced_at', lp.synced_at
          )
          FROM location_points lp
          WHERE lp.duty_session_id = ds.id
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

      if (lastLoc?.recorded_at) {
        const lastTime = new Date(lastLoc.recorded_at).getTime();
        minutesSinceLastUpdate = Math.round((now - lastTime) / (1000 * 60));
        isStale = minutesSinceLastUpdate > config.gps.staleLocationMinutes;
      }

      const rate = item.conveyance_rate || config.defaultBikeRate;
      const currentConveyance = Number(((item.gps_distance_km || 0) * rate).toFixed(2));

      return { ...item, last_location_json: undefined, lastLocation: lastLoc, isStale, minutesSinceLastUpdate, currentConveyance };
    });

    res.json({ supervisors: result });
  } catch (err) {
    console.error('Live tracking error:', err);
    res.status(500).json({ error: 'Failed to fetch live tracking data' });
  }
});

// 3. Route points for a session
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
      `SELECT id, latitude, longitude, accuracy, speed, heading, is_filtered, recorded_at
       FROM location_points WHERE duty_session_id = $1 ORDER BY recorded_at ASC`,
      [sessionId]
    );

    res.json({ session, points });
  } catch (err) {
    console.error('Route points error:', err);
    res.status(500).json({ error: 'Failed to fetch route points' });
  }
});

// 4. SSE Stream for Live Tracking
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
