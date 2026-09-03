import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { startBackgroundTracking, stopBackgroundTracking } from '../utils/backgroundTracking';

const DutyContext = createContext(null);

export function DutyProvider({ children }) {
  const { user } = useAuth();
  const [activeDuty, setActiveDuty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const refreshDuty = useCallback(async () => {
    if (!user) {
      setActiveDuty(null);
      stopBackgroundTracking();
      return;
    }
    try {
      setLoading(true);
      const res = await api.duty.getCurrent();
      setActiveDuty(res.activeDuty);
      if (res.activeDuty?.lastLocation?.synced_at) {
        setLastSyncTime(new Date(res.activeDuty.lastLocation.synced_at));
      }
    } catch (err) {
      console.warn('Duty refresh error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshDuty();
  }, [refreshDuty]);

  // Sync native Android background location tracking with on-duty state
  useEffect(() => {
    if (activeDuty?.id && user?.id) {
      startBackgroundTracking(activeDuty.id, user.id);
    } else {
      stopBackgroundTracking();
    }
  }, [activeDuty?.id, user?.id]);

  return (
    <DutyContext.Provider
      value={{
        activeDuty,
        isOnDuty: !!activeDuty,
        loading,
        refreshDuty,
        lastSyncTime
      }}
    >
      {children}
    </DutyContext.Provider>
  );
}

export function useDuty() {
  const ctx = useContext(DutyContext);
  if (!ctx) throw new Error('useDuty must be inside DutyProvider');
  return ctx;
}
