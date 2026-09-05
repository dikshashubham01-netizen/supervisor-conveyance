import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from './database.js';

// ─── ensureAdminAndCleanState ─────────────────────────────────────────────────
// Runs on every server startup.
// RULES: Never delete supervisors. Only add missing admin + EMP001 + default rate.
// ─────────────────────────────────────────────────────────────────────────────
export async function ensureAdminAndCleanState() {
  const adminEmail = 'soumya.ghosh@genus.in';
  const adminPass = 'Soumya@123';
  const passwordHash = await bcrypt.hash(adminPass, 10);

  // 1. Upsert admin account
  const existingAdmin = await db.queryOne(
    'SELECT * FROM users WHERE LOWER(employee_id) = LOWER($1)',
    [adminEmail]
  );

  if (existingAdmin) {
    await db.run(
      `UPDATE users SET password_hash = $1, role = 'admin', status = 'active', name = 'Soumya Ghosh', updated_at = NOW() WHERE id = $2`,
      [passwordHash, existingAdmin.id]
    );
    console.log('✅ Admin account verified.');
  } else {
    await db.run(
      `INSERT INTO users (id, employee_id, name, phone, password_hash, role, status) VALUES ($1, $2, 'Soumya Ghosh', '9876543210', $3, 'admin', 'active')`,
      [uuidv4(), adminEmail, passwordHash]
    );
    console.log('✅ Admin account created:', adminEmail);
  }

  // 2. Remove legacy 'admin' username
  await db.run(`DELETE FROM users WHERE employee_id = 'admin'`);

  // 3. Ensure EMP001 (Shubham) exists
  const existingEmp001 = await db.queryOne(`SELECT id FROM users WHERE employee_id = 'EMP001'`);
  if (!existingEmp001) {
    const supervisorPassHash = await bcrypt.hash('Soumya@123', 10);
    await db.run(
      `INSERT INTO users (id, employee_id, name, phone, password_hash, role, status) VALUES ($1, 'EMP001', 'Shubham', '9216013070', $2, 'supervisor', 'active')`,
      [uuidv4(), supervisorPassHash]
    );
    console.log('✅ Supervisor EMP001 (Shubham) created.');
  }

  // 4. Ensure default conveyance rate
  const rateCount = await db.queryOne('SELECT COUNT(*) as count FROM conveyance_rates');
  if (parseInt(rateCount?.count || 0) === 0) {
    await db.run(
      `INSERT INTO conveyance_rates (id, vehicle_type, rate_per_km, effective_from, active) VALUES ($1, 'Bike', 4.50, NOW(), 1)`,
      [uuidv4()]
    );
    console.log('✅ Default conveyance rate created: ₹4.50/KM for Bike');
  }

  // 5. Log all supervisors on startup
  const allSupervisors = await db.queryAll(
    `SELECT employee_id, name, phone, status FROM users WHERE role = 'supervisor' ORDER BY created_at ASC`
  );
  console.log(`\n📋 ACTIVE SUPERVISOR ACCOUNTS (${allSupervisors.length} total):`);
  allSupervisors.forEach(s => {
    console.log(`   [${s.status.toUpperCase()}] ${s.employee_id.padEnd(12)} — ${s.name} (${s.phone})`);
  });
  console.log(`✅ Admin: ${adminEmail} — ALL data preserved in Supabase.\n`);
}

// ─── seed() — Manual reset only ──────────────────────────────────────────────
export async function seed() {
  console.log('⚠️  MANUAL SEED RESET — Wiping all data...');

  const passwordAdmin = await bcrypt.hash('Soumya@123', 10);
  const passwordSupervisor = await bcrypt.hash('Soumya@123', 10);

  await db.run('DELETE FROM audit_logs');
  await db.run('DELETE FROM location_points');
  await db.run('DELETE FROM duty_sessions');
  await db.run('DELETE FROM conveyance_rates');
  await db.run('DELETE FROM users');

  await db.run(
    `INSERT INTO conveyance_rates (id, vehicle_type, rate_per_km, effective_from, active) VALUES ($1, 'Bike', 4.50, NOW(), 1)`,
    [uuidv4()]
  );

  await db.run(
    `INSERT INTO users (id, employee_id, name, phone, password_hash, role, status) VALUES ($1, 'soumya.ghosh@genus.in', 'Soumya Ghosh', '9876543210', $2, 'admin', 'active')`,
    [uuidv4(), passwordAdmin]
  );

  await db.run(
    `INSERT INTO users (id, employee_id, name, phone, password_hash, role, status) VALUES ($1, 'EMP001', 'Shubham', '9216013070', $2, 'supervisor', 'active')`,
    [uuidv4(), passwordSupervisor]
  );

  await db.run('DELETE FROM duty_sessions');
  await db.run('DELETE FROM location_points');
  await db.run('DELETE FROM audit_logs');

  console.log('✅ Database seeded. Admin: soumya.ghosh@genus.in / Soumya@123');
}

if (process.argv[1]?.endsWith('seed.js')) {
  await initDatabase();
  await seed().catch(console.error);
  process.exit(0);
}
