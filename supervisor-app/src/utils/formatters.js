// ─── Time Parsing & Formatting (IST / Local Timezone Safe) ─────────────────────
// SQLite stores timestamps as "YYYY-MM-DD HH:MM:SS" (UTC without 'Z').
// We parse as UTC then extract local getHours/getMinutes/getDate for 100% reliable local time.
function parseUTC(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  const s = String(dateStr).trim();
  if (/[Z+\-]\d*$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
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
      return { label: 'ON DUTY', bg: 'bg-emerald-950 border-emerald-500 text-emerald-400', dot: 'bg-emerald-400 animate-pulse' };
    case 'PENDING_VERIFICATION':
      return { label: 'PENDING VERIFICATION', bg: 'bg-amber-950 border-amber-500 text-amber-400', dot: 'bg-amber-400' };
    case 'APPROVED':
      return { label: 'APPROVED', bg: 'bg-teal-950 border-teal-500 text-teal-400', dot: 'bg-teal-400' };
    case 'NEEDS_REVIEW':
      return { label: 'NEEDS REVIEW', bg: 'bg-rose-950 border-rose-500 text-rose-400', dot: 'bg-rose-400 animate-ping' };
    default:
      return { label: status || 'UNKNOWN', bg: 'bg-slate-800 border-slate-700 text-slate-400', dot: 'bg-slate-400' };
  }
}
