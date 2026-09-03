import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const DutyContext = createContext(null);

export function DutyProvider({ children }) {
  const { user, isSupervisor } = useAuth();
  const [activeDuty, setActiveDuty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const refreshDuty = useCallback(async () => {
    if (!user || !isSupervisor) {
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
      console.error('Failed to refresh duty:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isSupervisor]);

  useEffect(() => {
    refreshDuty();
  }, [refreshDuty]);

  const updateRunningGps = (newDistanceKm) => {
    setActiveDuty((prev) => {
      if (!prev) return prev;
      const rate = prev.conveyance_rate || 4.50;
      return {
        ...prev,
        gps_distance_km: newDistanceKm,
        estimatedConveyance: Number((newDistanceKm * rate).toFixed(2))
      };
    });
    setLastSyncTime(new Date());
  };

  return (
    <DutyContext.Provider
      value={{
        activeDuty,
        isOnDuty: !!activeDuty,
        loading,
        refreshDuty,
        updateRunningGps,
        lastSyncTime
      }}
    >
      {children}
    </DutyContext.Provider>
  );
}

export function useDuty() {
  const context = useContext(DutyContext);
  if (!context) {
    throw new Error('useDuty must be used within a DutyProvider');
  }
  return context;
}
