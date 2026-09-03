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
  console.log('🌱 Seeding database with clean state...');

  const passwordAdmin = await bcrypt.hash('Soumya@123', 10);
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
  `).run(adminId, 'soumya.ghosh@genus.in', 'Soumya Ghosh', '9876543210', passwordAdmin, 'admin', 'active');

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

  // 3. Clear duty sessions & locations & audit logs (Clean 0 KM slate)
  db.prepare('DELETE FROM duty_sessions').run();
  db.prepare('DELETE FROM location_points').run();
  db.prepare('DELETE FROM audit_logs').run();

  console.log('✅ Database seeded with clean 0 KM state!');
  console.log('Credentials:');
  console.log('  Admin:      soumya.ghosh@genus.in / Soumya@123');
  console.log('  Supervisor: EMP001 / supervisor123');
}

export async function ensureAdminAndCleanState() {
  const adminEmail = 'soumya.ghosh@genus.in';
  const adminPass = 'Soumya@123';
  const passwordHash = await bcrypt.hash(adminPass, 10);

  // Check if soumya.ghosh@genus.in exists
  const existingAdmin = db.prepare('SELECT * FROM users WHERE employee_id = ? COLLATE NOCASE').get(adminEmail);
  if (existingAdmin) {
    db.prepare('UPDATE users SET password_hash = ?, role = "admin", status = "active", name = "Soumya Ghosh" WHERE id = ?').run(passwordHash, existingAdmin.id);
  } else {
    db.prepare(`
      INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
      VALUES (?, ?, 'Soumya Ghosh', '9876543210', ?, 'admin', 'active')
    `).run(uuidv4(), adminEmail, passwordHash);
  }

  // Remove old demo username 'admin'
  db.prepare('DELETE FROM users WHERE employee_id = "admin"').run();

  // Clear all demo sessions and demo KM as requested
  db.prepare('DELETE FROM duty_sessions').run();
  db.prepare('DELETE FROM location_points').run();
  db.prepare('DELETE FROM audit_logs').run();

  // Ensure default conveyance rate exists
  const rateCount = db.prepare('SELECT COUNT(*) as count FROM conveyance_rates').get()?.count || 0;
  if (rateCount === 0) {
    db.prepare(`
      INSERT INTO conveyance_rates (id, vehicle_type, rate_per_km, effective_from, active)
      VALUES (?, 'Bike', 4.50, CURRENT_TIMESTAMP, 1)
    `).run(uuidv4());
  }

  console.log(`✅ Admin configured: ${adminEmail} / ${adminPass}`);
  console.log('✅ All demo KM and sessions cleared (clean 0 KM slate).');
}

if (process.argv[1]?.endsWith('seed.js')) {
  seed().catch(console.error);
}
