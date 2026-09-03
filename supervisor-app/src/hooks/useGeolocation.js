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

export function useGeolocation(isTrackingActive = false, dutySessionId = null) {
  const { queueLocation } = useOfflineQueue();
  const [currentPosition, setCurrentPosition] = useState(null);
  const [error, setError] = useState(null);
  const lastRecordedRef = useRef(null);
  const watchIdRef = useRef(null);

  // Single snapshot position helper
  const getCurrentPositionAsync = useCallback(async () => {
    try {
      // Try Capacitor Native Geolocation first
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading
      };
    } catch (err) {
      console.warn('Native GPS snapshot error, falling back:', err.message);
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve({ latitude: 19.0760, longitude: 72.8777, accuracy: 15 });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) => {
            resolve({
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracy: p.coords.accuracy,
              speed: p.coords.speed,
              heading: p.coords.heading
            });
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

            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed,
              heading: position.coords.heading,
              recordedAt: new Date(position.timestamp).toISOString()
            };

            setCurrentPosition(coords);
            setError(null);

            // Movement throttling (>= 5 meters OR >= 20 seconds)
            const last = lastRecordedRef.current;
            const now = Date.now();
            let shouldRecord = false;

            if (!last) {
              shouldRecord = true;
            } else {
              const dist = haversineMeters(last.latitude, last.longitude, coords.latitude, coords.longitude);
              const elapsed = (now - last.timestamp) / 1000;
              if (dist >= 5 || elapsed >= 20) {
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

  return { currentPosition, error, getCurrentPositionAsync };
}
