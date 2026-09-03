import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const DEFAULT_VERSION = {
  id: 'latest',
  version: '1.0.3',
  versionCode: 4,
  min_supported_version: '1.0.0',
  apkUrl: 'https://supervisor-conveyance.vercel.app/Supervisor-App.apk',
  download_page_url: 'https://supervisor-conveyance.vercel.app/download',
  changelog: 'Continuous Native Background GPS Service, live IST time display fix, and in-dashboard auto-update prompt.',
  release_date: new Date().toISOString()
};

// Ensure default version in database
export function ensureAppVersion() {
  try {
    const existing = db.prepare("SELECT * FROM app_version WHERE id = 'latest'").get();
    if (!existing) {
      db.prepare(`
        INSERT INTO app_version (id, version, version_code, min_supported_version, apk_url, download_page_url, changelog)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        DEFAULT_VERSION.id,
        DEFAULT_VERSION.version,
        DEFAULT_VERSION.version_code,
        DEFAULT_VERSION.min_supported_version,
        DEFAULT_VERSION.apk_url,
        DEFAULT_VERSION.download_page_url,
        DEFAULT_VERSION.changelog
      );
    }
  } catch (err) {
    console.error('Error ensuring app version:', err);
  }
}

// GET /api/app/version (Public - used by Mobile App to check for updates)
router.get('/version', (req, res) => {
  try {
    ensureAppVersion();
    const row = db.prepare("SELECT * FROM app_version WHERE id = 'latest'").get() || DEFAULT_VERSION;

    res.json({
      version: row.version,
      versionCode: Number(row.version_code),
      minSupportedVersion: row.min_supported_version,
      apkUrl: row.apk_url,
      downloadUrl: row.download_page_url,
      changelog: row.changelog,
      releaseDate: row.release_date
    });
  } catch (err) {
    console.error('Fetch app version error:', err);
    res.json({
      version: DEFAULT_VERSION.version,
      versionCode: DEFAULT_VERSION.version_code,
      minSupportedVersion: DEFAULT_VERSION.min_supported_version,
      apkUrl: DEFAULT_VERSION.apk_url,
      downloadUrl: DEFAULT_VERSION.download_page_url,
      changelog: DEFAULT_VERSION.changelog
    });
  }
});

// Also alias GET / to /version
router.get('/', (req, res) => {
  res.redirect('/api/app/version');
});

// POST /api/app/version (Admin Only - publish new version)
router.post('/version', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { version, versionCode, minSupportedVersion, apkUrl, downloadPageUrl, changelog } = req.body;

    if (!version) {
      return res.status(400).json({ error: 'Version string is required (e.g. 1.0.2)' });
    }

    ensureAppVersion();

    const existing = db.prepare("SELECT * FROM app_version WHERE id = 'latest'").get();
    const newVersionCode = versionCode ? parseInt(versionCode, 10) : (existing ? existing.version_code + 1 : 1);
    const newApkUrl = apkUrl || existing?.apk_url || DEFAULT_VERSION.apk_url;
    const newDownloadUrl = downloadPageUrl || existing?.download_page_url || DEFAULT_VERSION.download_page_url;
    const newChangelog = changelog || existing?.changelog || 'General improvements and bug fixes.';
    const newMinVersion = minSupportedVersion || existing?.min_supported_version || '1.0.0';

    db.prepare(`
      UPDATE app_version
      SET version = ?, version_code = ?, min_supported_version = ?, apk_url = ?, download_page_url = ?, changelog = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'latest'
    `).run(version.trim(), newVersionCode, newMinVersion, newApkUrl, newDownloadUrl, newChangelog);

    res.json({
      message: `App version updated to v${version.trim()}`,
      version: version.trim(),
      versionCode: newVersionCode,
      apkUrl: newApkUrl,
      downloadUrl: newDownloadUrl,
      changelog: newChangelog
    });
  } catch (err) {
    console.error('Update app version error:', err);
    res.status(500).json({ error: 'Failed to update app version' });
  }
});

export default router;
