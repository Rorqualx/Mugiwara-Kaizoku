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

/**
 * Most alternatives stored per field. The selector overlay truncates to this
 * and the schema enforces it; both read this one constant so a list selector
 * that leaves forty unkept items cannot fail validation for the whole row.
 */
export const MAX_FIELD_ALTERNATIVES = 8;

/** Per-field dissenter array, ranked confidence-descending. */
export const fieldAlternativesArraySchema = z.array(fieldAlternativeSchema).max(MAX_FIELD_ALTERNATIVES);

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

/** Result of `sanitizeFieldAlternatives`: what can be stored, and what was left out. */
export interface SanitizedFieldAlternatives {
  /** Valid fields only; `{}` when nothing survived (or nothing was sent). */
  value: FieldAlternatives;
  /** Fields whose list was longer than `MAX_FIELD_ALTERNATIVES` and was cut. */
  truncatedFields: string[];
  /** Fields dropped because an entry failed validation. */
  rejectedFields: string[];
}

/**
 * Validate a `fieldAlternatives` payload one field at a time for writing.
 *
 * `parseFieldAlternatives` is all-or-nothing, which is right for a reader but
 * meant one over-long list on the write side discarded every other field's
 * alternatives. Here an over-long list is cut to the first
 * `MAX_FIELD_ALTERNATIVES` entries (callers send them best first), a field
 * with a malformed entry is dropped on its own, and the caller is told which.
 *
 * Returns `null` only when `raw` is not an object at all.
 */
export function sanitizeFieldAlternatives(raw: unknown): SanitizedFieldAlternatives | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const result: SanitizedFieldAlternatives = { value: {}, truncatedFields: [], rejectedFields: [] };
  for (const [field, entries] of Object.entries(raw)) {
    const capped: unknown = Array.isArray(entries) ? entries.slice(0, MAX_FIELD_ALTERNATIVES) : entries;
    const parsed = fieldAlternativesArraySchema.safeParse(capped);
    if (!parsed.success) {
      result.rejectedFields.push(field);
      continue;
    }
    if (Array.isArray(entries) && entries.length > MAX_FIELD_ALTERNATIVES) result.truncatedFields.push(field);
    if (parsed.data.length > 0) result.value[field] = parsed.data;
  }
  return result;
}
