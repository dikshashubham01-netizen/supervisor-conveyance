import { useState, useEffect, useRef, useCallback } from 'react';
import { useOfflineQueue } from '../context/OfflineQueueContext';

// Helper: Haversine distance in meters
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getAccuracyRating(accuracy) {
  if (accuracy == null || isNaN(accuracy)) return { rating: 'UNKNOWN', label: 'NO GPS', color: 'slate' };
  if (accuracy <= 25) return { rating: 'GOOD', label: `GOOD ±${Math.round(accuracy)}m`, color: 'emerald' };
  if (accuracy <= 50) return { rating: 'FAIR', label: `FAIR ±${Math.round(accuracy)}m`, color: 'amber' };
  return { rating: 'POOR', label: `POOR ±${Math.round(accuracy)}m`, color: 'rose' };
}

export function useGeolocation(isTrackingActive = false, dutySessionId = null) {
  const { queueLocation } = useOfflineQueue();
  const [currentPosition, setCurrentPosition] = useState(null);
  const [accuracyRating, setAccuracyRating] = useState({ rating: 'UNKNOWN', label: 'NO GPS', color: 'slate' });
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState('prompt'); // granted, denied, prompt
  const lastRecordedRef = useRef(null);
  const watchIdRef = useRef(null);

  // One-off position helper
  const getCurrentPositionAsync = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: 19.0760, longitude: 72.8777, accuracy: 15 }); // Fallback
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const res = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            altitude: pos.coords.altitude || null
          };
          setAccuracyRating(getAccuracyRating(pos.coords.accuracy));
          resolve(res);
        },
        (err) => {
          console.warn('One-off geolocation error, using last or fallback:', err.message);
          resolve(currentPosition || { latitude: 19.0760, longitude: 72.8777, accuracy: 15 });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    });
  }, [currentPosition]);

  // Check permission state if available
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionState(result.state);
        result.onchange = () => setPermissionState(result.state);
      }).catch(() => {});
    }
  }, []);

  // Continuous tracking
  useEffect(() => {
    if (!isTrackingActive || !dutySessionId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    const handleSuccess = (pos) => {
      const accuracy = pos.coords.accuracy || 10;
      const rating = getAccuracyRating(accuracy);
      setAccuracyRating(rating);

      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: accuracy,
        speed: pos.coords.speed || 0,
        heading: pos.coords.heading || 0,
        altitude: pos.coords.altitude || null,
        provider: 'gps',
        is_mock: false,
        recordedAt: new Date(pos.timestamp).toISOString()
      };

      setCurrentPosition(coords);
      setError(null);

      // Filter 1: Stale locations (> 30s old)
      const now = Date.now();
      const ageMs = Math.abs(now - pos.timestamp);
      if (ageMs > 30000) {
        return;
      }

      // Filter 2: Inaccurate locations (> 50m)
      if (accuracy > 50) {
        return;
      }

      // Filter 3: Jump rejection (> 100 km/h)
      const last = lastRecordedRef.current;
      let shouldRecord = false;

      if (!last) {
        shouldRecord = true;
      } else {
        const dist = haversineMeters(last.latitude, last.longitude, coords.latitude, coords.longitude);
        const timeElapsedSec = (now - last.timestamp) / 1000;
        const speedKmh = (dist / 1000) / (Math.max(1, timeElapsedSec) / 3600);

        if (dist > 100 && speedKmh > 100) {
          return;
        }

        if (dist >= 5 || timeElapsedSec >= 15) {
          shouldRecord = true;
        }
      }

      if (shouldRecord) {
        lastRecordedRef.current = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp: now
        };

        // Queue to IndexedDB and sync
        queueLocation({
          clientUuid: crypto.randomUUID ? crypto.randomUUID() : `pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          dutySessionId,
          ...coords
        });
      }
    };

    const handleError = (err) => {
      console.warn('Geolocation watch error:', err.code, err.message);
      setError(err.message);
    };

    const options = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    };

    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, options);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isTrackingActive, dutySessionId, queueLocation]);

  return {
    currentPosition,
    accuracyRating,
    error,
    permissionState,
    getCurrentPositionAsync
  };
}
