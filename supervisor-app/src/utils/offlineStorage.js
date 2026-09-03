import { get, set, update } from 'idb-keyval';

const PENDING_LOCATIONS_KEY = 'supervisor_app_pending_gps';

export async function savePendingLocation(point) {
  try {
    await update(PENDING_LOCATIONS_KEY, (val) => {
      const list = val || [];
      list.push(point);
      return list;
    });
  } catch (err) {
    try {
      const raw = localStorage.getItem(PENDING_LOCATIONS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.push(point);
      localStorage.setItem(PENDING_LOCATIONS_KEY, JSON.stringify(list));
    } catch (e) {}
  }
}

export async function getPendingLocations() {
  try {
    const list = await get(PENDING_LOCATIONS_KEY);
    return list || [];
  } catch (err) {
    try {
      const raw = localStorage.getItem(PENDING_LOCATIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
}

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

export async function getPendingCount() {
  const list = await getPendingLocations();
  return list.length;
}
