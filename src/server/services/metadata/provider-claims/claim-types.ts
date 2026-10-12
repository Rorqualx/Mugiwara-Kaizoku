/**
 * Per-provider claims store — shared vocabulary.
 *
 * One row is one thing one provider said (or one fetch that was attempted) in
 * one enrichment run. See the `MetadataProviderClaim` model for the columns.
 */

/** How many runs are kept per title; older runs are deleted when a run is written. */
export const CLAIM_RUNS_KEPT_PER_TITLE = 20;

/** `field` of the one-per-(run, provider) fetch row. Sub-stages use `_fetch.<stage>`. */
export const FETCH_FIELD = '_fetch';
/** `field` of a provider's volume → chapter-range manifest row. */
export const MANIFEST_FIELD = 'volumeRanges';

/**
 * What became of a provider's fetch in one run.
 *
 * - `ok`       — everything asked of the provider arrived and was used.
 * - `partial`  — the provider answered, but a follow-up fetch for it did not
 *                bring back everything it asked for (Fandom's list arrived,
 *                some or all of its chapter pages did not).
 * - `no_match` — the provider answered and has nothing for this title.
 * - `failed`   — error, timeout, outage, or a page our parser got nothing from.
 *                The provider may well have the data.
 * - `gated`    — data fetched, then discarded by a gate (cross-series gate).
 * - `skipped`  — not asked: disabled, unbound by the user, or not applicable.
 * - `unknown`  — the fetch phase ended before it reported on its providers.
 *
 * Only `ok` is a good fetch: `getLastGoodClaim` skips every other outcome.
 *
 * A `_fetch.<stage>` row uses the same words for that stage alone: `failed`
 * when nothing it asked for came back, `partial` when some did, `ok` when all did.
 */
export type ClaimFetchOutcome = 'ok' | 'partial' | 'no_match' | 'failed' | 'gated' | 'skipped' | 'unknown';

/**
 * What the selector did with a scalar claim.
 *
 * - `winner`       — this claim was picked.
 * - `agrees`       — same value as the winner after the selector's own normalisation.
 * - `dissent`      — a different value from the winner.
 * - `refused`      — the guard refused the field; nothing was written.
 * - `not_selected` — the field had no winner.
 * - `not_counted`  — the selector dropped the value as unusable (`N/A`, `tba`).
 * - `not_compared` — the value was not compared with the winner: the field
 *                    type is ranked or merged rather than voted on, or the key
 *                    never went to the selector.
 */
export type ClaimSelectorOutcome =
  | 'winner' | 'agrees' | 'dissent' | 'refused' | 'not_selected' | 'not_counted' | 'not_compared';

export type ClaimKind = 'fetch' | 'scalar' | 'manifest';

export type ClaimJson = string | number | boolean | null | ClaimJson[] | { [key: string]: ClaimJson };

/** One row as the recorder builds it. */
export interface ClaimRow {
  provider: string;
  kind: ClaimKind;
  field: string;
  providerRecordId: string | null;
  value: ClaimJson | null;
  fetchOutcome: ClaimFetchOutcome;
  selectorOutcome: ClaimSelectorOutcome | null;
  inWinningGroup: boolean | null;
  matchConfidence: number | null;
  fieldConfidence: number | null;
  detail: ClaimJson | null;
}

/** Everything one run writes, in one batch. */
export interface ClaimRunBatch {
  mangaId: number;
  runId: string;
  startedAt: Date;
  rows: ClaimRow[];
}

/** One row as read back. `value` and `detail` are whatever JSON was stored. */
export interface StoredClaim {
  mangaId: number;
  runId: string;
  provider: string;
  kind: string;
  field: string;
  providerRecordId: string | null;
  value: unknown;
  fetchOutcome: string;
  selectorOutcome: string | null;
  inWinningGroup: boolean | null;
  matchConfidence: number | null;
  fieldConfidence: number | null;
  detail: unknown;
  createdAt: Date;
}

export interface LatestClaims {
  runId: string;
  createdAt: Date;
  claims: StoredClaim[];
}
