import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Download sample Excel template for bulk supervisor registration
router.get('/template', authenticateToken, requireAdmin, (req, res) => {
  try {
    const templateData = [
      {
        'Employee ID': 'EMP002',
        'Full Name': 'Ramesh Kumar',
        'Phone Number': '9876543211',
        'Password': 'User@123'
      },
      {
        'Employee ID': 'EMP003',
        'Full Name': 'Priya Sharma',
        'Phone Number': '9876543212',
        'Password': 'User@123'
      },
      {
        'Employee ID': 'EMP004',
        'Full Name': 'Amit Patel',
        'Phone Number': '9876543213',
        'Password': 'User@123'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 16 }, // Employee ID
      { wch: 22 }, // Full Name
      { wch: 16 }, // Phone Number
      { wch: 16 }  // Password
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Supervisors');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Supervisor_Import_Template.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Template generation error:', err);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// Bulk upload supervisors via Excel (.xlsx, .xls, .csv)
router.post('/bulk-upload', authenticateToken, requireAdmin, excelUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Excel file (.xlsx, .xls, .csv) is required' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'No sheet found in uploaded Excel file' });
    }

    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ error: 'Excel sheet is empty. Please add supervisor rows.' });
    }

    let createdCount = 0;
    let skippedCount = 0;
    const createdList = [];
    const skippedList = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;

      const empIdRaw = row['Employee ID'] || row['employee_id'] || row['Emp ID'] || row['EmployeeID'] || row['EMPID'] || row['Emp Id'] || row['ID'] || '';
      const nameRaw = row['Full Name'] || row['Name'] || row['name'] || row['full_name'] || row['Supervisor Name'] || row['Employee Name'] || '';
      const phoneRaw = row['Phone Number'] || row['Phone'] || row['phone'] || row['Mobile'] || row['Mobile Number'] || row['Contact'] || '';
      const passwordRaw = row['Password'] || row['password'] || row['Pass'] || 'Soumya@123';

      const empId = ('' + empIdRaw).trim().toUpperCase();
      const name = ('' + nameRaw).trim();
      const phone = ('' + phoneRaw).trim();
      const password = ('' + passwordRaw).trim() || 'Soumya@123';

      if (!empId) {
        skippedCount++;
        skippedList.push(`Row ${rowNum}: Missing Employee ID`);
        continue;
      }

      if (!name) {
        skippedCount++;
        skippedList.push(`Row ${rowNum} (${empId}): Missing Full Name`);
        continue;
      }

      // Check if employee already exists in Supabase
      const existing = await db.queryOne('SELECT id, name FROM users WHERE employee_id = $1', [empId]);
      if (existing) {
        skippedCount++;
        skippedList.push(`${empId} (${name}) already exists`);
        continue;
      }

      const id = uuidv4();
      const passwordHash = await bcrypt.hash(password, 10);

      await db.run(
        `INSERT INTO users (id, employee_id, name, phone, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5, 'supervisor', 'active')`,
        [id, empId, name, phone || null, passwordHash]
      );

      createdCount++;
      createdList.push(`${empId} — ${name}`);
    }

    if (createdCount > 0) {
      await db.run(
        `INSERT INTO audit_logs (id, user_id, action, new_value, reason) VALUES ($1, $2, 'BULK_IMPORT_SUPERVISORS', $3, 'Admin bulk imported supervisors via Excel')`,
        [uuidv4(), req.user.id, `Imported ${createdCount} supervisors: ${createdList.slice(0, 5).join(', ')}${createdList.length > 5 ? '...' : ''}`]
      );
    }

    res.json({
      message: `Bulk import complete: ${createdCount} created, ${skippedCount} skipped`,
      totalRows: rawRows.length,
      createdCount,
      skippedCount,
      created: createdList,
      skipped: skippedList
    });
  } catch (err) {
    console.error('Bulk upload error:', err);
    res.status(500).json({ error: 'Failed to process Excel file: ' + err.message });
  }
});

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
