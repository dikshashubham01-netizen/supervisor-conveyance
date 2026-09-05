import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { initDatabase } from './db/database.js';
import { ensureAdminAndCleanState } from './db/seed.js';

import authRoutes from './routes/authRoutes.js';
import supervisorRoutes from './routes/supervisorRoutes.js';
import dutyRoutes from './routes/dutyRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import ocrRoutes from './routes/ocrRoutes.js';
import appVersionRoutes from './routes/appVersionRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Initialize PostgreSQL (Supabase) tables ──────────────────────────────────
try {
  await initDatabase();
  console.log('✅ PostgreSQL (Supabase) connected and tables ready.');
} catch (err) {
  console.error('❌ Failed to initialize database:', err.message);
  process.exit(1);
}

// ─── Ensure admin and seed defaults ──────────────────────────────────────────
try {
  await ensureAdminAndCleanState();
} catch (adminErr) {
  console.error('Error configuring admin/clean state:', adminErr);
}

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static uploaded photos
app.use('/uploads', express.static(config.uploadDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/duty', dutyRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/app', appVersionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Supervisor Location & Bike Conveyance System',
    database: 'Supabase PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const server = app.listen(config.port, () => {
  console.log(`🚀 Conveyance Monitoring API running on port ${config.port}`);
  console.log(`📡 Upload directory: ${config.uploadDir}`);
  console.log(`🗄️  Database: Supabase PostgreSQL`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️ Port ${config.port} is already in use.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

process.on('SIGTERM', () => {
  server.close(() => console.log('Server process terminated gracefully'));
});
