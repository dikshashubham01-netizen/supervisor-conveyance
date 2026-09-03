import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');

test('E2E Lifecycle: Auth -> Start Duty -> GPS Tracking -> End Duty -> Admin Verification & Audit', async () => {
  // Start backend server on an alternate port for testing or test directly against API
  const { default: express } = await import('express');
  const { config } = await import('../src/config/index.js');
  const { initDatabase, db } = await import('../src/db/database.js');
  const { seed } = await import('../src/db/seed.js');

  // Reset database with clean seed
  await seed();

  // Dynamically import app routes
  const authRoutes = (await import('../src/routes/authRoutes.js')).default;
  const dutyRoutes = (await import('../src/routes/dutyRoutes.js')).default;
  const trackingRoutes = (await import('../src/routes/trackingRoutes.js')).default;
  const reportRoutes = (await import('../src/routes/reportRoutes.js')).default;
  const settingsRoutes = (await import('../src/routes/settingsRoutes.js')).default;
  const auditRoutes = (await import('../src/routes/auditRoutes.js')).default;

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/duty', dutyRoutes);
  app.use('/api/tracking', trackingRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/audit', auditRoutes);

  const testServer = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = testServer.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // 1. Supervisor Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: 'EMP001', password: 'supervisor123' })
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert(loginData.token, 'Token must be returned');
    assert.strictEqual(loginData.user.employee_id, 'EMP001');
    const supToken = loginData.token;

    // 2. Admin Login
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: 'admin', password: 'admin123' })
    });
    assert.strictEqual(adminLoginRes.status, 200);
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;

    // 3. Start Duty with sample files
    const dummyFilePath = path.join(serverRoot, 'uploads', 'selfie_start_emp001.svg');
    const fileBuffer = fs.readFileSync(dummyFilePath);

    const formDataStart = new FormData();
    formDataStart.append('selfie', new Blob([fileBuffer], { type: 'image/svg+xml' }), 'selfie.svg');
    formDataStart.append('odometer', new Blob([fileBuffer], { type: 'image/svg+xml' }), 'odometer.svg');
    formDataStart.append('latitude', '19.0760');
    formDataStart.append('longitude', '72.8777');
    formDataStart.append('accuracy', '10');
    formDataStart.append('odometerOcr', '15000');
    formDataStart.append('odometerManual', '15000');
    formDataStart.append('odometerFinal', '15000');

    const startDutyRes = await fetch(`${baseUrl}/duty/start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supToken}` },
      body: formDataStart
    });
    assert.strictEqual(startDutyRes.status, 201);
    const startData = await startDutyRes.json();
    assert.strictEqual(startData.status, 'ON_DUTY');
    const sessionId = startData.sessionId;

    // 4. GPS Tracking Sync
    const syncRes = await fetch(`${baseUrl}/tracking/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supToken}`
      },
      body: JSON.stringify({
        points: [
          {
            clientUuid: 'test-uuid-1',
            latitude: 19.0800,
            longitude: 72.8800,
            accuracy: 8,
            speed: 25,
            recordedAt: new Date(Date.now() + 60000).toISOString()
          },
          {
            clientUuid: 'test-uuid-2',
            latitude: 19.0900,
            longitude: 72.8900,
            accuracy: 9,
            speed: 30,
            recordedAt: new Date(Date.now() + 120000).toISOString()
          }
        ]
      })
    });
    assert.strictEqual(syncRes.status, 200);
    const syncData = await syncRes.json();
    assert.strictEqual(syncData.success, true);
    assert.strictEqual(syncData.syncedCount, 2);
    assert(syncData.currentGpsDistanceKm > 0, 'Distance should be greater than zero');

    // 5. End Duty
    // Odometer: Start = 15000, End = 15020 -> Odometer Distance = 20 KM
    // System should automatically select lower valid distance
    const formDataEnd = new FormData();
    formDataEnd.append('selfie', new Blob([fileBuffer], { type: 'image/svg+xml' }), 'selfie_end.svg');
    formDataEnd.append('odometer', new Blob([fileBuffer], { type: 'image/svg+xml' }), 'odometer_end.svg');
    formDataEnd.append('latitude', '19.0920');
    formDataEnd.append('longitude', '72.8920');
    formDataEnd.append('accuracy', '10');
    formDataEnd.append('odometerOcr', '15020');
    formDataEnd.append('odometerManual', '15020');
    formDataEnd.append('odometerFinal', '15020');

    const endDutyRes = await fetch(`${baseUrl}/duty/end`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${supToken}` },
      body: formDataEnd
    });
    assert.strictEqual(endDutyRes.status, 200);
    const endData = await endDutyRes.json();
    assert(endData.summary, 'Summary returned');
    assert.strictEqual(endData.summary.start_odometer_final, 15000);
    assert.strictEqual(endData.summary.end_odometer_final, 15020);
    assert.strictEqual(endData.summary.odometer_distance_km, 20);
    assert(endData.summary.approved_distance_km > 0);
    assert(endData.summary.conveyance_amount > 0);
    assert(endData.summary.status === 'PENDING_VERIFICATION' || endData.summary.status === 'NEEDS_REVIEW');

    // 6. Admin Manual Override with Reason & Audit Log
    const verifyRes = await fetch(`${baseUrl}/duty/${sessionId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        action: 'OVERRIDE_KM',
        approvedDistanceKm: 18.50,
        reason: 'Adjusted for known client detour per site supervisor log'
      })
    });
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.status, 'APPROVED');
    assert.strictEqual(verifyData.approvedDistanceKm, 18.50);
    assert.strictEqual(verifyData.conveyanceAmount, 18.50 * 4.50);

    // 7. Audit Log Inspection
    const auditRes = await fetch(`${baseUrl}/audit?dutySessionId=${sessionId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(auditRes.status, 200);
    const auditData = await auditRes.json();
    assert(auditData.logs.some((l) => l.action === 'OVERRIDE_APPROVED_KM'));
    const overrideLog = auditData.logs.find((l) => l.action === 'OVERRIDE_APPROVED_KM');
    assert.strictEqual(overrideLog.reason, 'Adjusted for known client detour per site supervisor log');

    // 8. Daily Reports Generation
    const reportsRes = await fetch(`${baseUrl}/reports`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(reportsRes.status, 200);
    const reportsData = await reportsRes.json();
    assert(reportsData.reportRows.length > 0);
    assert(reportsData.totals.totalConveyance > 0);

  } finally {
    testServer.close();
  }
});
