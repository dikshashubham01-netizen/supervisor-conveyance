import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { generateCsv, generateExcelBuffer, formatReportRows } from '../services/exportService.js';

const router = express.Router();

function getFilteredSessions(queryFilters) {
  const { startDate, endDate, supervisorId, employeeId, status } = queryFilters;

  let query = `
    SELECT 
      ds.*,
      u.name AS supervisor_name,
      u.employee_id
    FROM duty_sessions ds
    JOIN users u ON u.id = ds.supervisor_id
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    query += ' AND date(ds.start_time) >= date(?)';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date(ds.start_time) <= date(?)';
    params.push(endDate);
  }
  if (supervisorId) {
    query += ' AND ds.supervisor_id = ?';
    params.push(supervisorId);
  }
  if (employeeId) {
    query += ' AND u.employee_id LIKE ?';
    params.push(`%${employeeId.trim()}%`);
  }
  if (status && status !== 'ALL') {
    query += ' AND ds.status = ?';
    params.push(status);
  }

  query += ' ORDER BY ds.start_time DESC';
  return db.prepare(query).all(...params);
}

// 1. Report Data JSON
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const sessions = getFilteredSessions(req.query);
    const reportData = formatReportRows(sessions);

    // Calculate aggregated totals
    const totals = sessions.reduce((acc, curr) => {
      acc.totalApprovedKm += (curr.approved_distance_km || 0);
      acc.totalGpsKm += (curr.gps_distance_km || 0);
      acc.totalOdometerKm += (curr.odometer_distance_km || 0);
      acc.totalConveyance += (curr.conveyance_amount || 0);
      return acc;
    }, { totalApprovedKm: 0, totalGpsKm: 0, totalOdometerKm: 0, totalConveyance: 0 });

    totals.totalApprovedKm = Number(totals.totalApprovedKm.toFixed(2));
    totals.totalGpsKm = Number(totals.totalGpsKm.toFixed(2));
    totals.totalOdometerKm = Number(totals.totalOdometerKm.toFixed(2));
    totals.totalConveyance = Number(totals.totalConveyance.toFixed(2));

    res.json({
      sessions,
      reportRows: reportData,
      totals,
      count: sessions.length
    });
  } catch (err) {
    console.error('Report query error:', err);
    res.status(500).json({ error: 'Failed to generate reports' });
  }
});

// 2. Export CSV
router.get('/export/csv', authenticateToken, requireAdmin, (req, res) => {
  try {
    const sessions = getFilteredSessions(req.query);
    const csvContent = generateCsv(sessions);

    const filename = `Conveyance_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// 3. Export Excel
router.get('/export/excel', authenticateToken, requireAdmin, (req, res) => {
  try {
    const sessions = getFilteredSessions(req.query);
    const excelBuffer = generateExcelBuffer(sessions);

    const filename = `Conveyance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

export default router;
