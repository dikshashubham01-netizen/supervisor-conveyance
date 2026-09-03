import { useState, useEffect, useRef } from 'react';

export function useWakeLock(enabled = false) {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        setIsLocked(false);
      }
      return;
    }

    let isMounted = true;

    async function requestWakeLock() {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        if (isMounted) setIsLocked(true);

        wakeLockRef.current.addEventListener('release', () => {
          if (isMounted) setIsLocked(false);
        });
      } catch (err) {
        console.warn('Wake Lock request failed:', err.name, err.message);
      }
    }

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && !isLocked) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);

  return { isLocked, isSupported: 'wakeLock' in navigator };
}
