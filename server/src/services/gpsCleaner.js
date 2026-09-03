import { calculateDistanceKm } from '../utils/haversine.js';
import { config } from '../config/index.js';

/**
 * Validates a single GPS point against coordinate boundaries
 */
export function isValidCoordinate(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false; // Null Island often emitted on GPS lock failure
  return true;
}

/**
 * Cleans an ordered array of GPS location points.
 * Marks points as is_filtered = 1 (filtered) or 0 (valid)
 * Calculates total cumulative distance (km) across valid points.
 */
export function cleanGpsPoints(points) {
  if (!points || points.length === 0) {
    return { cleanedPoints: [], totalDistanceKm: 0.0, filteredCount: 0 };
  }

  // Sort chronologically
  const sorted = [...points].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

  const cleanedPoints = [];
  let totalDistanceKm = 0.0;
  let filteredCount = 0;
  let lastValidPoint = null;

  for (let i = 0; i < sorted.length; i++) {
    const pt = { ...sorted[i] };
    const lat = Number(pt.latitude);
    const lng = Number(pt.longitude);
    const accuracy = pt.accuracy != null ? Number(pt.accuracy) : 10;
    const time = new Date(pt.recorded_at).getTime();

    // Check 1: Valid coordinate ranges
    if (!isValidCoordinate(lat, lng)) {
      pt.is_filtered = 1;
      pt.filter_reason = 'INVALID_COORDINATES';
      cleanedPoints.push(pt);
      filteredCount++;
      continue;
    }

    // Check 2: Poor GPS accuracy (> config.gps.maxAccuracyMeters)
    if (accuracy > config.gps.maxAccuracyMeters) {
      pt.is_filtered = 1;
      pt.filter_reason = `HIGH_ACCURACY_ERROR_${Math.round(accuracy)}M`;
      cleanedPoints.push(pt);
      filteredCount++;
      continue;
    }

    if (lastValidPoint) {
      const lastLat = Number(lastValidPoint.latitude);
      const lastLng = Number(lastValidPoint.longitude);
      const lastTime = new Date(lastValidPoint.recorded_at).getTime();
      const distKm = calculateDistanceKm(lastLat, lastLng, lat, lng);
      const distMeters = distKm * 1000;
      const timeDiffSeconds = Math.max(0.1, (time - lastTime) / 1000);
      const speedKmh = (distKm / (timeDiffSeconds / 3600));

      // Check 3: Micro stationary jitter (< config.gps.minDistanceMeters)
      if (distMeters < config.gps.minDistanceMeters && timeDiffSeconds < 60) {
        pt.is_filtered = 1;
        pt.filter_reason = 'STATIONARY_JITTER';
        cleanedPoints.push(pt);
        filteredCount++;
        continue;
      }

      // Check 4: Impossible speed jump / Teleportation
      if (speedKmh > config.gps.maxSpeedKmh) {
        pt.is_filtered = 1;
        pt.filter_reason = `IMPOSSIBLE_SPEED_${Math.round(speedKmh)}KMH`;
        cleanedPoints.push(pt);
        filteredCount++;
        continue;
      }

      // Point is valid! Add segment distance
      totalDistanceKm += distKm;
    }

    pt.is_filtered = 0;
    cleanedPoints.push(pt);
    lastValidPoint = pt;
  }

  return {
    cleanedPoints,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    filteredCount
  };
}
