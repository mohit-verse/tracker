/**
 * Formats a 24-hour time string ('HH:mm') to a 12-hour display string ('h:mm AM/PM').
 */
export function formatTo12hDisplay(timeStr: string): string {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Converts a 24h time string 'HH:mm' to a Date object.
 */
export function parseTimeToDate(timeStr: string): Date {
  const d = new Date();
  if (!timeStr) {
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  d.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
}

/**
 * Converts a Date object to 24h time string 'HH:mm'.
 */
export function formatDateTo24h(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
