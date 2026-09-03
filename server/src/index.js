import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { initDatabase, db } from './db/database.js';
import { seed, ensureAdminAndCleanState } from './db/seed.js';

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

// Initialize SQLite database
initDatabase();

// Configure custom admin and ensure clean 0 KM state
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

// Serve static uploaded photos securely
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
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const server = app.listen(config.port, () => {
  console.log(`🚀 Conveyance Monitoring API Server running on port ${config.port}`);
  console.log(`📡 Upload directory: ${config.uploadDir}`);
  console.log(`💾 Database file: ${config.dbPath}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️ Port ${config.port} is already in use by another running instance of this server.`);
    console.error(`To free port ${config.port} on Windows, run this in PowerShell:`);
    console.error(`  Get-NetTCPConnection -LocalPort ${config.port} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

process.on('SIGTERM', () => {
  server.close(() => console.log('Server process terminated gracefully'));
});
