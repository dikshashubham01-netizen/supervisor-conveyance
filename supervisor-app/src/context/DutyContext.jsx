import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const DutyContext = createContext(null);

export function DutyProvider({ children }) {
  const { user } = useAuth();
  const [activeDuty, setActiveDuty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const refreshDuty = useCallback(async () => {
    if (!user) {
      setActiveDuty(null);
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
