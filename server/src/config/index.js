import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..');

// Uploads directory — still needed for photo files
const uploadsDir = path.join(serverRoot, 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'supervisor_conveyance_secret_key_2026_super_secure',
  jwtExpiresIn: '7d',
  defaultBikeRate: 4.50,
  uploadDir: uploadsDir,
  // PostgreSQL / Supabase connection string
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:Shubham%40003@db.bjvmdztpllbjizlefjdb.supabase.co:5432/postgres',
  gps: {
    maxSpeedKmh: 120,
    maxAccuracyMeters: 100,
    minDistanceMeters: 3,
    staleLocationMinutes: 15,
    warningDiscrepancyPercent: 20
  }
};
