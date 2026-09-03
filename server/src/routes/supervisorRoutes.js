import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// List all supervisors with their active duty status and stats
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const supervisors = db.prepare(`
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
    `).all();

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
    const existing = db.prepare('SELECT id FROM users WHERE employee_id = ?').get(cleanEmpId);
    if (existing) {
      return res.status(400).json({ error: `Supervisor with Employee ID "${cleanEmpId}" already exists` });
    }

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);

    db.prepare(`
      INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, 'supervisor', 'active')
    `).run(id, cleanEmpId, name.trim(), phone ? phone.trim() : null, password_hash);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, new_value, reason)
      VALUES (?, ?, 'CREATE_SUPERVISOR', ?, 'Admin created supervisor')
    `).run(uuidv4(), req.user.id, `Created ${cleanEmpId} - ${name}`);

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

    const existing = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(id, 'supervisor');
    if (!existing) {
      return res.status(404).json({ error: 'Supervisor not found' });
    }

    let passwordHash = existing.password_hash;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    db.prepare(`
      UPDATE users 
      SET name = ?, phone = ?, status = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : existing.name,
      phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
      status || existing.status,
      passwordHash,
      id
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, old_value, new_value, reason)
      VALUES (?, ?, 'UPDATE_SUPERVISOR', ?, ?, 'Admin updated supervisor details')
    `).run(
      uuidv4(), req.user.id,
      JSON.stringify({ name: existing.name, status: existing.status }),
      JSON.stringify({ name: name || existing.name, status: status || existing.status })
    );

    res.json({ message: 'Supervisor updated successfully' });
  } catch (err) {
    console.error('Update supervisor error:', err);
    res.status(500).json({ error: 'Failed to update supervisor' });
  }
});

// Delete supervisor
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT employee_id, name FROM users WHERE id = ? AND role = ?').get(id, 'supervisor');
    if (!existing) {
      return res.status(404).json({ error: 'Supervisor not found' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, old_value, reason)
      VALUES (?, ?, 'DELETE_SUPERVISOR', ?, 'Admin deleted supervisor')
    `).run(uuidv4(), req.user.id, `${existing.employee_id} - ${existing.name}`);

    res.json({ message: 'Supervisor deleted successfully' });
  } catch (err) {
    console.error('Delete supervisor error:', err);
    res.status(500).json({ error: 'Failed to delete supervisor' });
  }
});

export default router;
