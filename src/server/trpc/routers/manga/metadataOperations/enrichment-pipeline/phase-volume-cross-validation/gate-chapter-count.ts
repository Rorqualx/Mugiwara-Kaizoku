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
 *
 * A source count that is merely somewhat low is not caught by that floor:
 * Wikipedia read the parent's section of a shared list page for Tokyo Ghoul:re
 * and reported 143 against a final chapter of 179, so the gate clamped to 143.
 * When two providers agree on the highest numbered chapter of a finished
 * series (`corroboratedFinal`), the gate does not go below it.
 */
export function gateChapterCount(
  sourceCount: number | null,
  trustedCeiling: number,
  corroboratedFinal: number | null = null,
): number {
  if (sourceCount === null || sourceCount <= 0) return trustedCeiling;
  if (sourceCount < trustedCeiling * SOURCE_COUNT_PLAUSIBILITY_FLOOR) return trustedCeiling;
  const gated = Math.min(sourceCount, trustedCeiling);
  if (corroboratedFinal !== null && gated < corroboratedFinal) return Math.min(corroboratedFinal, trustedCeiling);
  return gated;
}
