import test from 'node:test';
import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';
import {
  cleanPointOnIngestion,
  cleanAndSegmentSessionPoints,
  calculateConveyanceDistance
} from '../src/services/gpsCleaner.js';
import { db, initDatabase } from '../src/db/database.js';

await initDatabase();

test('1. GPS Cleaning: Valid point within limits is accepted', () => {
  const point = {
    latitude: 19.0760,
    longitude: 72.8777,
    accuracy: 12.5,
    recorded_at: new Date().toISOString()
  };

  const cleaned = cleanPointOnIngestion(point, null);
  assert.strictEqual(cleaned.is_filtered, 0);
  assert.strictEqual(cleaned.filter_reason, null);
  assert.strictEqual(cleaned.accuracy_rating, 'GOOD');
});

test('2. GPS Cleaning: Accuracy > 50m is filtered as LOW_ACCURACY', () => {
  const point = {
    latitude: 19.0760,
    longitude: 72.8777,
    accuracy: 65.0,
    recorded_at: new Date().toISOString()
  };

  const cleaned = cleanPointOnIngestion(point, null);
  assert.strictEqual(cleaned.is_filtered, 1);
  assert.strictEqual(cleaned.filter_reason, 'LOW_ACCURACY');
  assert.strictEqual(cleaned.accuracy_rating, 'POOR');
});

test('3. GPS Cleaning: Stale location (> 30s) is filtered as STALE_LOCATION', () => {
  const point = {
    latitude: 19.0760,
    longitude: 72.8777,
    accuracy: 15.0,
    recorded_at: new Date(Date.now() - 45000).toISOString() // 45s ago
  };

  const cleaned = cleanPointOnIngestion(point, null);
  assert.strictEqual(cleaned.is_filtered, 1);
  assert.strictEqual(cleaned.filter_reason, 'STALE_LOCATION');
});

test('4. GPS Cleaning: Invalid coordinates are filtered', () => {
  const invalid1 = cleanPointOnIngestion({ latitude: 95.0, longitude: 72.8777, accuracy: 10 }, null);
  assert.strictEqual(invalid1.is_filtered, 1);
  assert.strictEqual(invalid1.filter_reason, 'INVALID_COORDINATES');

  const invalid2 = cleanPointOnIngestion({ latitude: null, longitude: 72.8777, accuracy: 10 }, null);
  assert.strictEqual(invalid2.is_filtered, 1);
  assert.strictEqual(invalid2.filter_reason, 'INVALID_COORDINATES');
});

test('5. GPS Cleaning: Mock location is filtered and flagged', () => {
  const point = {
    latitude: 19.0760,
    longitude: 72.8777,
    accuracy: 10.0,
    is_mock: true,
    recorded_at: new Date().toISOString()
  };

  const cleaned = cleanPointOnIngestion(point, null);
  assert.strictEqual(cleaned.is_filtered, 1);
  assert.strictEqual(cleaned.filter_reason, 'MOCK_LOCATION');
});

test('6. GPS Cleaning: Speed jump > 100 km/h is rejected as GPS_JUMP_REJECTED', () => {
  const t0 = Date.now();
  const lastValid = {
    latitude: 19.0760,
    longitude: 72.8777,
    recorded_at: new Date(t0).toISOString()
  };

  // Jump ~5 km away in 5 seconds (that's ~3600 km/h, unreal straight line jump!)
  const jumpPoint = {
    latitude: 19.1200,
    longitude: 72.8777,
    accuracy: 15.0,
    recorded_at: new Date(t0 + 5000).toISOString()
  };

  const cleaned = cleanPointOnIngestion(jumpPoint, lastValid);
  assert.strictEqual(cleaned.is_filtered, 1);
  assert.strictEqual(cleaned.filter_reason, 'GPS_JUMP_REJECTED');
});

test('7. Route Segmentation: Discontinuous gaps (>5 min or >1km) produce split segments and gap indicators', () => {
  const baseTime = Date.now() - 86400000; // 24 hours ago

  // Segment 1: 3 close points
  const p1 = { id: 1, latitude: 19.0760, longitude: 72.8777, accuracy: 10, is_filtered: 0, recorded_at: new Date(baseTime).toISOString() };
  const p2 = { id: 2, latitude: 19.0765, longitude: 72.8780, accuracy: 10, is_filtered: 0, recorded_at: new Date(baseTime + 15000).toISOString() };
  const p3 = { id: 3, latitude: 19.0770, longitude: 72.8785, accuracy: 10, is_filtered: 0, recorded_at: new Date(baseTime + 30000).toISOString() };

  // Discontinuous jump: 20 minutes later and 3 km away!
  const p4 = { id: 4, latitude: 19.1050, longitude: 72.8950, accuracy: 10, is_filtered: 0, recorded_at: new Date(baseTime + 1200000).toISOString() };
  const p5 = { id: 5, latitude: 19.1055, longitude: 72.8955, accuracy: 10, is_filtered: 0, recorded_at: new Date(baseTime + 1215000).toISOString() };

  const allPoints = [p1, p2, p3, p4, p5];
  const result = cleanAndSegmentSessionPoints(allPoints, 1000, 5);

  assert.strictEqual(result.segments.length, 2, 'Should be split into exactly 2 continuous segments');
  assert.strictEqual(result.segments[0].length, 3, 'First segment should contain 3 points');
  assert.strictEqual(result.segments[1].length, 2, 'Second segment should contain 2 points');

  assert.strictEqual(result.gaps.length, 1, 'Should record exactly 1 signal gap break');
  assert.strictEqual(result.gaps[0].fromPoint.id, 3);
  assert.strictEqual(result.gaps[0].toPoint.id, 4);
  assert.ok(result.gaps[0].timeGapMinutes >= 19, 'Time gap should be around 19-20 minutes');
  assert.ok(result.gaps[0].distanceMeters > 1000, 'Distance gap should be > 1000m');
});

test('8. Accurate Conveyance Distance: Excludes signal gap straight-line distances', () => {
  const baseTime = Date.now() - 86400000; // 24 hours ago

  // Segment 1: moved ~100 meters
  const p1 = { latitude: 19.076000, longitude: 72.877700, accuracy: 10, is_filtered: 0, recorded_at: new Date(baseTime).toISOString() };
  const p2 = { latitude: 19.076900, longitude: 72.877700, accuracy: 10, is_filtered: 0, recorded_at: new Date(baseTime + 15000).toISOString() };

  // GAP: 50 km jump over 2 hours (e.g. flight, phone turned off, cell tower glitch)
  const p3 = { latitude: 19.500000, longitude: 72.877700, accuracy: 10, is_filtered: 0, recorded_at: new Date(baseTime + 7200000).toISOString() };
  // Segment 2: moved ~100 meters
  const p4 = { latitude: 19.500900, longitude: 72.877700, accuracy: 10, is_filtered: 0, recorded_at: new Date(baseTime + 7215000).toISOString() };

  const rawPoints = [p1, p2, p3, p4];

  const distanceKm = calculateConveyanceDistance(rawPoints, 1000, 5);

  // If false straight line was included, distance would be > 47 km!
  // With gap exclusion, distance should only be ~0.2 km!
  assert.ok(distanceKm < 1.0, `Calculated distance should exclude the 50km jump! Got: ${distanceKm} km`);
  assert.ok(distanceKm >= 0.15, `Calculated distance should include valid movements. Got: ${distanceKm} km`);
});

test('9. Security event insertion into audit_logs', async () => {
  // Find an existing user or create one
  let user = await db.queryOne(`SELECT id FROM users LIMIT 1`);
  if (!user) {
    const testId = uuidv4();
    await db.query(`
      INSERT INTO users (id, employee_id, name, phone, password_hash, role)
      VALUES ($1, 'SEC_TEST', 'Sec Test', '9999999999', 'hash', 'supervisor')
    `, [testId]);
    user = { id: testId };
  }

  const eventId = uuidv4();
  const result = await db.query(
    `INSERT INTO audit_logs (id, user_id, duty_session_id, action, new_value, reason, created_at)
     VALUES ($1, $2, NULL, 'DEVELOPER_OPTIONS_ENABLED', $3, $4, NOW())
     RETURNING *`,
    [
      eventId,
      user.id,
      JSON.stringify({ reason: 'Developer options detected active' }),
      'Developer options detected active on supervisor device'
    ]
  );

  assert.ok(result.rows.length === 1);
  assert.strictEqual(result.rows[0].action, 'DEVELOPER_OPTIONS_ENABLED');
  assert.strictEqual(result.rows[0].id, eventId);
});
