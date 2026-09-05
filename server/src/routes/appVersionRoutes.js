import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const DEFAULT_VERSION = {
  id: 'latest',
  version: '1.0.3',
  version_code: 4,
  min_supported_version: '1.0.0',
  apk_url: 'https://supervisor-conveyance.vercel.app/Supervisor-App.apk',
  download_page_url: 'https://supervisor-conveyance.vercel.app/download',
  changelog: 'Continuous Native Background GPS Service, live IST time display fix, and in-dashboard auto-update prompt.',
  release_date: new Date().toISOString()
};

export async function ensureAppVersion() {
  try {
    const existing = await db.queryOne(`SELECT * FROM app_version WHERE id = 'latest'`);
    if (!existing) {
      await db.run(
        `INSERT INTO app_version (id, version, version_code, min_supported_version, apk_url, download_page_url, changelog)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          DEFAULT_VERSION.id,
          DEFAULT_VERSION.version,
          DEFAULT_VERSION.version_code,
          DEFAULT_VERSION.min_supported_version,
          DEFAULT_VERSION.apk_url,
          DEFAULT_VERSION.download_page_url,
          DEFAULT_VERSION.changelog
        ]
      );
    }
  } catch (err) {
    console.error('Error ensuring app version:', err);
  }
}

// GET /api/app/version (Public)
router.get('/version', async (req, res) => {
  try {
    await ensureAppVersion();
    const row = await db.queryOne(`SELECT * FROM app_version WHERE id = 'latest'`) || DEFAULT_VERSION;
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

router.get('/', (req, res) => { res.redirect('/api/app/version'); });

// POST /api/app/version (Admin Only)
router.post('/version', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { version, versionCode, minSupportedVersion, apkUrl, downloadPageUrl, changelog } = req.body;
    if (!version) return res.status(400).json({ error: 'Version string is required (e.g. 1.0.2)' });

    await ensureAppVersion();
    const existing = await db.queryOne(`SELECT * FROM app_version WHERE id = 'latest'`);
    const newVersionCode = versionCode ? parseInt(versionCode, 10) : (existing ? existing.version_code + 1 : 1);
    const newApkUrl = apkUrl || existing?.apk_url || DEFAULT_VERSION.apk_url;
    const newDownloadUrl = downloadPageUrl || existing?.download_page_url || DEFAULT_VERSION.download_page_url;
    const newChangelog = changelog || existing?.changelog || 'General improvements and bug fixes.';
    const newMinVersion = minSupportedVersion || existing?.min_supported_version || '1.0.0';

    await db.run(
      `UPDATE app_version SET version = $1, version_code = $2, min_supported_version = $3, apk_url = $4, download_page_url = $5, changelog = $6, updated_at = NOW() WHERE id = 'latest'`,
      [version.trim(), newVersionCode, newMinVersion, newApkUrl, newDownloadUrl, newChangelog]
    );

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
