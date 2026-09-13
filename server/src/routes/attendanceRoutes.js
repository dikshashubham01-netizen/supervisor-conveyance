import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  getMonthlyAttendanceMatrix,
  getMonthlyConveyanceMatrix,
  generateAttendanceExcel,
  generateMonthlyConveyanceExcel,
  autoEndLingeringDutySessions,
  getSupervisorMonthlyAttendanceAndConveyance
} from '../services/attendanceService.js';

const router = express.Router();

/**
 * 0. Supervisor's Own Monthly Attendance & Day-wise Bike Run
 * GET /api/attendance/my-attendance?year=2026&month=9
 */
router.get('/my-attendance', authenticateToken, async (req, res) => {
  try {
    const { year, month, supervisorId } = req.query;
    const targetSupervisorId = req.user.role === 'admin' && supervisorId ? supervisorId : req.user.id;
    const data = await getSupervisorMonthlyAttendanceAndConveyance({
      supervisorId: targetSupervisorId,
      year,
      month
    });
    res.json(data);
  } catch (err) {
    console.error('My attendance query error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance: ' + err.message });
  }
});

/**
 * 1. Monthly Attendance Grid Data
 * GET /api/attendance?year=2026&month=9&supervisorId=...&employeeId=...
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { year, month, supervisorId, employeeId } = req.query;
    const data = await getMonthlyAttendanceMatrix({ year, month, supervisorId, employeeId });
    res.json(data);
  } catch (err) {
    console.error('Attendance grid query error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance data: ' + err.message });
  }
});

/**
 * 2. Attendance Excel Export
 * GET /api/attendance/export/excel?year=2026&month=9
 */
router.get('/export/excel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { year, month, supervisorId, employeeId } = req.query;
    const matrixData = await getMonthlyAttendanceMatrix({ year, month, supervisorId, employeeId });
    const buffer = generateAttendanceExcel(matrixData);
    const filename = `Attendance_Report_${matrixData.monthName}_${matrixData.year}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Attendance Excel export error:', err);
    res.status(500).json({ error: 'Failed to export attendance Excel: ' + err.message });
  }
});

/**
 * 3. Monthly Day-wise Conveyance Grid Data
 * GET /api/attendance/conveyance?year=2026&month=9&supervisorId=...&employeeId=...
 */
router.get('/conveyance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { year, month, supervisorId, employeeId } = req.query;
    const data = await getMonthlyConveyanceMatrix({ year, month, supervisorId, employeeId });
    res.json(data);
  } catch (err) {
    console.error('Conveyance grid query error:', err);
    res.status(500).json({ error: 'Failed to fetch conveyance matrix data: ' + err.message });
  }
});

/**
 * 4. Monthly Conveyance Excel Export
 * GET /api/attendance/conveyance/export/excel?year=2026&month=9
 */
router.get('/conveyance/export/excel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { year, month, supervisorId, employeeId } = req.query;
    const matrixData = await getMonthlyConveyanceMatrix({ year, month, supervisorId, employeeId });
    const buffer = generateMonthlyConveyanceExcel(matrixData);
    const filename = `Conveyance_Monthly_${matrixData.monthName}_${matrixData.year}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Conveyance Excel export error:', err);
    res.status(500).json({ error: 'Failed to export conveyance Excel: ' + err.message });
  }
});

/**
 * 5. Trigger Midnight Auto-End Check (Admin utility / test)
 * POST /api/attendance/auto-end-check
 */
router.post('/auto-end-check', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await autoEndLingeringDutySessions();
    res.json({ message: 'Auto-end check completed', ...result });
  } catch (err) {
    console.error('Auto-end trigger error:', err);
    res.status(500).json({ error: 'Failed to run auto-end check: ' + err.message });
  }
});

export default router;
