import { get, set, update } from 'idb-keyval';

const PENDING_LOCATIONS_KEY = 'conveyance_pending_gps_locations';

/**
 * Saves a single GPS location record locally in IndexedDB
 */
export async function savePendingLocation(point) {
  try {
    await update(PENDING_LOCATIONS_KEY, (val) => {
      const list = val || [];
      list.push(point);
      return list;
    });
  } catch (err) {
    console.error('Failed to save location to IndexedDB:', err);
    // Fallback to localStorage if IndexedDB is blocked in private browsing
    try {
      const raw = localStorage.getItem(PENDING_LOCATIONS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.push(point);
      localStorage.setItem(PENDING_LOCATIONS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('LocalStorage fallback also failed:', e);
    }
  }
}

/**
 * Retrieves all pending unsynced locations
 */
export async function getPendingLocations() {
  try {
    const list = await get(PENDING_LOCATIONS_KEY);
    return list || [];
  } catch (err) {
    console.error('Failed to read from IndexedDB:', err);
    try {
      const raw = localStorage.getItem(PENDING_LOCATIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
}

/**
 * Removes specified successfully synced locations by clientUuid
 */
export async function clearSyncedLocations(clientUuids) {
  const uuidSet = new Set(clientUuids);
  try {
    await update(PENDING_LOCATIONS_KEY, (val) => {
      const list = val || [];
      return list.filter((p) => !uuidSet.has(p.clientUuid));
    });
  } catch (err) {
    try {
      const raw = localStorage.getItem(PENDING_LOCATIONS_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        const filtered = list.filter((p) => !uuidSet.has(p.clientUuid));
        localStorage.setItem(PENDING_LOCATIONS_KEY, JSON.stringify(filtered));
      }
    } catch (e) {}
  }
}

/**
 * Count of pending locations
 */
export async function getPendingCount() {
  const points = await getPendingLocations();
  return points.length;
}
