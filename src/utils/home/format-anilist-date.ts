/**
 * AniList date formatting utilities for home page components.
 *
 * Two variants:
 * - formatAniListDateISO: YYYY-MM-DD for API payloads (returns null if no year)
 * - formatAniListDateDisplay: human-readable for UI display (returns 'Unknown' fallback)
 */

interface AniListDateInput {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export function formatAniListDateISO(date: AniListDateInput | null): string | null {
  if (!date?.year) return null;
  const y = date.year;
  const m = date.month ? String(date.month).padStart(2, '0') : '01';
  const d = date.day ? String(date.day).padStart(2, '0') : '01';
  return `${y}-${m}-${d}`;
}

export function formatAniListDateDisplay(date: AniListDateInput | null): string {
  if (!date?.year) return 'Unknown';
  if (!date.month) return `${date.year}`;
  if (!date.day) return `${date.year}-${String(date.month).padStart(2, '0')}`;
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}
