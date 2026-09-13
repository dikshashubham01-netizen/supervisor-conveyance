import { calculateDistanceKm } from '../utils/haversine.js';
import { config } from '../config/index.js';

/**
 * Validates a single GPS point against coordinate boundaries
 */
export function isValidCoordinate(lat, lng) {
  if (lat === null || lng === null || lat === undefined || lng === undefined) return false;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false; // Null Island
  return true;
}

/**
 * Cleans and segments an array of GPS location points.
 */
export function cleanGpsPoints(points, maxGapMeters = config.gps?.maxGapMeters || 1000, maxGapMinutes = config.gps?.maxGapMinutes || 5) {
  if (!points || points.length === 0) {
    return {
      cleanedPoints: [],
      validPoints: [],
      segments: [],
      gaps: [],
      totalDistanceKm: 0.0,
      filteredCount: 0,
      jumpCount: 0,
      lowAccuracyCount: 0,
      mockCount: 0
    };
  }

  // Sort chronologically
  const sorted = [...points].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

  const cleanedPoints = [];
  const validPoints = [];
  const segments = [];
  const gaps = [];

  let currentSegment = [];
  let totalDistanceKm = 0.0;
  let filteredCount = 0;
  let jumpCount = 0;
  let lowAccuracyCount = 0;
  let mockCount = 0;

  let lastValidPoint = null;
  const now = Date.now();
  const maxClockSkewMs = 2 * 60 * 1000; // 2 minutes future clock tolerance

  for (let i = 0; i < sorted.length; i++) {
    const pt = { ...sorted[i] };
    const lat = pt.latitude != null ? Number(pt.latitude) : null;
    const lng = pt.longitude != null ? Number(pt.longitude) : null;
    const accuracy = pt.accuracy != null ? Number(pt.accuracy) : 10;
    const time = new Date(pt.recorded_at).getTime();
    const isMock = pt.is_mock === 1 || pt.is_mock === true || pt.isMock === true;

    // Check 1: Mock location detection
    if (isMock) {
      pt.is_filtered = 1;
      pt.filter_reason = 'MOCK_LOCATION';
      cleanedPoints.push(pt);
      filteredCount++;
      mockCount++;
      continue;
    }

    // Check 2: Valid coordinate ranges
    if (!isValidCoordinate(lat, lng)) {
      pt.is_filtered = 1;
      pt.filter_reason = 'INVALID_COORDINATES';
      cleanedPoints.push(pt);
      filteredCount++;
      continue;
    }

    // Check 3: Timestamp sanity
    if (isNaN(time) || time > now + maxClockSkewMs) {
      pt.is_filtered = 1;
      pt.filter_reason = 'INVALID_TIMESTAMP';
      cleanedPoints.push(pt);
      filteredCount++;
      continue;
    }

    // Check 4: Poor GPS accuracy (> 50m)
    if (accuracy > (config.gps?.maxAccuracyMeters || 50)) {
      pt.is_filtered = 1;
      pt.filter_reason = 'LOW_ACCURACY';
      cleanedPoints.push(pt);
      filteredCount++;
      lowAccuracyCount++;
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

      // Check 5: Micro stationary jitter
      if (distMeters < (config.gps?.minDistanceMeters || 3) && timeDiffSeconds < 60) {
        pt.is_filtered = 1;
        pt.filter_reason = 'STATIONARY_JITTER';
        cleanedPoints.push(pt);
        filteredCount++;
        continue;
      }

      // Check 6: Speed jump / Teleportation rejection (> 100 km/h)
      if (speedKmh > (config.gps?.maxSpeedKmh || 100)) {
        pt.is_filtered = 1;
        pt.filter_reason = 'GPS_JUMP_REJECTED';
        cleanedPoints.push(pt);
        filteredCount++;
        jumpCount++;
        continue;
      }

      // Check 7: GPS Signal Gap (breaks polyline, excludes straight line)
      const isGap = timeDiffSeconds > (maxGapMinutes * 60) || distMeters > maxGapMeters;
      if (isGap) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        gaps.push({
          from: lastValidPoint,
          to: pt,
          gapMinutes: Math.round(timeDiffSeconds / 60),
          distanceKm: Number(distKm.toFixed(2))
        });
      } else {
        totalDistanceKm += distKm;
      }
    }

    pt.is_filtered = 0;
    pt.filter_reason = null;
    cleanedPoints.push(pt);
    validPoints.push(pt);
    currentSegment.push([lat, lng]);
    lastValidPoint = pt;
  }

  // Push last remaining segment
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return {
    cleanedPoints,
    validPoints,
    segments,
    gaps,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    filteredCount,
    jumpCount,
    lowAccuracyCount,
    mockCount
  };
}

/**
 * Clean and validate a single point on ingestion against previous point
 */
export function cleanPointOnIngestion(pt, lastValidPoint = null) {
  if (!pt || pt.latitude === null || pt.latitude === undefined || pt.longitude === null || pt.longitude === undefined) {
    return { ...pt, is_filtered: 1, filter_reason: 'INVALID_COORDINATES', accuracy_rating: 'POOR' };
  }
  const lat = Number(pt.latitude);
  const lng = Number(pt.longitude);
  const accuracy = pt.accuracy != null ? Number(pt.accuracy) : 10;
  const time = new Date(pt.recorded_at).getTime();
  const isMock = pt.is_mock === 1 || pt.is_mock === true || pt.isMock === true;
  const now = Date.now();

  let accuracyRating = 'GOOD';
  if (accuracy > 50) accuracyRating = 'POOR';
  else if (accuracy > 25) accuracyRating = 'FAIR';

  if (isMock) {
    return { ...pt, is_filtered: 1, filter_reason: 'MOCK_LOCATION', accuracy_rating: accuracyRating };
  }

  if (!isValidCoordinate(lat, lng)) {
    return { ...pt, is_filtered: 1, filter_reason: 'INVALID_COORDINATES', accuracy_rating: accuracyRating };
  }

  if (isNaN(time) || (now - time > 30000 && pt.filter_stale !== false)) {
    // If location is > 30s old compared to ingestion time
    if (now - time > 30000) {
      return { ...pt, is_filtered: 1, filter_reason: 'STALE_LOCATION', accuracy_rating: accuracyRating };
    }
  }

  if (accuracy > (config.gps?.maxAccuracyMeters || 50)) {
    return { ...pt, is_filtered: 1, filter_reason: 'LOW_ACCURACY', accuracy_rating: accuracyRating };
  }

  if (lastValidPoint) {
    const lastLat = Number(lastValidPoint.latitude);
    const lastLng = Number(lastValidPoint.longitude);
    const lastTime = new Date(lastValidPoint.recorded_at).getTime();
    const distKm = calculateDistanceKm(lastLat, lastLng, lat, lng);
    const timeDiffSec = Math.max(1, (time - lastTime) / 1000);
    const speedKmh = (distKm / (timeDiffSec / 3600));

    if (distKm > 0.1 && speedKmh > (config.gps?.maxSpeedKmh || 100)) {
      return { ...pt, is_filtered: 1, filter_reason: 'GPS_JUMP_REJECTED', accuracy_rating: accuracyRating };
    }
  }

  return { ...pt, is_filtered: 0, filter_reason: null, accuracy_rating: accuracyRating };
}

/**
 * Segment session points into continuous polylines and signal gaps
 */
export function cleanAndSegmentSessionPoints(points, maxGapMeters = 1000, maxGapMinutes = 5) {
  const result = cleanGpsPoints(points);
  // Transform gaps to format with fromPoint/toPoint, distanceMeters, timeGapMinutes for convenience
  const formattedGaps = result.gaps.map((g) => ({
    fromPoint: g.from,
    toPoint: g.to,
    distanceMeters: Math.round(g.distanceKm * 1000),
    timeGapMinutes: g.gapMinutes
  }));

  // Re-build segments containing full point objects for rich client rendering
  const pointSegments = [];
  let curSeg = [];
  const valid = result.validPoints;

  for (let i = 0; i < valid.length; i++) {
    if (curSeg.length === 0) {
      curSeg.push(valid[i]);
    } else {
      const prev = curSeg[curSeg.length - 1];
      const distM = calculateDistanceKm(prev.latitude, prev.longitude, valid[i].latitude, valid[i].longitude) * 1000;
      const timeDiffM = Math.abs(new Date(valid[i].recorded_at) - new Date(prev.recorded_at)) / 60000;
      if (distM > maxGapMeters || timeDiffM > maxGapMinutes) {
        pointSegments.push(curSeg);
        curSeg = [valid[i]];
      } else {
        curSeg.push(valid[i]);
      }
    }
  }
  if (curSeg.length > 0) pointSegments.push(curSeg);

  return {
    ...result,
    segments: pointSegments,
    gaps: formattedGaps
  };
}

/**
 * Calculate conveyance distance strictly from continuous valid points, excluding signal gaps
 */
export function calculateConveyanceDistance(points, maxGapMeters = 1000, maxGapMinutes = 5) {
  const segmented = cleanAndSegmentSessionPoints(points, maxGapMeters, maxGapMinutes);
  let totalKm = 0;
  for (const seg of segmented.segments) {
    for (let i = 1; i < seg.length; i++) {
      totalKm += calculateDistanceKm(seg[i - 1].latitude, seg[i - 1].longitude, seg[i].latitude, seg[i].longitude);
    }
  }
  return Number(totalKm.toFixed(2));
}
