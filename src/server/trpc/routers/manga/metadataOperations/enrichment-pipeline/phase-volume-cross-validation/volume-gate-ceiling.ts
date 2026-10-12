/**
 * The chapter ceiling the volume gate clamps ranges to, and the correction of
 * a chapter scalar that is a count rather than a final chapter number.
 */

import { resolveTrustedFinalChapter, plausibleTrustedCeiling, type StoredTerminalSignal } from '../phase-data-assembly';

import { gateChapterCount } from './gate-chapter-count';
import { appliedCount } from './witness-counts';

import type { UnifiedProviderResults } from '../types';

/**
 * Wikipedia's chapter count for the gate. The cross-series gate empties the
 * chapter list of an article it distrusts but leaves `data.chapters` in place;
 * a count from a disabled article is no count (Frieren: 83, against 147).
 */
function wikipediaGateCount(result: UnifiedProviderResults): number {
  const wiki = result.wikipediaResult;
  if (!wiki || wiki.chapterList.length === 0) return 0;
  const chapters = wiki.data.chapters;
  return typeof chapters === 'number' && chapters > 0 ? chapters : 0;
}

/**
 * An ongoing series' scalar this many times Wikipedia's count is not the same
 * series (the cross-series gate uses the same factor for a wiki against a feed).
 */
const MAX_SCALAR_OVER_WIKIPEDIA = 2;

/**
 * Resolve the volume-gate chapter ceiling for cross-validation.
 *
 * A finished series with a plausible trusted scalar clamps the ceiling to its
 * known final chapter and switches the gate to exact (no 1.1× tolerance), so an
 * end-of-series phantom volume (AoT "Volume 35" @ ch 140 past the real 139) is
 * rejected. plausibleTrustedCeiling ignores a broken scalar (Black Clover
 * chapters=1) so a real volume structure is never gated away.
 *
 * Without a trusted ceiling (an ongoing series) the gate uses the larger of
 * Wikipedia's count and the chapter scalar. Wikipedia lists collected volumes
 * only, so on its own it cut off every range past the latest volume. A scalar
 * more than twice Wikipedia's count is ignored.
 */
export function resolveVolumeGateCeiling(
  result: UnifiedProviderResults,
  stored?: StoredTerminalSignal,
): { expectedChapterCount: number | null; trusted: boolean } {
  const wikiCount = wikipediaGateCount(result);
  const scalar = appliedCount(result, 'chapters');
  const sourceCount = wikiCount > 0 ? wikiCount : scalar;
  const rawExpected = sourceCount > 0 ? sourceCount : null;

  const final = resolveTrustedFinalChapter(result, stored);
  const ceiling = plausibleTrustedCeiling(final.ceiling, rawExpected ?? 0);
  if (ceiling === null) {
    // The scalar may lift the ceiling above Wikipedia's collected volumes, but
    // not without limit: Wikipedia is the only check an ongoing series has on
    // a scalar that overshoots.
    const scalarPlausible = wikiCount === 0 || scalar <= wikiCount * MAX_SCALAR_OVER_WIKIPEDIA;
    const untrusted = scalarPlausible ? Math.max(wikiCount, scalar) : wikiCount;
    return { expectedChapterCount: untrusted > 0 ? untrusted : null, trusted: false };
  }
  return {
    expectedChapterCount: gateChapterCount(rawExpected, ceiling, final.corroboratedFinal ?? null),
    trusted: true,
  };
}

export interface FinalChapterCorrection {
  from: number;
  to: number;
  sources: string[];
}

/**
 * Replace a finished series' chapter scalar with its cross-checked final
 * chapter when the scalar is a count that includes extras (Bleach 706 → 686).
 *
 * Runs once, before persistence, so every later reader of the scalar — the
 * stub merge, reconciliation, the phantom prune, the stored value the next run
 * falls back on — sees a chapter number. The provenance names a provider that
 * actually reported the number. Returns null when nothing changed.
 */
export function applyCorroboratedFinalChapter(
  result: UnifiedProviderResults,
  stored?: StoredTerminalSignal,
): FinalChapterCorrection | null {
  const applied = result.enrichmentResult.appliedMatch;
  const metadata = applied?.metadata as Record<string, unknown> | undefined;
  const scalar = appliedCount(result, 'chapters');
  if (!applied || !metadata || scalar <= 0) return null;

  // Same stored signal as the gate, so a series finished only by what is
  // stored (live status still ONGOING) has its scalar corrected with its gate.
  const final = resolveTrustedFinalChapter(result, stored);
  const [firstSource] = final.corroboratedBy ?? [];
  if (!final.trusted || final.ceiling === null || final.ceiling >= scalar || firstSource === undefined) return null;
  // A lower ceiling that is some other provider's scalar is not a cross-checked number.
  if (final.ceiling !== final.corroboratedFinal) return null;

  metadata['chapters'] = final.ceiling;
  if (applied.perFieldProvenance) applied.perFieldProvenance['chapters'] = firstSource;

  const enriched = result.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
  const manga = enriched?.['manga'] as Record<string, unknown> | undefined;
  const total = manga?.['totalChapters'];
  if (manga && typeof total === 'number' && total > final.ceiling) manga['totalChapters'] = final.ceiling;

  return { from: scalar, to: final.ceiling, sources: final.corroboratedBy ?? [] };
}
