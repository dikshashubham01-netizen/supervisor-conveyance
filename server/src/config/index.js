import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..');

// ─── Persistent Storage ───────────────────────────────────────────────────────
// On Render.com free tier, the filesystem is EPHEMERAL (wiped on every restart).
// Render's Disk mount is at /var/data — anything stored there SURVIVES restarts.
// We use /var/data when available (production on Render), else fall back to local.
const PERSISTENT_DIR = '/var/data';
const isPersistentAvailable = (() => {
  try {
    fs.accessSync(PERSISTENT_DIR, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
})();

const dataDir = isPersistentAvailable ? PERSISTENT_DIR : serverRoot;
const uploadsDir = isPersistentAvailable ? path.join(PERSISTENT_DIR, 'uploads') : path.join(serverRoot, 'uploads');

// Ensure the uploads folder exists
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}

console.log(`💾 Storage mode: ${isPersistentAvailable ? 'RENDER PERSISTENT DISK (/var/data)' : 'LOCAL (dev mode)'}`);

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'supervisor_conveyance_secret_key_2026_super_secure',
  jwtExpiresIn: '7d',
  defaultBikeRate: 4.50,
  uploadDir: uploadsDir,
  dbPath: path.join(dataDir, 'conveyance.db'),
  gps: {
    maxSpeedKmh: 120,
    maxAccuracyMeters: 100,
    minDistanceMeters: 3,
    staleLocationMinutes: 15,
    warningDiscrepancyPercent: 20
  }
};
