import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { config } from '../config/index.js';

const router = express.Router();

// Get current active conveyance rate
router.get('/rate', authenticateToken, (req, res) => {
  try {
    const row = db.prepare(`
      SELECT * FROM conveyance_rates 
      WHERE vehicle_type = 'Bike' AND active = 1 
      ORDER BY effective_from DESC LIMIT 1
    `).get();

    res.json({
      rate: row ? Number(row.rate_per_km) : config.defaultBikeRate,
      effectiveFrom: row ? row.effective_from : null,
      vehicleType: 'Bike'
    });
  } catch (err) {
    console.error('Get rate error:', err);
    res.status(500).json({ error: 'Failed to fetch conveyance rate' });
  }
});

// Update conveyance rate (Admin only)
router.post('/rate', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { ratePerKm, effectiveFrom } = req.body;
    const newRate = parseFloat(ratePerKm);

    if (isNaN(newRate) || newRate <= 0) {
      return res.status(400).json({ error: 'Valid positive rate per KM is required' });
    }

    const previousRate = db.prepare(`
      SELECT rate_per_km FROM conveyance_rates 
      WHERE vehicle_type = 'Bike' AND active = 1 
      ORDER BY effective_from DESC LIMIT 1
    `).get();

    const id = uuidv4();
    const effectiveDate = effectiveFrom || new Date().toISOString();

    // Deactivate previous active rates
    db.prepare(`UPDATE conveyance_rates SET active = 0 WHERE vehicle_type = 'Bike'`).run();

    // Insert new rate record (leaving past completed records completely untouched)
    db.prepare(`
      INSERT INTO conveyance_rates (id, vehicle_type, rate_per_km, effective_from, active)
      VALUES (?, 'Bike', ?, ?, 1)
    `).run(id, newRate, effectiveDate);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, old_value, new_value, reason)
      VALUES (?, ?, 'UPDATE_CONVEYANCE_RATE', ?, ?, 'Admin updated bike rate per KM')
    `).run(
      uuidv4(),
      req.user.id,
      previousRate ? `₹${previousRate.rate_per_km}` : 'None',
      `₹${newRate}`,
      `Rate changed from ₹${previousRate?.rate_per_km ?? 0} to ₹${newRate}`
    );

    res.json({
      message: `Conveyance rate updated to ₹${newRate.toFixed(2)}/KM`,
      rate: newRate,
      effectiveFrom: effectiveDate
    });
  } catch (err) {
    console.error('Update rate error:', err);
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

export default router;
