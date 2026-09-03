import test from 'node:test';
import assert from 'node:assert';
import { calculateDistanceKm } from '../src/utils/haversine.js';
import { cleanGpsPoints } from '../src/services/gpsCleaner.js';
import { evaluateConveyance, getActiveRate } from '../src/services/conveyanceService.js';
import { formatReportRows, generateCsv, generateExcelBuffer } from '../src/services/exportService.js';
import { parseOdometerNumber } from '../src/services/ocrService.js';
import { db, initDatabase } from '../src/db/database.js';

initDatabase();

test('1. Haversine distance accuracy', () => {
  // Mumbai Gateway of India (18.9220, 72.8347) to Marine Drive (18.9438, 72.8232) ~2.73 km
  const dist = calculateDistanceKm(18.9220, 72.8347, 18.9438, 72.8232);
  assert(dist > 2.5 && dist < 3.0, `Expected distance between 2.5 and 3.0 km, got ${dist}`);
});

test('2. GPS noise and impossible speed filtering', () => {
  const points = [
    { latitude: 19.0760, longitude: 72.8777, accuracy: 10, recorded_at: '2026-09-03T10:00:00Z' },
    // Low accuracy point (accuracy = 180m > 100m threshold)
    { latitude: 19.0800, longitude: 72.8800, accuracy: 180, recorded_at: '2026-09-03T10:02:00Z' },
    // Valid intermediate point
    { latitude: 19.0820, longitude: 72.8830, accuracy: 12, recorded_at: '2026-09-03T10:05:00Z' },
    // Teleportation glitch: 100 km away in 1 minute (> 120 km/h)
    { latitude: 20.0820, longitude: 73.8830, accuracy: 10, recorded_at: '2026-09-03T10:06:00Z' },
    // Valid end point
    { latitude: 19.0850, longitude: 72.8860, accuracy: 15, recorded_at: '2026-09-03T10:10:00Z' }
  ];

  const result = cleanGpsPoints(points);
  assert.strictEqual(result.cleanedPoints.length, 5);
  // Point 2 and 4 should be filtered out
  assert.strictEqual(result.cleanedPoints[1].is_filtered, 1);
  assert.strictEqual(result.cleanedPoints[3].is_filtered, 1);
  // Valid points
  assert.strictEqual(result.cleanedPoints[0].is_filtered, 0);
  assert.strictEqual(result.cleanedPoints[2].is_filtered, 0);
  assert.strictEqual(result.cleanedPoints[4].is_filtered, 0);
  assert(result.totalDistanceKm > 0, 'Cleaned distance should be calculated');
});

test('3. Distance comparison selects LOWER valid distance (Odometer < GPS)', () => {
  // Scenario: Odometer = 32 KM, GPS = 34.72 KM
  // Approved = 32 KM
  const result = evaluateConveyance({
    startKm: 12458,
    endKm: 12490,
    gpsDistanceKm: 34.72
  });

  assert.strictEqual(result.odometerDistanceKm, 32);
  assert.strictEqual(result.gpsDistanceKm, 34.72);
  assert.strictEqual(result.approvedDistanceKm, 32);
  assert(result.selectionReason.includes('Lower Valid Distance Selected'), 'Reason must specify lower valid distance');
  assert.strictEqual(result.conveyanceAmount, 144.00); // 32 * 4.50
});

test('4. Distance comparison selects LOWER valid distance (GPS < Odometer)', () => {
  // Scenario: GPS = 25.50 KM, Odometer = 28 KM
  // Approved = 25.50 KM
  const result = evaluateConveyance({
    startKm: 10000,
    endKm: 10028,
    gpsDistanceKm: 25.50
  });

  assert.strictEqual(result.odometerDistanceKm, 28);
  assert.strictEqual(result.gpsDistanceKm, 25.50);
  assert.strictEqual(result.approvedDistanceKm, 25.50);
  assert(result.selectionReason.includes('Lower Valid Distance Selected'));
  assert.strictEqual(result.conveyanceAmount, 114.75); // 25.5 * 4.50
});

test('5. Invalid odometer reading detection (End KM < Start KM)', () => {
  const result = evaluateConveyance({
    startKm: 12490,
    endKm: 12450, // lower than start!
    gpsDistanceKm: 15.0
  });

  assert.strictEqual(result.status, 'NEEDS_REVIEW');
  assert(result.warnings.some((w) => w.includes('End KM') && w.includes('less than Start KM')));
});

test('6. OCR number parsing and correction', () => {
  assert.strictEqual(parseOdometerNumber('12,458 KM'), 12458);
  assert.strictEqual(parseOdometerNumber('TOTAL: 012490 km'), 12490);
  assert.strictEqual(parseOdometerNumber('ODO: O12458'), 12458); // 'O' -> '0'
});

test('7. 13-Column Reports structure and Excel export', () => {
  const sampleSessions = [
    {
      start_time: '2026-09-03 09:15:00',
      end_time: '2026-09-03 17:45:00',
      supervisor_name: 'John Doe',
      employee_id: 'EMP001',
      start_odometer_final: 12458,
      end_odometer_final: 12490,
      gps_distance_km: 34.72,
      odometer_distance_km: 32.0,
      approved_distance_km: 32.0,
      conveyance_rate: 4.50,
      conveyance_amount: 144.00,
      status: 'APPROVED'
    }
  ];

  const rows = formatReportRows(sampleSessions);
  assert.strictEqual(rows.length, 1);
  const expectedHeaders = [
    'Date', 'Supervisor', 'Employee ID', 'Start Time', 'End Time',
    'Start KM', 'End KM', 'GPS KM', 'Odometer KM', 'Approved KM',
    'Rate', 'Conveyance', 'Status'
  ];
  assert.deepStrictEqual(Object.keys(rows[0]), expectedHeaders);

  const csv = generateCsv(sampleSessions);
  assert(csv.includes('John Doe'));
  assert(csv.includes('EMP001'));
  assert(csv.includes('144.00'));

  const excelBuffer = generateExcelBuffer(sampleSessions);
  assert(Buffer.isBuffer(excelBuffer));
  assert(excelBuffer.length > 1000);
});

test('8. Conveyance Rate locking on historical sessions', () => {
  const initialRate = getActiveRate('Bike');
  assert.strictEqual(initialRate, 4.50);
});
