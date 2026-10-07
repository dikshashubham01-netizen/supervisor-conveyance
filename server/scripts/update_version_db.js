import { db } from '../src/db/database.js';

async function update() {
  console.log('Updating app_version table in PostgreSQL...');
  await db.run(
    `UPDATE app_version
     SET version = $1, version_code = $2, min_supported_version = $3, changelog = $4, updated_at = NOW()
     WHERE id = 'latest'`,
    ['1.0.8', 9, '1.0.7', 'Fixed Update modal crash, added offline GPS location capture & auto-sync when online.']
  );

  const ver = await db.queryOne(`SELECT * FROM app_version WHERE id = 'latest'`);
  console.log('Latest app_version row in database:');
  console.log(ver);
  process.exit(0);
}

update().catch(err => {
  console.error('Failed to update app_version:', err);
  process.exit(1);
});
