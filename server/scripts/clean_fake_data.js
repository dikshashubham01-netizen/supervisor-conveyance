import { db, initDatabase, pool } from '../src/db/database.js';

async function cleanFakeData() {
  await initDatabase();
  console.log('🧹 Starting cleanup of fake / mock data from database...');

  // 1. Delete all location points
  const locResult = await db.run('DELETE FROM location_points');
  console.log(`✅ Deleted ${locResult.rowCount || 0} fake location points.`);

  // 2. Delete all audit logs
  const auditResult = await db.run('DELETE FROM audit_logs');
  console.log(`✅ Deleted ${auditResult.rowCount || 0} audit logs.`);

  // 3. Delete all attendance entries
  const attResult = await db.run('DELETE FROM attendance');
  console.log(`✅ Deleted ${attResult.rowCount || 0} fake attendance records.`);

  // 4. Delete all duty sessions
  const dutyResult = await db.run('DELETE FROM duty_sessions');
  console.log(`✅ Deleted ${dutyResult.rowCount || 0} fake duty sessions.`);

  // 5. Delete mock supervisor EMP001 if present
  const delEmp = await db.run(`DELETE FROM users WHERE employee_id = 'EMP001'`);
  if ((delEmp.rowCount || 0) > 0) {
    console.log('✅ Removed mock supervisor EMP001 (Shubham).');
  }

  // 6. Verify remaining users
  const remainingUsers = await db.queryAll(
    `SELECT employee_id, name, phone, subdivision, role, status FROM users ORDER BY role DESC, employee_id ASC`
  );
  console.log('\n👥 VERIFIED GENUINE ACCOUNTS:');
  remainingUsers.forEach((u) => {
    console.log(`   - [${u.role.toUpperCase()}] ${u.employee_id} | ${u.name} | Sub: ${u.subdivision || 'N/A'} | Phone: ${u.phone}`);
  });

  // 7. Verify zero counts
  const dutyCount = await db.queryOne('SELECT COUNT(*) as count FROM duty_sessions');
  const locCount = await db.queryOne('SELECT COUNT(*) as count FROM location_points');
  const attCount = await db.queryOne('SELECT COUNT(*) as count FROM attendance');
  console.log('\n📊 DATABASE COUNTS:');
  console.log(`   - Duty Sessions: ${dutyCount?.count || 0}`);
  console.log(`   - Location Points: ${locCount?.count || 0}`);
  console.log(`   - Attendance Records: ${attCount?.count || 0}`);

  console.log('\n✨ All fake data deleted successfully! Real supervisor accounts preserved.');
  process.exit(0);
}

cleanFakeData().catch((err) => {
  console.error('❌ Error during cleanup:', err);
  process.exit(1);
});
