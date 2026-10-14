/**
 * Acceptance checks for a volume-band parse. A parse that fails any of them is
 * discarded and the page goes through the other parsers as before.
 *
 * @module volume-band-parser/validate
 */

const MIN_VOLUMES = 3;
const MIN_MEDIAN = 2;
const MAX_MEDIAN = 30;

/**
 * Why the bands were rejected, or null when they are accepted. `strict` also
 * requires every volume's whole chapters to come after all of the previous
 * volume's: navigation-box rows are hand-kept and can file a chapter one
 * volume off (Dr. STONE's box puts chapter 15 in volume 3).
 */
export function rejectReason(bands: Map<number, number[]>, strict = false): string | null {
  const filled = [...bands.entries()].filter(([, chapters]) => chapters.length > 0).sort((a, b) => a[0] - b[0]);
  if (filled.length < MIN_VOLUMES) return `only ${filled.length} volumes with chapters`;

  const seen = new Set<number>();
  for (const [volume, chapters] of filled) {
    for (const n of chapters) {
      if (seen.has(n)) return `chapter ${n} appears in two volumes (again in volume ${volume})`;
      seen.add(n);
    }
  }

  // Volume starts never go back. A ".5" extra may sit in any volume (My Hero
  // Academia files 6.5 in volume 3), so only whole chapters count.
  let previousStart = -Infinity;
  let previousEnd = -Infinity;
  for (const [volume, chapters] of filled) {
    const whole = chapters.filter(n => Number.isInteger(n));
    if (whole.length === 0) continue;
    const start = Math.min(...whole);
    if (start < previousStart) return `volume ${volume} starts at ${start}, before the volume above it`;
    if (strict && start < previousEnd) return `volume ${volume} starts at ${start}, inside the volume above it`;
    previousStart = start;
    previousEnd = Math.max(...whole);
  }

  const sizes = filled.map(([, chapters]) => chapters.length).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] ?? 0;
  if (median < MIN_MEDIAN || median > MAX_MEDIAN) return `median ${median} chapters per volume`;
  return null;
}
