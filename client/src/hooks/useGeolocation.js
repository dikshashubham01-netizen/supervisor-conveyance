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

export function useGeolocation(isTrackingActive = false, dutySessionId = null) {
  const { queueLocation } = useOfflineQueue();
  const [currentPosition, setCurrentPosition] = useState(null);
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
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading
          });
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
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        recordedAt: new Date(pos.timestamp).toISOString()
      };

      setCurrentPosition(coords);
      setError(null);

      // Intelligent movement filter:
      // Record point if:
      // 1. First point
      // 2. Or moved at least 6 meters
      // 3. Or at least 25 seconds elapsed
      const last = lastRecordedRef.current;
      const now = Date.now();
      let shouldRecord = false;

      if (!last) {
        shouldRecord = true;
      } else {
        const dist = haversineMeters(last.latitude, last.longitude, coords.latitude, coords.longitude);
        const timeElapsedSec = (now - last.timestamp) / 1000;

        if (dist >= 6 || timeElapsedSec >= 25) {
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
    error,
    permissionState,
    getCurrentPositionAsync
  };
}
