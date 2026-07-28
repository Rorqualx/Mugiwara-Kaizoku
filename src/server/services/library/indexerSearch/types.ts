/**
 * Indexer Search — type contract
 *
 * The unified release-search pipeline ({@link phaseIndexerSearch}) fans out to
 * every enabled source in parallel and returns a flat `ReleaseCandidate[]` so
 * the downstream {@link unifiedReleaseSearch} dispatcher (Task #25) can apply
 * pack-first ranking without source-specific branching.
 *
 * Source adapters (`adapters/*-adapter.ts`) own the translation from their
 * own native shape to this candidate shape. The dispatcher only consumes
 * `ReleaseCandidate[]`.
 */
import type { JobType } from '@prisma/client';

/** Sources participating in the unified release search. */
export type ReleaseSource = 'prowlarr' | 'mangadex' | 'suwayomi' | 'getcomics';

/**
 * Granularity of a single candidate.
 * - `pack`: one download covers many chapters (typically a torrent / NZB).
 * - `chapter`: one download covers exactly one chapter (native sources).
 */
export type ReleaseGranularity = 'pack' | 'chapter';

/** Which chapters a candidate covers, expressed as the chapter numbers it would deliver. */
export interface ReleaseCoverage {
  chapters: number[];
  /** Optional volume hint when the source surfaces it (Prowlarr title parse, MangaDex aggregate). */
  volumes?: number[];
}

/**
 * Source-specific payload carried verbatim into the dispatcher's enqueue call.
 * Discriminated by `source` so the dispatcher can map to the right `JobType`.
 *
 * Kept loose (`unknown`) here: each adapter narrows its own payload shape.
 * The dispatcher casts back when reading, guarded by `source` value.
 */
export type ReleaseCandidatePayload = unknown;

/**
 * A single candidate from one source. Score is source-internal — the dispatcher
 * does NOT compare scores across sources directly; ranking is by source priority
 * (pack-first) then in-source by score.
 */
export interface ReleaseCandidate {
  source: ReleaseSource;
  granularity: ReleaseGranularity;
  coverage: ReleaseCoverage;
  /** Source-internal score — seeders for Prowlarr, completeness for native, etc. */
  score: number;
  /** Human-readable label for logs and UI. */
  label: string;
  /** Source-specific payload; the dispatcher casts based on `source`. */
  payload: ReleaseCandidatePayload;
  /** Which queue handler the dispatcher should enqueue this candidate into. */
  enqueueJobType: JobType;
}

/**
 * How a caller wants to narrow the release search.
 *
 * `ALL_MISSING` (default) is the auto-trigger semantics: every monitored
 * chapter that isn't already completed. The other modes are for explicit
 * user actions ("download this chapter", "download volume 3", "download
 * these specific rows") — `monitored` is treated as overridden because the
 * user is asking directly.
 */
export interface ReleaseScope {
  mode: 'SINGLE' | 'VOLUME' | 'BULK' | 'ALL_MISSING';
  /** Specific chapter row ids — used by SINGLE (length 1) and BULK (length ≥ 1). */
  chapterIds?: number[];
  /** Volume to download — used by VOLUME. */
  volumeNumber?: number;
}

/** Optional knobs passed through to adapters. */
export interface IndexerSearchOptions {
  /** When true, adapters skip caches and fetch fresh. */
  forceRefresh?: boolean;
  /** Narrow the search to a subset of chapters. */
  scope?: ReleaseScope;
  /**
   * Effective MangaDex `translatedLanguage` preference for this run, already
   * resolved against the initiating user's override. The search phase has no
   * userId of its own, so the dispatcher — which does — passes its resolved
   * value down. Both sides must agree: the adapter filters candidates by it
   * and the dispatcher's `language_mismatch` gate re-checks the same value,
   * so a divergence would let the gate reject everything the adapter emits.
   * Omitted → the adapter falls back to the global config.
   */
  preferredLanguage?: string;
}
