import Database from 'better-sqlite3';
import { config } from '../config/index.js';
import fs from 'fs';

// Ensure uploads directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

export const db = new Database(config.dbPath);

// Enable WAL mode for high performance & concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'supervisor')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conveyance_rates (
      id TEXT PRIMARY KEY,
      vehicle_type TEXT NOT NULL,
      rate_per_km REAL NOT NULL,
      effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS duty_sessions (
      id TEXT PRIMARY KEY,
      supervisor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      start_latitude REAL,
      start_longitude REAL,
      end_latitude REAL,
      end_longitude REAL,
      start_selfie TEXT,
      end_selfie TEXT,
      start_odometer_image TEXT,
      end_odometer_image TEXT,
      start_odometer_ocr REAL,
      start_odometer_manual REAL,
      start_odometer_final REAL,
      end_odometer_ocr REAL,
      end_odometer_manual REAL,
      end_odometer_final REAL,
      gps_distance_km REAL DEFAULT 0.0,
      odometer_distance_km REAL DEFAULT 0.0,
      approved_distance_km REAL DEFAULT 0.0,
      distance_selection_reason TEXT,
      conveyance_rate REAL,
      conveyance_amount REAL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'ON_DUTY' CHECK(status IN ('ON_DUTY', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW')),
      review_notes TEXT,
      warnings TEXT DEFAULT '[]', -- JSON array of warning strings
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS location_points (
      id TEXT PRIMARY KEY,
      client_uuid TEXT UNIQUE,
      duty_session_id TEXT NOT NULL REFERENCES duty_sessions(id) ON DELETE CASCADE,
      supervisor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      is_filtered INTEGER NOT NULL DEFAULT 0, -- 0 = valid, 1 = filtered out (noise/teleportation)
      recorded_at DATETIME NOT NULL,
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      duty_session_id TEXT REFERENCES duty_sessions(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_version (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      version_code INTEGER NOT NULL,
      min_supported_version TEXT NOT NULL DEFAULT '1.0.0',
      apk_url TEXT NOT NULL,
      download_page_url TEXT NOT NULL,
      changelog TEXT,
      release_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_duty_sessions_supervisor ON duty_sessions(supervisor_id, status);
    CREATE INDEX IF NOT EXISTS idx_duty_sessions_dates ON duty_sessions(start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_location_points_session ON location_points(duty_session_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs(duty_session_id);
  `);
}

// Initialize on load
initDatabase();
