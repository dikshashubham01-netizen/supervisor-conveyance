import { db } from '../db/database.js';
import { config } from '../config/index.js';

/**
 * Gets the current active conveyance rate for a vehicle type (default 'Bike')
 */
export async function getActiveRate(vehicleType = 'Bike') {
  const row = await db.queryOne(
    `SELECT rate_per_km FROM conveyance_rates WHERE vehicle_type = $1 AND active = 1 ORDER BY effective_from DESC LIMIT 1`,
    [vehicleType]
  );
  return row ? Number(row.rate_per_km) : config.defaultBikeRate;
}

/**
 * Evaluates session distance calculations and automatically selects the lower valid distance.
 * Returns synchronously — rate must be passed in (already fetched async before calling this).
 */
export function evaluateConveyance({
  startKm,
  endKm,
  gpsDistanceKm,
  startOdoOcr,
  startOdoManual,
  endOdoOcr,
  endOdoManual,
  trackingGapMinutes = 0,
  rate
}) {
  const warnings = [];
  let odometerDistance = null;
  let isOdometerValid = false;

  const startVal = Number(startKm);
  const endVal = Number(endKm);
  const gpsVal = Number(gpsDistanceKm || 0);

  // 1. Odometer validation
  if (!isNaN(startVal) && !isNaN(endVal)) {
    odometerDistance = Number((endVal - startVal).toFixed(2));
    if (odometerDistance < 0) {
      warnings.push(`Invalid Odometer: End KM (${endVal}) is less than Start KM (${startVal})`);
      isOdometerValid = false;
    } else {
      isOdometerValid = true;
    }
  } else {
    warnings.push('Odometer readings missing or invalid numeric values');
  }

  // 2. OCR vs Manual mismatch checks
  if (startOdoOcr != null && startOdoManual != null && Math.abs(Number(startOdoOcr) - Number(startOdoManual)) > 0.01) {
    warnings.push(`Start Odometer OCR (${startOdoOcr}) differed from manual entry (${startOdoManual})`);
  }
  if (endOdoOcr != null && endOdoManual != null && Math.abs(Number(endOdoOcr) - Number(endOdoManual)) > 0.01) {
    warnings.push(`End Odometer OCR (${endOdoOcr}) differed from manual entry (${endOdoManual})`);
  }

  // 3. Select Lower Valid Distance
  let approvedDistanceKm = 0.0;
  let selectionReason = '';
  let requiresAdminReview = false;

  if (isOdometerValid && gpsVal > 0) {
    if (odometerDistance <= gpsVal) {
      approvedDistanceKm = odometerDistance;
      selectionReason = `Lower Valid Distance Selected (Odometer: ${odometerDistance.toFixed(2)} KM vs GPS: ${gpsVal.toFixed(2)} KM)`;
    } else {
      approvedDistanceKm = gpsVal;
      selectionReason = `Lower Valid Distance Selected (GPS: ${gpsVal.toFixed(2)} KM vs Odometer: ${odometerDistance.toFixed(2)} KM)`;
    }

    const maxVal = Math.max(odometerDistance, gpsVal);
    const minVal = Math.min(odometerDistance, gpsVal);
    if (maxVal > 5 && ((maxVal - minVal) / maxVal) * 100 > config.gps.warningDiscrepancyPercent) {
      warnings.push(`Significant discrepancy (${Math.round(((maxVal - minVal) / maxVal) * 100)}%) between Odometer (${odometerDistance.toFixed(2)} KM) and GPS (${gpsVal.toFixed(2)} KM)`);
      requiresAdminReview = true;
    }
  } else if (isOdometerValid) {
    approvedDistanceKm = odometerDistance;
    selectionReason = `Odometer Distance Selected (No valid GPS points recorded)`;
    warnings.push('No valid GPS route points recorded during duty session');
    requiresAdminReview = true;
  } else if (gpsVal > 0) {
    approvedDistanceKm = gpsVal;
    selectionReason = `GPS Distance Selected (Odometer reading was invalid)`;
    requiresAdminReview = true;
  } else {
    approvedDistanceKm = 0.0;
    selectionReason = `No valid distance measured`;
    requiresAdminReview = true;
  }

  // 4. Tracking gap warning
  if (trackingGapMinutes > 30) {
    warnings.push(`Long tracking gap detected: ${Math.round(trackingGapMinutes)} minutes without GPS update`);
    requiresAdminReview = true;
  }

  // 5. Compute conveyance using provided rate
  const conveyanceAmount = Number((approvedDistanceKm * rate).toFixed(2));
  const status = (requiresAdminReview || !isOdometerValid) ? 'NEEDS_REVIEW' : 'PENDING_VERIFICATION';

  return {
    odometerDistanceKm: odometerDistance != null ? Math.max(0, odometerDistance) : 0.0,
    gpsDistanceKm: gpsVal,
    approvedDistanceKm,
    selectionReason,
    conveyanceRate: rate,
    conveyanceAmount,
    status,
    warnings
  };
}
