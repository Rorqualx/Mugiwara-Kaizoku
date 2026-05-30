/**
 * Phase 2 #3: Zod schema for `Metadata.fieldAlternatives`.
 *
 * Shape per the Phase 1.5 deep-dive D1:
 *
 *   {
 *     [field]: [
 *       { provider, value, confidence },
 *       ...
 *     ]
 *   }
 *
 * Validated at the persister boundary on write. Reads use `parseFieldAlternatives`
 * to safely coerce a JsonValue back to the typed object; malformed rows
 * (predating Phase 1.5 cutover, or written by a future selectorVersion with
 * an unknown shape) fall through to `null` instead of throwing.
 */

import { z } from 'zod';

export const fieldAlternativeSchema = z.object({
  provider: z.string().min(1).max(32),
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
});

/** Per-field dissenter array, ranked confidence-descending. */
export const fieldAlternativesArraySchema = z.array(fieldAlternativeSchema).max(8);

/**
 * Top-level `Metadata.fieldAlternatives` shape. Open-record under `.passthrough()`
 * so future MetadataField names land without breaking parse.
 */
export const fieldAlternativesSchema = z.record(z.string(), fieldAlternativesArraySchema);

export type FieldAlternative = z.infer<typeof fieldAlternativeSchema>;
export type FieldAlternatives = z.infer<typeof fieldAlternativesSchema>;

/**
 * Parse a raw JsonValue from Metadata.fieldAlternatives into a typed object.
 * Returns `null` on malformed input — defensive, never throws.
 *
 * Phase 4 UI provenance badges call this on every Metadata row read.
 */
export function parseFieldAlternatives(raw: unknown): FieldAlternatives | null {
  const result = fieldAlternativesSchema.safeParse(raw);
  return result.success ? result.data : null;
}
