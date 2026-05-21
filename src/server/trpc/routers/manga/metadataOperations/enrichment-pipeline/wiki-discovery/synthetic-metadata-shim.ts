/**
 * Test-only seam for the Fandom-discovery harness. When the harness is testing
 * with synthetic mangaIds (≥ 100000) that don't have real DB rows, it seeds
 * AniList-style metadata here so the production code paths
 * (`readAnilistFandomUrl`, `loadAltTitlesForFandom`) can exercise Tier 0 and
 * cross-script-alt scoring without inserting temp DB rows.
 *
 * Behavior in production (no seeds): every getter returns `null` /
 * `undefined`, so the discovery code falls through to the prisma path
 * unchanged.
 */

interface SyntheticEntry {
  externalLinks?: Array<{ site: string; url: string }>;
  synonyms?: string[];
}

const seeds = new Map<number, SyntheticEntry>();

/** Register synthetic metadata for a manga id. Subsequent calls overwrite. */
export function seedSyntheticMetadata(mangaId: number, entry: SyntheticEntry): void {
  seeds.set(mangaId, entry);
}

/** Clear all seeded data. Tests should call this between runs. */
export function clearSyntheticMetadata(): void {
  seeds.clear();
}

/** Returns the seeded entry for a mangaId, or `null` if none. Production code
 *  paths use this to short-circuit prisma calls in test mode. */
export function getSyntheticMetadata(mangaId: number): SyntheticEntry | null {
  return seeds.get(mangaId) ?? null;
}
