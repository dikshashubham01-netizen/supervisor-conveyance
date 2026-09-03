import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { dutySessionId, action, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        al.*,
        u.name AS user_name,
        u.employee_id,
        u.role AS user_role,
        ds.start_time AS session_start_time
      FROM audit_logs al
      JOIN users u ON u.id = al.user_id
      LEFT JOIN duty_sessions ds ON ds.id = al.duty_session_id
      WHERE 1=1
    `;
    const params = [];

    if (dutySessionId) {
      query += ' AND al.duty_session_id = ?';
      params.push(dutySessionId);
    }
    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const logs = db.prepare(query).all(...params);
    res.json({ logs });
  } catch (err) {
    console.error('Audit logs query error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
