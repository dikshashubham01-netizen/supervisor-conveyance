import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from './database.js';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';

initDatabase();

// ─── ensureAdminAndCleanState ─────────────────────────────────────────────────
// Runs on EVERY server startup. CRITICAL RULES:
//   1. NEVER delete any supervisor accounts — all admin-created IDs survive restarts.
//   2. NEVER delete duty_sessions, location_points, audit_logs — all field data is permanent.
//   3. Only INSERT if missing. UPDATE admin password. Never wipe anything.
// ─────────────────────────────────────────────────────────────────────────────
export async function ensureAdminAndCleanState() {
  const adminEmail = 'soumya.ghosh@genus.in';
  const adminPass = 'Soumya@123';
  const passwordHash = await bcrypt.hash(adminPass, 10);

  // 1. Ensure admin account exists with correct password
  const existingAdmin = db.prepare('SELECT * FROM users WHERE employee_id = ? COLLATE NOCASE').get(adminEmail);
  if (existingAdmin) {
    db.prepare(`
      UPDATE users SET password_hash = ?, role = 'admin', status = 'active', name = 'Soumya Ghosh'
      WHERE id = ?
    `).run(passwordHash, existingAdmin.id);
    console.log('✅ Admin account verified.');
  } else {
    db.prepare(`
      INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
      VALUES (?, ?, 'Soumya Ghosh', '9876543210', ?, 'admin', 'active')
    `).run(uuidv4(), adminEmail, passwordHash);
    console.log('✅ Admin account created:', adminEmail);
  }

  // 2. Remove old generic 'admin' username if it ever existed (old versions)
  db.prepare(`DELETE FROM users WHERE employee_id = 'admin'`).run();

  // 3. Ensure EMP001 (Shubham) exists — insert ONLY if missing
  const existingEmp001 = db.prepare(`SELECT id FROM users WHERE employee_id = 'EMP001'`).get();
  if (!existingEmp001) {
    const supervisorPassHash = await bcrypt.hash('Soumya@123', 10);
    db.prepare(`
      INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
      VALUES (?, 'EMP001', 'Shubham', '9216013070', ?, 'supervisor', 'active')
    `).run(uuidv4(), supervisorPassHash);
    console.log('✅ Supervisor EMP001 (Shubham) created.');
  }

  // 4. Ensure default conveyance rate exists — insert only if none exist
  const rateCount = db.prepare('SELECT COUNT(*) as count FROM conveyance_rates').get()?.count || 0;
  if (rateCount === 0) {
    db.prepare(`
      INSERT INTO conveyance_rates (id, vehicle_type, rate_per_km, effective_from, active)
      VALUES (?, 'Bike', 4.50, CURRENT_TIMESTAMP, 1)
    `).run(uuidv4());
    console.log('✅ Default conveyance rate created: ₹4.50/KM for Bike');
  }

  // 5. Log all supervisor accounts so they appear in server logs on restart
  const allSupervisors = db.prepare(`
    SELECT employee_id, name, phone, status FROM users WHERE role = 'supervisor' ORDER BY created_at ASC
  `).all();
  console.log(`\n📋 ACTIVE SUPERVISOR ACCOUNTS (${allSupervisors.length} total):`);
  allSupervisors.forEach(s => {
    console.log(`   [${s.status.toUpperCase()}] ${s.employee_id.padEnd(12)} — ${s.name} (${s.phone})`);
  });

  console.log(`✅ Admin: ${adminEmail} — ALL data fully preserved.\n`);
}

// ─── seed() — Manual dev-only full reset ─────────────────────────────────────
// WARNING: Wipes everything. Never call automatically in production.
export async function seed() {
  console.log('⚠️  MANUAL SEED RESET — Wiping all data...');

  const passwordAdmin = await bcrypt.hash('Soumya@123', 10);
  const passwordSupervisor = await bcrypt.hash('Soumya@123', 10);

  db.prepare('DELETE FROM conveyance_rates').run();
  db.prepare(`
    INSERT INTO conveyance_rates (id, vehicle_type, rate_per_km, effective_from, active)
    VALUES (?, 'Bike', 4.50, '2026-01-01 00:00:00', 1)
  `).run(uuidv4());

  db.prepare('DELETE FROM users').run();
  db.prepare(`
    INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
    VALUES (?, 'soumya.ghosh@genus.in', 'Soumya Ghosh', '9876543210', ?, 'admin', 'active')
  `).run(uuidv4(), passwordAdmin);

  db.prepare(`
    INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
    VALUES (?, 'EMP001', 'Shubham', '9216013070', ?, 'supervisor', 'active')
  `).run(uuidv4(), passwordSupervisor);

  db.prepare('DELETE FROM duty_sessions').run();
  db.prepare('DELETE FROM location_points').run();
  db.prepare('DELETE FROM audit_logs').run();

  console.log('✅ Database seeded. Admin: soumya.ghosh@genus.in / Soumya@123');
}

if (process.argv[1]?.endsWith('seed.js')) {
  seed().catch(console.error);
}
