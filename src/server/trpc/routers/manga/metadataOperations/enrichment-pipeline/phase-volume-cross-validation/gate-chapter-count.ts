/**
 * Chapter count the volume gate clamps ranges to, given the source count and
 * a trusted final-chapter ceiling.
 */

/** A source count below this fraction of the trusted ceiling is treated as broken. */
const SOURCE_COUNT_PLAUSIBILITY_FLOOR = 0.5;

/**
 * The smaller of the two normally wins (AoT: sources list 141, the series
 * ended at 139). A source count far below the ceiling is a wrong page, not a
 * shorter series: Wikipedia resolved Steel Ball Run to the umbrella "JoJo's
 * Bizarre Adventure" article and reported 1 chapter against AniList's 95,
 * which discarded every volume range past the first.
 */
export function gateChapterCount(sourceCount: number | null, trustedCeiling: number): number {
  if (sourceCount === null || sourceCount <= 0) return trustedCeiling;
  if (sourceCount < trustedCeiling * SOURCE_COUNT_PLAUSIBILITY_FLOOR) return trustedCeiling;
  return Math.min(sourceCount, trustedCeiling);
}
