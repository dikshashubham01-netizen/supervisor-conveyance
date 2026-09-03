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
    if (!navigator.onLine || isSyncing) return;

    try {
      const pending = await getPendingLocations();
      if (!pending || pending.length === 0) {
        setPendingCount(0);
        return;
      }

      setIsSyncing(true);
      const batch = pending.slice(0, 50);
      await api.tracking.sync(batch);

      const syncedUuids = batch.map((p) => p.clientUuid);
      await clearSyncedLocations(syncedUuids);

      const remaining = await getPendingCount();
      setPendingCount(remaining);

      if (remaining > 0) {
        setTimeout(triggerSync, 500);
      }
    } catch (err) {
      console.warn('Sync attempt failed:', err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const queueLocation = useCallback(
    async (point) => {
      await savePendingLocation(point);
      await refreshPendingCount();
      if (navigator.onLine) {
        triggerSync();
      }
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      if (navigator.onLine) triggerSync();
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
