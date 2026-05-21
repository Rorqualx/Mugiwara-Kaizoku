/**
 * FlareSolverr Version Utilities
 *
 * Version parsing and comparison for FlareSolverr.
 *
 * @module flaresolverr/flareSolverrClient/version-utils
 */

/**
 * Parse a version string into numeric parts
 * Handles versions like "v1.2.3", "1.2.3", "dev"
 */
function parseVersion(v: string): number[] {
  // Handle special 'dev' version
  if (v === 'dev') {
    return [999, 999, 999]; // Treat dev as always newest
  }

  return v
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10))
    .map((n) => (isNaN(n) ? 0 : n));
}

/**
 * Compare two semantic version strings
 *
 * Special handling for 'dev' version which is treated as always valid.
 *
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  // Dev version is always considered equal/valid
  if (a === 'dev' || b === 'dev') {
    return 0;
  }

  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }
  return 0;
}

/**
 * Check if a version is outdated compared to minimum
 */
export function isVersionOutdated(current: string, minimum: string): boolean {
  return compareVersions(current, minimum) < 0;
}
