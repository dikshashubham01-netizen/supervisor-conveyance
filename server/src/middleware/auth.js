import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { db } from '../db/database.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token' });
    }

    // Verify user exists and is active
    const dbUser = db.prepare('SELECT id, employee_id, name, role, status FROM users WHERE id = ?').get(user.id);
    if (!dbUser || dbUser.status !== 'active') {
      return res.status(403).json({ error: 'User account not found or inactive' });
    }

    req.user = dbUser;
    next();
  });
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

export function requireSupervisor(req, res, next) {
  if (!req.user || req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Supervisor privileges required' });
  }
  next();
}
