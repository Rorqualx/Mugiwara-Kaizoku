/**
 * Shared utility functions
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate UUID format */
export function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

/** Assert UUID format, throw if invalid */
export function assertUUID(uuid: string, label = 'ID'): void {
  if (!isValidUUID(uuid)) {
    throw new Error(`Invalid UUID for ${label}: ${uuid}`);
  }
}

/** Strip HTML tags from a string */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Parse a partial date (year, optional month, optional day) into ISO string */
export function parsePartialDate(
  year?: number | null,
  month?: number | null,
  day?: number | null
): string | undefined {
  if (!year) return undefined;

  if (month && day) {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  if (month) {
    const m = String(month).padStart(2, '0');
    return `${year}-${m}`;
  }

  return String(year);
}

/** Return first non-empty/non-undefined value */
export function firstNonEmpty<T>(...values: (T | undefined | null)[]): T | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') {
      return v;
    }
  }
  return undefined;
}

/** Deduplicate strings (case-insensitive) */
export function deduplicateStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of arr) {
    const lower = s.toLowerCase().trim();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      result.push(s.trim());
    }
  }
  return result;
}

/** Merge two arrays and deduplicate by key */
export function mergeArraysByKey<T>(
  primary: T[],
  secondary: T[],
  keyFn: (item: T) => string
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of primary) {
    const key = keyFn(item).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  for (const item of secondary) {
    const key = keyFn(item).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

/** Pick the longer non-empty string */
export function preferLonger(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
}
