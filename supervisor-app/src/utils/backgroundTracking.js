import { registerPlugin } from '@capacitor/core';
import { getToken, getServerUrl } from '../api/client';

export const BackgroundTracking = registerPlugin('BackgroundTracking');

export async function startBackgroundTracking(dutySessionId, supervisorId) {
  try {
    const token = getToken();
    const serverUrl = getServerUrl();
    await BackgroundTracking.startTracking({
      dutySessionId,
      supervisorId: supervisorId || '',
      token: token || '',
      serverUrl
    });
    console.log('✅ Native background tracking started for session:', dutySessionId);
  } catch (err) {
    console.warn('Background tracking start warning (may be web preview):', err?.message || err);
  }
}

export async function stopBackgroundTracking() {
  try {
    await BackgroundTracking.stopTracking();
    console.log('🛑 Native background tracking stopped');
  } catch (err) {
    console.warn('Background tracking stop warning:', err?.message || err);
  }
}
