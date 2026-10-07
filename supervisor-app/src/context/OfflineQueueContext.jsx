import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import {
  savePendingLocation,
  getPendingLocations,
  clearSyncedLocations,
  getPendingCount
} from '../utils/offlineStorage';

const OfflineQueueContext = createContext(null);

export function OfflineQueueProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;

    try {
      const pending = await getPendingLocations();
      if (!pending || pending.length === 0) {
        setPendingCount(0);
        return;
      }

      setIsSyncing(true);
      const batch = pending.slice(0, 50);
      await api.tracking.sync(batch);

      // Successfully contacted server -> we are online!
      setIsOnline(true);

      const syncedUuids = batch.map((p) => p.clientUuid);
      await clearSyncedLocations(syncedUuids);

      const remaining = await getPendingCount();
      setPendingCount(remaining);

      if (remaining > 0) {
        setTimeout(triggerSync, 300);
      }
    } catch (err) {
      console.warn('Sync attempt failed (offline or network error):', err.message);
      if (!navigator.onLine || err.message?.includes('fetch') || err.message?.includes('network')) {
        setIsOnline(false);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const queueLocation = useCallback(
    async (point) => {
      await savePendingLocation(point);
      await refreshPendingCount();
      triggerSync();
    },
    [refreshPendingCount, triggerSync]
  );

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPendingCount();
        triggerSync();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic sync attempt every 10 seconds
    const interval = setInterval(() => {
      triggerSync();
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [refreshPendingCount, triggerSync]);

  return (
    <OfflineQueueContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        queueLocation,
        triggerSync
      }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error('useOfflineQueue must be inside OfflineQueueProvider');
  return ctx;
}
