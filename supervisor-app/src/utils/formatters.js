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
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
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
