import { App } from '@capacitor/app';

export const FALLBACK_APP_VERSION = '1.0.4';
export const FALLBACK_VERSION_CODE = 5;

export async function getInstalledAppInfo() {
  try {
    const info = await App.getInfo();
    return {
      version: info.version || FALLBACK_APP_VERSION,
      versionCode: Number(info.build) || FALLBACK_VERSION_CODE
    };
  } catch (err) {
    console.warn('Could not query native App.getInfo, using fallback:', err);
    return {
      version: FALLBACK_APP_VERSION,
      versionCode: FALLBACK_VERSION_CODE
    };
  }
}

export function isNewerVersion(remoteVer, currentVer, remoteCode, currentCode) {
  // If integer version codes are provided, use them as primary source of truth
  const rCode = Number(remoteCode);
  const cCode = Number(currentCode);
  if (!isNaN(rCode) && !isNaN(cCode) && rCode > 0 && cCode > 0) {
    if (rCode > cCode) return true;
    if (rCode < cCode) return false;
  }

  // Fallback to Semantic Version comparison (e.g. 1.10.0 > 1.9.9)
  if (!remoteVer || !currentVer) return false;

  const cleanR = String(remoteVer).replace(/^v/i, '').trim();
  const cleanC = String(currentVer).replace(/^v/i, '').trim();

  const rParts = cleanR.split('.').map((p) => parseInt(p, 10) || 0);
  const cParts = cleanC.split('.').map((p) => parseInt(p, 10) || 0);
  const maxLen = Math.max(rParts.length, cParts.length);

  for (let i = 0; i < maxLen; i++) {
    const r = rParts[i] || 0;
    const c = cParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }

  return false;
}
