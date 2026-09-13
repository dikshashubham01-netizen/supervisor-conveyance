/**
 * Timezone utilities for GeoConvey (Asia/Kolkata / IST UTC+5:30)
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns date string 'YYYY-MM-DD' in Asia/Kolkata timezone
 */
export function getISTDateString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  // en-CA formats as YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
}

/**
 * Returns numeric components { year, month, day, hours, minutes, seconds } in IST
 */
export function getISTParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  const dateStr = d.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE }); // YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);

  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: IST_TIMEZONE, hour12: false }); // HH:MM:SS
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);

  return { year, month, day, hours, minutes, seconds, dateStr };
}

/**
 * Checks if two dates fall on the same calendar day in Asia/Kolkata
 */
export function isSameISTDay(date1, date2) {
  if (!date1 || !date2) return false;
  return getISTDateString(date1) === getISTDateString(date2);
}

/**
 * Returns total days in a given month (month: 1-12)
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Checks if a specific date is a Weekly Off (Sunday by default)
 */
export function isWeeklyOff(year, month, day) {
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  // Use noon IST to prevent any edge-of-day timezone boundary shifts
  const d = new Date(`${year}-${paddedMonth}-${paddedDay}T12:00:00+05:30`);
  return d.getDay() === 0; // 0 is Sunday
}

/**
 * Formats day column header e.g. day=1, month=9 -> '01-Sep'
 */
export function formatDayHeader(day, month) {
  const paddedDay = String(day).padStart(2, '0');
  const monthAbbr = MONTH_NAMES[month - 1] || '';
  return `${paddedDay}-${monthAbbr}`;
}

export { MONTH_NAMES };
