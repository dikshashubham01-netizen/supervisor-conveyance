import { useState, useEffect, useRef, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { useOfflineQueue } from '../context/OfflineQueueContext';

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
  const lastRecordedRef = useRef(null);
  const watchIdRef = useRef(null);

  // Single snapshot position helper
  const getCurrentPositionAsync = useCallback(async () => {
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      });
      const res = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        altitude: pos.coords.altitude || null
      };
      setAccuracyRating(getAccuracyRating(pos.coords.accuracy));
      return res;
    } catch (err) {
      console.warn('Native GPS snapshot error, falling back:', err.message);
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve({ latitude: 19.0760, longitude: 72.8777, accuracy: 15 });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const res = {
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracy: p.coords.accuracy,
              speed: p.coords.speed,
              heading: p.coords.heading,
              altitude: p.coords.altitude || null
            };
            setAccuracyRating(getAccuracyRating(p.coords.accuracy));
            resolve(res);
          },
          () => resolve(currentPosition || { latitude: 19.0760, longitude: 72.8777, accuracy: 15 }),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }
  }, [currentPosition]);

  // Continuous tracking
  useEffect(() => {
    if (!isTrackingActive || !dutySessionId) {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
        watchIdRef.current = null;
      }
      return;
    }

    let isMounted = true;

    async function startWatching() {
      try {
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
          (position, err) => {
            if (err) {
              console.warn('Geolocation error:', err.message);
              if (isMounted) setError(err.message);
              return;
            }
            if (!position || !isMounted) return;

            const accuracy = position.coords.accuracy || 10;
            const rating = getAccuracyRating(accuracy);
            setAccuracyRating(rating);

            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: accuracy,
              speed: position.coords.speed || 0,
              heading: position.coords.heading || 0,
              altitude: position.coords.altitude || null,
              provider: 'gps',
              is_mock: false,
              recordedAt: new Date(position.timestamp).toISOString()
            };

            setCurrentPosition(coords);
            setError(null);

            // Filter 1: Stale locations (> 30s old)
            const now = Date.now();
            const ageMs = Math.abs(now - position.timestamp);
            if (ageMs > 30000) {
              console.warn('Discarding stale GPS point in frontend watcher:', ageMs / 1000, 's');
              return;
            }

            // Filter 2: Inaccurate locations (> 50m)
            if (accuracy > 50) {
              console.warn('Discarding inaccurate GPS point in frontend watcher:', accuracy, 'm');
              return;
            }

            // Filter 3: Jump / Teleportation rejection (> 100 km/h)
            const last = lastRecordedRef.current;
            let shouldRecord = false;

            if (!last) {
              shouldRecord = true;
            } else {
              const dist = haversineMeters(last.latitude, last.longitude, coords.latitude, coords.longitude);
              const elapsedSec = (now - last.timestamp) / 1000;
              const speedKmh = (dist / 1000) / (Math.max(1, elapsedSec) / 3600);

              if (dist > 100 && speedKmh > 100) {
                console.warn('GPS jump rejected in frontend watcher! Dist:', dist, 'm, Speed:', speedKmh, 'km/h');
                return;
              }

              // Movement throttling: record if moved >= 5 meters OR >= 15 seconds elapsed
              if (dist >= 5 || elapsedSec >= 15) {
                shouldRecord = true;
              }
            }

            if (shouldRecord) {
              lastRecordedRef.current = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                timestamp: now
              };

              queueLocation({
                clientUuid: crypto.randomUUID ? crypto.randomUUID() : `pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                dutySessionId,
                ...coords
              });
            }
          }
        );

        watchIdRef.current = id;
      } catch (err) {
        console.warn('Failed to start native GPS watcher:', err.message);
        if (isMounted) setError(err.message);
      }
    }

    startWatching();

    return () => {
      isMounted = false;
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
        watchIdRef.current = null;
      }
    };
  }, [isTrackingActive, dutySessionId, queueLocation]);

  return { currentPosition, accuracyRating, error, getCurrentPositionAsync };
}
