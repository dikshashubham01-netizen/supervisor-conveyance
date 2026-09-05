import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

// ─── PostgreSQL Connection Pool ───────────────────────────────────────────────
// Uses Supabase connection string from DATABASE_URL environment variable.
// Supabase requires SSL — reject unauthorized is disabled for compatibility.
// ─────────────────────────────────────────────────────────────────────────────
if (!config.databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('   Set it to your Supabase connection string in Render environment variables.');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

// ─── Helper: db object that mimics simple query interface ─────────────────────
// db.query(sql, params) → { rows: [...] }
// db.queryOne(sql, params) → first row or null
// db.queryAll(sql, params) → array of rows
export const db = {
  async query(sql, params = []) {
    const client = await pool.connect();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  },

  async queryOne(sql, params = []) {
    const result = await db.query(sql, params);
    return result.rows[0] || null;
  },

  async queryAll(sql, params = []) {
    const result = await db.query(sql, params);
    return result.rows;
  },

  async run(sql, params = []) {
    return db.query(sql, params);
  },

  // Transaction helper: runs multiple queries atomically
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
};

// ─── initDatabase: Creates all tables if they don't exist ────────────────────
export async function initDatabase() {
  console.log('🔌 Connecting to Supabase PostgreSQL...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'supervisor')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS conveyance_rates (
      id TEXT PRIMARY KEY,
      vehicle_type TEXT NOT NULL,
      rate_per_km FLOAT NOT NULL,
      effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS duty_sessions (
      id TEXT PRIMARY KEY,
      supervisor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_time TIMESTAMPTZ,
      start_latitude FLOAT,
      start_longitude FLOAT,
      end_latitude FLOAT,
      end_longitude FLOAT,
      start_selfie TEXT,
      end_selfie TEXT,
      start_odometer_image TEXT,
      end_odometer_image TEXT,
      start_odometer_ocr FLOAT,
      start_odometer_manual FLOAT,
      start_odometer_final FLOAT,
      end_odometer_ocr FLOAT,
      end_odometer_manual FLOAT,
      end_odometer_final FLOAT,
      gps_distance_km FLOAT DEFAULT 0.0,
      odometer_distance_km FLOAT DEFAULT 0.0,
      approved_distance_km FLOAT DEFAULT 0.0,
      distance_selection_reason TEXT,
      conveyance_rate FLOAT,
      conveyance_amount FLOAT DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'ON_DUTY' CHECK(status IN ('ON_DUTY', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW')),
      review_notes TEXT,
      warnings TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS location_points (
      id TEXT PRIMARY KEY,
      client_uuid TEXT UNIQUE,
      duty_session_id TEXT NOT NULL REFERENCES duty_sessions(id) ON DELETE CASCADE,
      supervisor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      latitude FLOAT NOT NULL,
      longitude FLOAT NOT NULL,
      accuracy FLOAT,
      speed FLOAT,
      heading FLOAT,
      is_filtered INTEGER NOT NULL DEFAULT 0,
      recorded_at TIMESTAMPTZ NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      duty_session_id TEXT REFERENCES duty_sessions(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_version (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      version_code INTEGER NOT NULL,
      min_supported_version TEXT NOT NULL DEFAULT '1.0.0',
      apk_url TEXT NOT NULL,
      download_page_url TEXT NOT NULL,
      changelog TEXT,
      release_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes (CREATE INDEX IF NOT EXISTS is idempotent)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_duty_sessions_supervisor ON duty_sessions(supervisor_id, status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_duty_sessions_dates ON duty_sessions(start_time, end_time)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_location_points_session ON location_points(duty_session_id, recorded_at)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs(duty_session_id)`);

  console.log('✅ Database tables initialized (Supabase PostgreSQL)');
}
