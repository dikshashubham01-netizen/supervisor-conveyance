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
  const [lastSyncResult, setLastSyncResult] = useState(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // Sync pending items with server
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    try {
      const pending = await getPendingLocations();
      if (!pending || pending.length === 0) {
        setPendingCount(0);
        return;
      }

      setIsSyncing(true);
      // Batch up to 50 points per request to keep payloads fast
      const batch = pending.slice(0, 50);
      const res = await api.tracking.sync(batch);

      // Successfully synced: clear from local store by clientUuid
      const syncedUuids = batch.map((p) => p.clientUuid);
      await clearSyncedLocations(syncedUuids);

      const remaining = await getPendingCount();
      setPendingCount(remaining);
      setLastSyncResult({
        success: true,
        count: batch.length,
        timestamp: new Date(),
        gpsDistanceKm: res.currentGpsDistanceKm
      });

      // If more remain, chain another sync
      if (remaining > 0) {
        setTimeout(triggerSync, 500);
      }
    } catch (err) {
      console.warn('Sync attempt encountered error:', err.message);
      // If server instructed us that duty has ended, stop tracking/clear queue
      if (err.message?.includes('No active duty session')) {
        console.warn('Active duty session expired or ended on server');
      }
      setLastSyncResult({ success: false, error: err.message, timestamp: new Date() });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Queue a new GPS ping
  const queueLocation = useCallback(
    async (point) => {
      // Save locally first for fault-tolerance
      await savePendingLocation(point);
      await refreshPendingCount();

      // If online, immediately try to sync
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
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic heartbeat sync check every 15 seconds
    const interval = setInterval(() => {
      if (navigator.onLine) {
        triggerSync();
      }
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
        triggerSync,
        lastSyncResult
      }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const context = useContext(OfflineQueueContext);
  if (!context) {
    throw new Error('useOfflineQueue must be used within an OfflineQueueProvider');
  }
  return context;
}
