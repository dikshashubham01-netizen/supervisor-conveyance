import { db } from '../src/db/database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const supervisors = [
  { empId: '700489', name: 'Anup Kumar Pandey', phone: '8271504574', pass: 'Passw0rd', sub: 'Moran' },
  { empId: '706827', name: 'Bhargav Jyoti Guwala', phone: '6002562503', pass: 'Passw0rd', sub: 'Charaideo' },
  { empId: '700495', name: 'Himanshu Chetia', phone: '9864972303', pass: 'Passw0rd', sub: 'Sivsagar-I&II' },
  { empId: '700506', name: 'Madhab Borgohain', phone: '9864499561', pass: 'Passw0rd', sub: 'Demow' },
  { empId: '702791', name: 'Moloyraj Boruah', phone: '9101879312', pass: 'Passw0rd', sub: 'Amguri' },
  { empId: '700534', name: 'Saik Ali', phone: '6003623758', pass: 'Passw0rd', sub: 'Nazira' }
];

async function run() {
  console.log('Syncing supervisor sub-divisions...');
  for (const s of supervisors) {
    const existing = await db.queryOne('SELECT id, employee_id, name, subdivision FROM users WHERE employee_id = $1', [s.empId]);
    if (existing) {
      await db.run('UPDATE users SET subdivision = $1, name = $2, phone = $3 WHERE employee_id = $4', [s.sub, s.name, s.phone, s.empId]);
      console.log(`Updated ${s.empId} (${s.name}) -> Subdivision: ${s.sub}`);
    } else {
      const id = uuidv4();
      const passwordHash = await bcrypt.hash(s.pass, 10);
      await db.run(
        `INSERT INTO users (id, employee_id, name, phone, password_hash, role, status, subdivision)
         VALUES ($1, $2, $3, $4, $5, 'supervisor', 'active', $6)`,
        [id, s.empId, s.name, s.phone, passwordHash, s.sub]
      );
      console.log(`Created ${s.empId} (${s.name}) -> Subdivision: ${s.sub}`);
    }
  }

  const all = await db.queryAll('SELECT employee_id, name, phone, subdivision, status FROM users WHERE role = $1 ORDER BY employee_id', ['supervisor']);
  console.log('\nAll registered supervisors:');
  console.table(all);
  process.exit(0);
}

run().catch(err => {
  console.error('Error syncing subdivisions:', err);
  process.exit(1);
});
