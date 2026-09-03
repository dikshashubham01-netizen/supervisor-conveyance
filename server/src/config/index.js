import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..');

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'supervisor_conveyance_secret_key_2026_super_secure',
  jwtExpiresIn: '7d',
  defaultBikeRate: 4.50,
  uploadDir: path.join(serverRoot, 'uploads'),
  dbPath: path.join(serverRoot, 'conveyance.db'),
  gps: {
    maxSpeedKmh: 120,          // Speeds above 120 km/h on bike conveyance are considered impossible/glitch
    maxAccuracyMeters: 100,    // Accuracy worse than 100m is discarded from distance calculation
    minDistanceMeters: 3,      // Discard micro-jitter under 3 meters
    staleLocationMinutes: 15,  // Warn if supervisor hasn't pinged in 15 mins
    warningDiscrepancyPercent: 20 // Warn if GPS KM and Odometer KM differ by > 20%
  }
};
