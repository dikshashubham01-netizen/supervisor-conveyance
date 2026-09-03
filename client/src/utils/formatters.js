// ─── Time Parsing ────────────────────────────────────────────────────────────
// SQLite stores timestamps as "YYYY-MM-DD HH:MM:SS" (UTC, no Z suffix).
// Browsers parse strings without timezone info as LOCAL time — wrong!
// We force UTC parse then let toLocaleString() convert to user's local timezone.
function parseUTC(dateStr) {
  if (!dateStr) return null;
  // Already has timezone marker (Z, +, -)
  if (/[Z+\-]\d*$/.test(String(dateStr).trim())) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  // SQLite format: "2026-09-03 17:44:00" → treat as UTC by appending Z
  const normalized = String(dateStr).trim().replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

// India locale — shows times in whatever timezone the device/browser is set to
const LOCALE = 'en-IN';

export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return `₹${Number(amount).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatDistance(km) {
  if (km == null || isNaN(km)) return '0.00 KM';
  return `${Number(km).toFixed(2)} KM`;
}

export function formatDateTime(dateStr) {
  const d = parseUTC(dateStr);
  if (!d) return 'N/A';
  return d.toLocaleString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function formatTime(dateStr) {
  const d = parseUTC(dateStr);
  if (!d) return 'N/A';
  return d.toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDate(dateStr) {
  const d = parseUTC(dateStr);
  if (!d) return 'N/A';
  return d.toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function getStatusBadge(status) {
  switch (status) {
    case 'ON_DUTY':
      return {
        label: 'ON DUTY',
        icon: '🟢',
        bg: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400',
        dot: 'bg-emerald-400 animate-pulse'
      };
    case 'PENDING_VERIFICATION':
      return {
        label: 'WAITING FOR VERIFICATION',
        icon: '🟠',
        bg: 'bg-amber-950/80 border-amber-500/50 text-amber-400',
        dot: 'bg-amber-400'
      };
    case 'APPROVED':
      return {
        label: 'APPROVED',
        icon: '✅',
        bg: 'bg-teal-950/80 border-teal-500/50 text-teal-400',
        dot: 'bg-teal-400'
      };
    case 'NEEDS_REVIEW':
      return {
        label: 'NEEDS ADMIN REVIEW',
        icon: '⚠️',
        bg: 'bg-rose-950/80 border-rose-500/50 text-rose-400',
        dot: 'bg-rose-400 animate-ping'
      };
    case 'REJECTED':
      return {
        label: 'REJECTED',
        icon: '❌',
        bg: 'bg-red-950/80 border-red-500/50 text-red-400',
        dot: 'bg-red-400'
      };
    default:
      return {
        label: status || 'UNKNOWN',
        icon: '⚪',
        bg: 'bg-slate-800 border-slate-700 text-slate-300',
        dot: 'bg-slate-400'
      };
  }
}
