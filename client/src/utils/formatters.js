// ─── Time Parsing & Formatting (IST / Local Timezone Safe) ─────────────────────
// SQLite stores timestamps as "YYYY-MM-DD HH:MM:SS" (UTC without 'Z').
// We parse as UTC then extract local getHours/getMinutes/getDate for 100% reliable local time.
function parseUTC(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  const s = String(dateStr).trim();
  // If already has timezone marker (Z, +, - after hour)
  if (/[Z+\-]\d*$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // SQLite UTC format: "2026-09-03 18:10:13" → "2026-09-03T18:10:13Z"
  const normalized = s.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatDistance(km) {
  if (km == null || isNaN(km)) return '0.00 KM';
  return `${Number(km).toFixed(2)} KM`;
}

export function formatTime(dateStr) {
  const d = parseUTC(dateStr);
  if (!d) return 'N/A';
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');
  return `${formattedHours}:${minutes} ${ampm}`;
}

export function formatDate(dateStr) {
  const d = parseUTC(dateStr);
  if (!d) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDateTime(dateStr) {
  const d = parseUTC(dateStr);
  if (!d) return 'N/A';
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
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
