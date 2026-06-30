/**
 * Formatting helpers for the user activity drawer.
 */

/**
 * Format a duration in seconds as a compact human-readable string.
 * Examples: 0 → "0m", 45 → "<1m", 5400 → "1h 30m", 90000 → "1d 1h".
 */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  if (totalSeconds < 60) return '<1m';

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  // Only show minutes when the duration is under a day to keep it compact.
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : '0m';
}

/** Format a whole number with thousands separators (e.g. 1234 → "1,234"). */
export function formatCount(value: number): string {
  return value.toLocaleString();
}
