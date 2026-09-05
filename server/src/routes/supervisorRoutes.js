import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// List all supervisors with their active duty status and stats
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const supervisors = await db.queryAll(`
      SELECT
        u.id, u.employee_id, u.name, u.phone, u.status, u.created_at,
        ds.id AS active_duty_id,
        ds.start_time AS active_duty_start,
        ds.gps_distance_km AS active_duty_distance,
        (SELECT COUNT(*) FROM duty_sessions WHERE supervisor_id = u.id AND status = 'APPROVED') AS total_approved_duties,
        (SELECT COALESCE(SUM(approved_distance_km), 0) FROM duty_sessions WHERE supervisor_id = u.id AND status = 'APPROVED') AS total_approved_km,
        (SELECT COALESCE(SUM(conveyance_amount), 0) FROM duty_sessions WHERE supervisor_id = u.id AND status = 'APPROVED') AS total_conveyance
      FROM users u
      LEFT JOIN duty_sessions ds ON ds.supervisor_id = u.id AND ds.status = 'ON_DUTY'
      WHERE u.role = 'supervisor'
      ORDER BY u.employee_id ASC
    `);
    res.json({ supervisors });
  } catch (err) {
    console.error('Fetch supervisors error:', err);
    res.status(500).json({ error: 'Failed to fetch supervisors' });
  }
});

// Create a new supervisor
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { employee_id, name, phone, password } = req.body;
    if (!employee_id || !name || !password) {
      return res.status(400).json({ error: 'Employee ID, Name, and Password are required' });
    }

    const cleanEmpId = employee_id.trim().toUpperCase();
    const existing = await db.queryOne('SELECT id FROM users WHERE employee_id = $1', [cleanEmpId]);
    if (existing) {
      return res.status(400).json({ error: `Supervisor with Employee ID "${cleanEmpId}" already exists` });
    }

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);

    await db.run(
      `INSERT INTO users (id, employee_id, name, phone, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, 'supervisor', 'active')`,
      [id, cleanEmpId, name.trim(), phone ? phone.trim() : null, password_hash]
    );

    await db.run(
      `INSERT INTO audit_logs (id, user_id, action, new_value, reason) VALUES ($1, $2, 'CREATE_SUPERVISOR', $3, 'Admin created supervisor')`,
      [uuidv4(), req.user.id, `Created ${cleanEmpId} - ${name}`]
    );

    res.status(201).json({
      message: 'Supervisor created successfully',
      supervisor: { id, employee_id: cleanEmpId, name, phone, status: 'active' }
    });
  } catch (err) {
    console.error('Create supervisor error:', err);
    res.status(500).json({ error: 'Failed to create supervisor' });
  }
});

// Update supervisor
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, status, password } = req.body;

    const existing = await db.queryOne('SELECT * FROM users WHERE id = $1 AND role = $2', [id, 'supervisor']);
    if (!existing) return res.status(404).json({ error: 'Supervisor not found' });

    let passwordHash = existing.password_hash;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    await db.run(
      `UPDATE users SET name = $1, phone = $2, status = $3, password_hash = $4, updated_at = NOW() WHERE id = $5`,
      [
        name ? name.trim() : existing.name,
        phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
        status || existing.status,
        passwordHash,
        id
      ]
    );

    await db.run(
      `INSERT INTO audit_logs (id, user_id, action, old_value, new_value, reason) VALUES ($1, $2, 'UPDATE_SUPERVISOR', $3, $4, 'Admin updated supervisor details')`,
      [
        uuidv4(), req.user.id,
        JSON.stringify({ name: existing.name, status: existing.status }),
        JSON.stringify({ name: name || existing.name, status: status || existing.status })
      ]
    );

    res.json({ message: 'Supervisor updated successfully' });
  } catch (err) {
    console.error('Update supervisor error:', err);
    res.status(500).json({ error: 'Failed to update supervisor' });
  }
});

// Delete supervisor
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.queryOne('SELECT employee_id, name FROM users WHERE id = $1 AND role = $2', [id, 'supervisor']);
    if (!existing) return res.status(404).json({ error: 'Supervisor not found' });

    await db.run('DELETE FROM users WHERE id = $1', [id]);

    await db.run(
      `INSERT INTO audit_logs (id, user_id, action, old_value, reason) VALUES ($1, $2, 'DELETE_SUPERVISOR', $3, 'Admin deleted supervisor')`,
      [uuidv4(), req.user.id, `${existing.employee_id} - ${existing.name}`]
    );

    res.json({ message: 'Supervisor deleted successfully' });
  } catch (err) {
    console.error('Delete supervisor error:', err);
    res.status(500).json({ error: 'Failed to delete supervisor' });
  }
});

export default router;
