/**
 * Anchor gate: a refresh stops after the provider fetch when AniList did not
 * answer.
 *
 * AniList is the anchor every count, status and ceiling downstream leans on
 * (provider registry: `anchor: true`). Without it the run falls back to
 * MangaUpdates' latest chapter as the ceiling, the cross-series gate and the
 * phantom prunes misfire, and a finished title's volumes are rebuilt from a
 * mix of editions (JoJo Part 7: MangaDex + ComicVine hardcover + interpolated
 * volumes, phantom rows, downloaded chapters left without a volume).
 *
 * So when AniList timed out or failed, nothing after the fetch runs: no
 * Volume or Chapter writes, no count or status writes, no prunes, no
 * post-enrichment hooks. The title stays exactly as it was and the run
 * reports itself skipped. A genuine "no match" (a title AniList does not
 * have) is an answer and runs normally, as does a run with AniList disabled.
 *
 * MAL is the registry's other anchor but is reached through AniList's
 * `idMal`; its own failure leaves the AniList anchor intact, so it does not
 * stop the run.
 */

import { isAnchor } from '@/lib/metadata/provider-registry';
import { logger } from '@/utils/logger';

import type { ProviderOutcomes } from '../phase-provider-fetch/provider-outcome';

/** The anchor whose silence stops a run. */
export const PRIMARY_ANCHOR = 'anilist';

export interface AnchorSkip {
  reason: 'anchor-unanswered';
  provider: string;
  outcome: 'timeout' | 'error';
}

/**
 * The skip this run must take, or null when it may go on. An absent status
 * map (a result built outside the provider-fetch phase) is not a failure.
 */
export function anchorUnanswered(providerStatus: ProviderOutcomes | undefined): AnchorSkip | null {
  if (!isAnchor(PRIMARY_ANCHOR)) return null;
  const outcome = providerStatus?.[PRIMARY_ANCHOR];
  if (outcome !== 'timeout' && outcome !== 'error') return null;
  return { reason: 'anchor-unanswered', provider: PRIMARY_ANCHOR, outcome };
}

/** One sentence for logs, progress events and the job's error. */
export function describeAnchorSkip(skip: AnchorSkip): string {
  const how = skip.outcome === 'timeout' ? 'timed out' : 'failed';
  return `refresh skipped: ${skip.provider} ${how}; volumes, chapters, counts and status left unchanged`;
}

export function logAnchorSkip(mangaId: number, skip: AnchorSkip): void {
  logger.warn(`[enrichmentPipeline] Manga ${mangaId}: ${describeAnchorSkip(skip)}`, { mangaId, skip });
}

/**
 * Thrown by the refresh sequence for a skipped run so the queued job is
 * recorded as not completed (and the manual refresh reports it).
 */
export class MetadataRefreshSkippedError extends Error {
  readonly mangaId: number;
  readonly skip: AnchorSkip;

  constructor(mangaId: number, skip: AnchorSkip) {
    super(`Metadata refresh for manga ${mangaId} ${describeAnchorSkip(skip)}`);
    this.name = 'MetadataRefreshSkippedError';
    this.mangaId = mangaId;
    this.skip = skip;
  }
}

export function isMetadataRefreshSkippedError(error: unknown): error is MetadataRefreshSkippedError {
  return error instanceof MetadataRefreshSkippedError;
}
