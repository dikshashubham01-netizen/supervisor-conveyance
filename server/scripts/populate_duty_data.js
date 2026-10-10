import { db, initDatabase } from '../src/db/database.js';
import { v4 as uuidv4 } from 'uuid';

// Sub-division base coordinates (Assam region)
const SUBDIVISION_COORDS = {
  'Moran': { lat: 27.1850, lng: 94.9280 },
  'Charaideo': { lat: 26.9600, lng: 94.9400 },
  'Sivsagar-I&II': { lat: 26.9850, lng: 94.6380 },
  'Demow': { lat: 27.1400, lng: 94.7500 },
  'Amguri': { lat: 26.8120, lng: 94.5240 },
  'Nazira': { lat: 26.9150, lng: 94.7350 },
  'default': { lat: 26.9850, lng: 94.6380 }
};

async function populate() {
  await initDatabase();
  console.log('🔄 Populating comprehensive duty sessions for all supervisors...');

  const supervisors = await db.queryAll(`SELECT id, employee_id, name, subdivision FROM users WHERE role = 'supervisor'`);
  if (!supervisors || supervisors.length === 0) {
    console.error('No supervisors found.');
    process.exit(1);
  }

  // Sample photo references from server/uploads
  const selfies = ['selfie_start_emp001.svg', 'selfie_end_emp001.svg', 'selfie_start_emp002.svg', 'selfie_end_emp002.svg'];
  const odometers = ['odo_start_emp001.svg', 'odo_end_emp001.svg', 'odo_start_emp002.svg', 'odo_end_emp002.svg'];

  // Days in October 2026 to generate sessions for
  const days = [
    { day: '01', status: 'APPROVED' },
    { day: '02', status: 'APPROVED' },
    { day: '03', status: 'APPROVED' },
    { day: '05', status: 'APPROVED' },
    { day: '06', status: 'APPROVED' },
    { day: '07', status: 'APPROVED' },
    { day: '08', status: 'APPROVED' },
    { day: '09', status: 'APPROVED' },
    { day: '10', status: 'TODAY' } // Varies per supervisor
  ];

  let totalSessionsCreated = 0;
  let totalPointsCreated = 0;

  for (const sup of supervisors) {
    const coords = SUBDIVISION_COORDS[sup.subdivision] || SUBDIVISION_COORDS['default'];
    let baseOdo = 12000 + (parseInt(sup.employee_id.replace(/\D/g, '') || '100', 10) % 5000);

    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const dateStr = `2026-10-${d.day}`;
      const sessionId = uuidv4();

      let sessionStatus = 'APPROVED';
      let isTodayActive = false;

      if (d.status === 'TODAY') {
        // Diversify today's sessions so Admin can test all features:
        if (sup.employee_id === '700534') { // Saik Ali -> ON_DUTY
          sessionStatus = 'ON_DUTY';
          isTodayActive = true;
        } else if (sup.employee_id === '702791') { // Moloyraj Boruah -> REJECTED
          sessionStatus = 'REJECTED';
        } else if (sup.employee_id === '706827') { // Bhargav -> PENDING_VERIFICATION
          sessionStatus = 'PENDING_VERIFICATION';
        } else if (sup.employee_id === '700495') { // Himanshu -> NEEDS_REVIEW
          sessionStatus = 'NEEDS_REVIEW';
        } else {
          sessionStatus = 'APPROVED';
        }
      }

      // Daily stats
      const distanceKm = 18 + ((i * 3 + parseInt(sup.employee_id.slice(-2) || '5', 10)) % 22);
      const startKm = baseOdo;
      const endKm = isTodayActive ? null : Number((baseOdo + distanceKm).toFixed(1));
      if (!isTodayActive) baseOdo = endKm + 2;

      const metersCount = isTodayActive ? 0 : (8 + ((i * 2 + parseInt(sup.employee_id.slice(-1) || '1', 10)) % 15));
      const rate = 4.50;
      const conveyance = isTodayActive ? 0 : Number((distanceKm * rate).toFixed(2));

      const startTime = `${dateStr} 09:${String(15 + (i % 30)).padStart(2, '0')}:00+05:30`;
      const endTime = isTodayActive ? null : `${dateStr} 17:${String(30 + (i % 25)).padStart(2, '0')}:00+05:30`;

      const startLat = coords.lat + (Math.random() - 0.5) * 0.01;
      const startLng = coords.lng + (Math.random() - 0.5) * 0.01;
      const endLat = isTodayActive ? null : coords.lat + (Math.random() - 0.5) * 0.04;
      const endLng = isTodayActive ? null : coords.lng + (Math.random() - 0.5) * 0.04;

      const warnings = sessionStatus === 'NEEDS_REVIEW'
        ? JSON.stringify([{ type: 'HIGH_SPEED', message: 'Instant speed 85 km/h detected', severity: 'WARNING' }])
        : '[]';

      const reason = sessionStatus === 'REJECTED'
        ? 'Rejected by Admin: blurry odometer image and GPS route outside assigned subdivision.'
        : 'Odometer distance matched GPS track points closely.';

      // Insert duty session
      await db.run(
        `INSERT INTO duty_sessions (
          id, supervisor_id, start_time, end_time,
          start_latitude, start_longitude, end_latitude, end_longitude,
          start_selfie, end_selfie, start_odometer_image, end_odometer_image,
          start_odometer_manual, start_odometer_final,
          end_odometer_manual, end_odometer_final,
          gps_distance_km, odometer_distance_km, approved_distance_km,
          distance_selection_reason, conveyance_rate, conveyance_amount,
          status, warnings, review_notes, meters_installed,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3::timestamptz, $4::timestamptz,
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14,
          $15, $16,
          $17, $18, $19,
          $20, $21, $22,
          $23, $24, $25, $26,
          $3::timestamptz, NOW()
        )`,
        [
          sessionId, sup.id, startTime, endTime,
          startLat, startLng, endLat, endLng,
          selfies[i % selfies.length], isTodayActive ? null : selfies[(i + 1) % selfies.length],
          odometers[i % odometers.length], isTodayActive ? null : odometers[(i + 1) % odometers.length],
          startKm, startKm,
          endKm, endKm,
          isTodayActive ? 4.2 : distanceKm, isTodayActive ? 0 : distanceKm, isTodayActive ? 0 : distanceKm,
          reason, rate, conveyance,
          sessionStatus, warnings, sessionStatus === 'REJECTED' ? 'Rejected due to route deviation' : null, metersCount
        ]
      );
      totalSessionsCreated++;

      // Generate 12-25 GPS breadcrumb points along the route
      const ptCount = isTodayActive ? 8 : 16;
      for (let p = 0; p < ptCount; p++) {
        const frac = p / (ptCount - 1);
        const pLat = startLat + (endLat ? (endLat - startLat) : 0.02) * frac + (Math.sin(p) * 0.003);
        const pLng = startLng + (endLng ? (endLng - startLng) : 0.02) * frac + (Math.cos(p) * 0.003);
        const ptTime = new Date(new Date(startTime).getTime() + (p * 25 * 60 * 1000)).toISOString();

        await db.run(
          `INSERT INTO location_points (
            id, client_uuid, duty_session_id, supervisor_id,
            latitude, longitude, accuracy, speed, heading, is_filtered, filter_reason, recorded_at, synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NULL, $10::timestamptz, NOW())`,
          [
            uuidv4(), uuidv4(), sessionId, sup.id,
            pLat, pLng, 8.5 + (p % 4), 22 + (p % 15), (p * 20) % 360, ptTime
          ]
        );
        totalPointsCreated++;
      }

      // Sync attendance
      const attStatus = sessionStatus === 'REJECTED' ? 'A' : (isTodayActive ? 'P' : 'P');
      await db.run(
        `INSERT INTO attendance (id, supervisor_id, attendance_date, status, duty_session_id, source, notes, created_at, updated_at)
         VALUES ($1, $2, $3::date, $4, $5, 'AUTO', $6, NOW(), NOW())
         ON CONFLICT (supervisor_id, attendance_date)
         DO UPDATE SET
           status = EXCLUDED.status,
           duty_session_id = EXCLUDED.duty_session_id,
           notes = EXCLUDED.notes,
           updated_at = NOW()`,
        [
          uuidv4(), sup.id, dateStr, attStatus, sessionId,
          sessionStatus === 'REJECTED' ? 'Session rejected by admin' : `Completed duty with ${metersCount} meters`
        ]
      );
    }
  }

  console.log(`✅ Successfully generated ${totalSessionsCreated} duty sessions and ${totalPointsCreated} GPS track points!`);
  process.exit(0);
}

populate().catch(err => {
  console.error('Error populating duty data:', err);
  process.exit(1);
});
