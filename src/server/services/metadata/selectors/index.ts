/**
 * Phase 1.5: Cross-source consensus selector — dispatch entry point.
 *
 * Routes a SelectorContext to the correct per-field-type selector. The
 * per-type bodies arrive in commits #4–#8:
 *
 * - selectNumeric     (commit #4): cluster-vote + drift-guard fold-in
 * - selectCategorical (commit #5): enum normalize + majority vote
 * - selectString      (commit #6): placeholder reject + ranked pick
 * - selectList        (commit #7): frequency-weighted union
 * - selectStructured  (commit #8): per-field custom (rating JSON merge, etc.)
 *
 * Until those land, dispatch throws "selector not implemented." Consumers
 * (`enrichment-result-builder.ts` shadow mode, commit #9) check for
 * implementation availability before calling.
 */

import { selectCategorical } from './select-categorical';
import { selectList } from './select-list';
import { selectNumeric } from './select-numeric';
import { selectString } from './select-string';
import { selectStructured } from './select-structured';
import { classifyConfidence, type FieldType } from './thresholds';
import { getFieldType, type SelectorContext, type SelectorFn, type SelectorResult } from './types';

export const SELECTORS: Record<FieldType, SelectorFn> = {
  numeric:     selectNumeric,
  categorical: selectCategorical,
  string:      selectString,
  list:        selectList,
  structured:  selectStructured,
};

/**
 * Dispatch entry point. Derives field-type from the field name and routes
 * to the appropriate per-type selector. Pure function — no I/O, no DB.
 */
export function selectField(ctx: SelectorContext): SelectorResult {
  const fn = SELECTORS[ctx.fieldType];
  const raw = fn(ctx);
  // Derive the persistence class in exactly one place, from the winner's
  // confidence + field-type (drives the review badge for objective fields).
  return { ...raw, confidenceClass: classifyConfidence(raw.confidence, ctx.fieldType) };
}

// Re-exports — single import surface for consumers in commits #9 onwards.
export type { Candidate, SelectorContext, SelectorResult, SelectorAlternative, SelectorFn } from './types';
export { getFieldType };
