/**
 * Phase 1: Metadata.rating widened from Float? to Json?.
 *
 * Shape aggregates rating signals from AniList / MAL / MU / Kitsu:
 *   - value: the canonical numeric score (typically 0..100 or 0..10)
 *   - scoredBy: count of users who scored
 *   - rank: provider-side ordinal rank (lower = better)
 *   - source: which provider supplied the canonical value
 *
 * Per-source contributions are not retained in this Phase 1 shape — Phase 1.5's
 * consensus selector will add `alternatives` analogous to ProvenanceEntry.
 */

import { z } from 'zod';

export const ratingJsonSchema = z.object({
  value: z.number().min(0).max(100),
  scoredBy: z.number().int().nonnegative().optional(),
  rank: z.number().int().positive().optional(),
  source: z.enum(['anilist', 'mal', 'mangaupdates', 'kitsu']).optional(),
});

export type RatingJson = z.infer<typeof ratingJsonSchema>;

/**
 * Parse a raw value from Metadata.rating into a typed RatingJson, or null if
 * the shape is malformed (defensive — Phase 1.5 selector will reject empty
 * candidates rather than persist them).
 */
export function parseRatingJson(raw: unknown): RatingJson | null {
  const result = ratingJsonSchema.safeParse(raw);
  return result.success ? result.data : null;
}
