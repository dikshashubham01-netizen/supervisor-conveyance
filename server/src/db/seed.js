import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from './database.js';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';

initDatabase();

// Create sample image assets in uploads if not present
function createSampleSvg(filename, label, subtext, color = '#2563eb') {
  const filePath = path.join(config.uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <rect width="100%" height="100%" fill="#1e293b"/>
      <circle cx="320" cy="200" r="90" fill="${color}" opacity="0.25"/>
      <circle cx="320" cy="200" r="60" fill="${color}" opacity="0.4"/>
      <text x="50%" y="210" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#f8fafc" text-anchor="middle">${label}</text>
      <text x="50%" y="300" font-family="Arial, sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">${subtext}</text>
      <text x="50%" y="440" font-family="Arial, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">Supervisor Conveyance System • Verified</text>
    </svg>`;
    fs.writeFileSync(filePath, svgContent);
  }
  return filename;
}

export async function seed() {
  console.log('🌱 Seeding database...');

  const passwordAdmin = await bcrypt.hash('admin123', 10);
  const passwordSupervisor = await bcrypt.hash('supervisor123', 10);

  // 1. Conveyance Rates
  db.prepare('DELETE FROM conveyance_rates').run();
  const rateId = uuidv4();
  db.prepare(`
    INSERT INTO conveyance_rates (id, vehicle_type, rate_per_km, effective_from, active)
    VALUES (?, ?, ?, ?, ?)
  `).run(rateId, 'Bike', 4.50, '2026-01-01 00:00:00', 1);

  // 2. Users
  db.prepare('DELETE FROM users').run();

  const adminId = uuidv4();
  db.prepare(`
    INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(adminId, 'admin', 'Operations Admin', '9876543210', passwordAdmin, 'admin', 'active');

  const sup1Id = uuidv4();
  db.prepare(`
    INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sup1Id, 'EMP001', 'John Doe', '9123456780', passwordSupervisor, 'supervisor', 'active');

  const sup2Id = uuidv4();
  db.prepare(`
    INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sup2Id, 'EMP002', 'Priya Sharma', '9123456781', passwordSupervisor, 'supervisor', 'active');

  const sup3Id = uuidv4();
  db.prepare(`
    INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sup3Id, 'EMP003', 'Amit Patel', '9123456782', passwordSupervisor, 'supervisor', 'active');

  // Sample SVG assets
  const selfieStart1 = createSampleSvg('selfie_start_emp001.svg', 'LIVE SELFIE: START', 'EMP001 • John Doe • 09:15 AM', '#10b981');
  const odoStart1 = createSampleSvg('odo_start_emp001.svg', 'ODOMETER: 12,458 KM', 'Start Duty Reading • Confidence: 98%', '#3b82f6');
  const selfieEnd1 = createSampleSvg('selfie_end_emp001.svg', 'LIVE SELFIE: END', 'EMP001 • John Doe • 05:45 PM', '#f59e0b');
  const odoEnd1 = createSampleSvg('odo_end_emp001.svg', 'ODOMETER: 12,490 KM', 'End Duty Reading • Confidence: 97%', '#3b82f6');

  const selfieStart2 = createSampleSvg('selfie_start_emp002.svg', 'LIVE SELFIE: START', 'EMP002 • Priya Sharma • 09:30 AM', '#10b981');
  const odoStart2 = createSampleSvg('odo_start_emp002.svg', 'ODOMETER: 24,110 KM', 'Start Duty Reading • Confidence: 99%', '#3b82f6');
  const selfieEnd2 = createSampleSvg('selfie_end_emp002.svg', 'LIVE SELFIE: END', 'EMP002 • Priya Sharma • 06:10 PM', '#f59e0b');
  const odoEnd2 = createSampleSvg('odo_end_emp002.svg', 'ODOMETER: 24,152 KM', 'End Duty Reading • Confidence: 96%', '#3b82f6');

  // 3. Clear duty sessions & locations & audit logs
  db.prepare('DELETE FROM duty_sessions').run();
  db.prepare('DELETE FROM location_points').run();
  db.prepare('DELETE FROM audit_logs').run();

  // Session 1: EMP001 John Doe - Yesterday (APPROVED)
  // Start: 12,458 KM, End: 12,490 KM -> Odo = 32 KM. GPS = 34.72 KM.
  // Approved Distance = 32 KM (Lower valid distance selected). Conveyance = 32 * 4.5 = ₹144.00
  const session1Id = uuidv4();
  db.prepare(`
    INSERT INTO duty_sessions (
      id, supervisor_id, start_time, end_time,
      start_latitude, start_longitude, end_latitude, end_longitude,
      start_selfie, end_selfie, start_odometer_image, end_odometer_image,
      start_odometer_ocr, start_odometer_manual, start_odometer_final,
      end_odometer_ocr, end_odometer_manual, end_odometer_final,
      gps_distance_km, odometer_distance_km, approved_distance_km, distance_selection_reason,
      conveyance_rate, conveyance_amount, status, review_notes, warnings
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    session1Id, sup1Id, '2026-09-02 09:15:00', '2026-09-02 17:45:00',
    19.0760, 72.8777, 19.0820, 72.8850,
    selfieStart1, selfieEnd1, odoStart1, odoEnd1,
    12458, 12458, 12458,
    12491, 12490, 12490,
    34.72, 32.0, 32.0, 'Lower Valid Distance Selected (Odometer: 32.00 KM vs GPS: 34.72 KM)',
    4.50, 144.00, 'APPROVED', 'Verified by Admin. Photos and readings clear.', '[]'
  );

  // Generate sample GPS route for Session 1 (Mumbai route)
  const coords1 = [
    { lat: 19.0760, lng: 72.8777, time: '2026-09-02 09:15:00', speed: 18 },
    { lat: 19.0812, lng: 72.8821, time: '2026-09-02 10:30:00', speed: 28 },
    { lat: 19.0950, lng: 72.8940, time: '2026-09-02 12:15:00', speed: 24 },
    { lat: 19.1120, lng: 72.9050, time: '2026-09-02 14:00:00', speed: 32 },
    { lat: 19.0980, lng: 72.8910, time: '2026-09-02 15:45:00', speed: 20 },
    { lat: 19.0820, lng: 72.8850, time: '2026-09-02 17:45:00', speed: 15 },
  ];
  const insertLoc = db.prepare(`
    INSERT INTO location_points (id, client_uuid, duty_session_id, supervisor_id, latitude, longitude, accuracy, speed, heading, is_filtered, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);
  coords1.forEach((c) => {
    insertLoc.run(uuidv4(), uuidv4(), session1Id, sup1Id, c.lat, c.lng, 12.5, c.speed, 90, c.time);
  });

  // Session 2: EMP002 Priya Sharma - Today (PENDING_VERIFICATION)
  // Start: 24,110 KM, End: 24,152 KM -> Odo = 42 KM. GPS = 40.50 KM.
  // Approved = 40.50 KM (GPS is lower valid distance). Conveyance = 40.50 * 4.5 = ₹182.25
  const session2Id = uuidv4();
  db.prepare(`
    INSERT INTO duty_sessions (
      id, supervisor_id, start_time, end_time,
      start_latitude, start_longitude, end_latitude, end_longitude,
      start_selfie, end_selfie, start_odometer_image, end_odometer_image,
      start_odometer_ocr, start_odometer_manual, start_odometer_final,
      end_odometer_ocr, end_odometer_manual, end_odometer_final,
      gps_distance_km, odometer_distance_km, approved_distance_km, distance_selection_reason,
      conveyance_rate, conveyance_amount, status, review_notes, warnings
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    session2Id, sup2Id, '2026-09-03 09:30:00', '2026-09-03 14:15:00',
    19.1136, 72.8697, 19.1415, 72.8428,
    selfieStart2, selfieEnd2, odoStart2, odoEnd2,
    24110, 24110, 24110,
    24152, 24152, 24152,
    40.50, 42.0, 40.50, 'Lower Valid Distance Selected (GPS: 40.50 KM vs Odometer: 42.00 KM)',
    4.50, 182.25, 'PENDING_VERIFICATION', null, '[]'
  );

  const coords2 = [
    { lat: 19.1136, lng: 72.8697, time: '2026-09-03 09:30:00', speed: 20 },
    { lat: 19.1250, lng: 72.8580, time: '2026-09-03 10:45:00', speed: 29 },
    { lat: 19.1380, lng: 72.8510, time: '2026-09-03 12:30:00', speed: 25 },
    { lat: 19.1415, lng: 72.8428, time: '2026-09-03 14:15:00', speed: 16 },
  ];
  coords2.forEach((c) => {
    insertLoc.run(uuidv4(), uuidv4(), session2Id, sup2Id, c.lat, c.lng, 10.0, c.speed, 45, c.time);
  });

  // Session 3: EMP003 Amit Patel - Active duty currently ON_DUTY
  const session3Id = uuidv4();
  const selfieStart3 = createSampleSvg('selfie_start_emp003.svg', 'LIVE SELFIE: START', 'EMP003 • Amit Patel • 10:00 AM', '#10b981');
  const odoStart3 = createSampleSvg('odo_start_emp003.svg', 'ODOMETER: 8,320 KM', 'Start Duty Reading • Confidence: 99%', '#3b82f6');

  db.prepare(`
    INSERT INTO duty_sessions (
      id, supervisor_id, start_time,
      start_latitude, start_longitude,
      start_selfie, start_odometer_image,
      start_odometer_ocr, start_odometer_manual, start_odometer_final,
      gps_distance_km, status, conveyance_rate
    ) VALUES (
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )
  `).run(
    session3Id, sup3Id, '2026-09-03 10:00:00',
    19.0178, 72.8478,
    selfieStart3, odoStart3,
    8320, 8320, 8320,
    14.25, 'ON_DUTY', 4.50
  );

  const coords3 = [
    { lat: 19.0178, lng: 72.8478, time: '2026-09-03 10:00:00', speed: 22 },
    { lat: 19.0250, lng: 72.8520, time: '2026-09-03 11:15:00', speed: 30 },
    { lat: 19.0380, lng: 72.8610, time: '2026-09-03 13:00:00', speed: 26 },
    { lat: 19.0495, lng: 72.8712, time: '2026-09-03 14:40:00', speed: 24 }
  ];
  coords3.forEach((c) => {
    insertLoc.run(uuidv4(), uuidv4(), session3Id, sup3Id, c.lat, c.lng, 8.5, c.speed, 60, c.time);
  });

  // Audit log entry for Session 1 approval
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, duty_session_id, action, old_value, new_value, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(), adminId, session1Id, 'APPROVE_DUTY_SESSION',
    'PENDING_VERIFICATION', 'APPROVED', 'Photos and readings verified against GPS track'
  );

  console.log('✅ Database seeded successfully!');
  console.log('Credentials:');
  console.log('  Admin:      admin / admin123');
  console.log('  Supervisor: EMP001 / supervisor123 (John Doe)');
  console.log('  Supervisor: EMP002 / supervisor123 (Priya Sharma)');
  console.log('  Supervisor: EMP003 / supervisor123 (Amit Patel - Currently ON DUTY)');
}

if (process.argv[1]?.endsWith('seed.js')) {
  seed().catch(console.error);
}
