/**
 * One enrichment run's provider claims.
 *
 * `withClaimRun` creates a recorder when the run starts, hands it to the
 * phases on the pipeline options object, and writes everything it noted in
 * one insert when the run ends — also when the run throws, so a failed run
 * still leaves its fetch outcomes behind.
 *
 * Guarantees:
 *  - no process-wide state: the run id and every note live on the instance;
 *  - no `note*` method throws, and none awaits anything;
 *  - `flush` never throws and writes at most once.
 */

import { randomUUID } from 'node:crypto';

import { writeClaimRun } from '@/server/services/metadata/provider-claims/claim-store';
import { FETCH_FIELD, MANIFEST_FIELD, type ClaimFetchOutcome, type ClaimJson, type ClaimRow } from '@/server/services/metadata/provider-claims/claim-types';
import type { ProviderClaim } from '@/server/services/metadata/selectors/collect-candidates';
import type { ShadowSelection } from '@/server/services/metadata/selectors/shadow-mode';
import { logger } from '@/utils/logger';

import { buildUnvotedFragments, resolveFetchVerdicts, type FetchVerdict } from './fetch-rows';
import { countBackedVolumes, manifestValue, summariseManifests, summarisePreGateManifests, type ManifestSummary } from './manifest-rows';
import { buildSelectorFragments, type ScalarFragment } from './selector-rows';

import type { EnrichmentPipelineOptions } from '../types';
import type { ClaimRecorder, FetchPhaseSnapshot, ManifestProposal, PreGateSnapshot } from './recorder';

const log = logger.child('ClaimRun');

interface StageNote {
  provider: string;
  stage: string;
  requested: number;
  fetched: number;
}

type ValidatedRanges = ReadonlyArray<{ volumeNumber: number; sources: readonly string[] }>;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class ClaimRun implements ClaimRecorder {
  readonly runId: string = randomUUID();
  readonly startedAt: Date = new Date();

  private readonly failures = new Map<string, string>();
  private readonly gated = new Map<string, string>();
  private readonly preGate: PreGateSnapshot = {};
  private readonly stages: StageNote[] = [];
  private verdicts: FetchVerdict[] = [];
  private unvoted: ScalarFragment[] = [];
  private selected: ScalarFragment[] = [];
  private manifests = new Map<string, ManifestSummary>();
  private validated: ValidatedRanges | null = null;
  private flushed = false;

  constructor(readonly mangaId: number) {}

  noteFetchFailure(provider: string, reason: string): void {
    this.guard('fetch failure', () => { this.failures.set(provider, reason); });
  }

  noteGated(provider: 'fandom' | 'wikipedia', reason: string, preGate: PreGateSnapshot): void {
    this.guard('gate', () => {
      this.gated.set(provider, reason);
      if (preGate.fandom) this.preGate.fandom = preGate.fandom;
      if (preGate.wikipedia) this.preGate.wikipedia = preGate.wikipedia;
    });
  }

  noteFetchPhase(snapshot: FetchPhaseSnapshot): void {
    this.guard('fetch phase', () => {
      this.verdicts = resolveFetchVerdicts(snapshot, { failures: this.failures, gated: this.gated, preGate: this.preGate });
      this.unvoted = buildUnvotedFragments(snapshot, this.preGate);
    });
  }

  noteSelection(claims: readonly ProviderClaim[], shadow: ShadowSelection): void {
    this.guard('selection', () => { this.selected = buildSelectorFragments(claims, shadow); });
  }

  noteStage(provider: string, stage: string, counts: { requested: number; fetched: number }): void {
    this.guard('stage', () => { this.stages.push({ provider, stage, requested: counts.requested, fetched: counts.fetched }); });
  }

  noteManifests(proposals: readonly ManifestProposal[]): void {
    // Summarised now: cross-validation runs next and must not be able to change what is recorded.
    this.guard('manifests', () => { this.manifests = summariseManifests(proposals); });
  }

  noteValidatedRanges(ranges: ValidatedRanges): void {
    this.guard('validated ranges', () => {
      this.validated = ranges.map(r => ({ volumeNumber: r.volumeNumber, sources: [...r.sources] }));
    });
  }

  /** Every row this run has to write. Never throws; an empty list on failure. */
  buildRows(): ClaimRow[] {
    try {
      const byProvider = new Map(this.verdicts.map(v => [v.provider, v]));
      return [
        ...this.verdicts.map((v): ClaimRow => this.fetchRow(v.provider, FETCH_FIELD, v.outcome, v.recordId, v.detail)),
        ...this.stages.map(s => this.stageRow(s, byProvider)),
        ...this.scalarFragments().map(f => this.scalarRow(f, byProvider)),
        ...this.manifestRows(byProvider),
      ];
    } catch (err: unknown) {
      log.warn(`Claim rows could not be built for manga ${this.mangaId}: ${errorText(err)}`);
      return [];
    }
  }

  /** Write the run's rows once. Never throws. */
  async flush(): Promise<void> {
    if (this.flushed) return;
    this.flushed = true;
    try {
      const rows = this.buildRows();
      const written = await writeClaimRun({ mangaId: this.mangaId, runId: this.runId, startedAt: this.startedAt, rows });
      log.info(`Recorded ${written} provider-claim rows for manga ${this.mangaId} (run ${this.runId})`);
    } catch (err: unknown) {
      log.warn(`Provider claims not recorded for manga ${this.mangaId}: ${errorText(err)}`);
    }
  }

  private guard(what: string, note: () => void): void {
    try {
      note();
    } catch (err: unknown) {
      log.warn(`Claim note skipped (${what}) for manga ${this.mangaId}: ${errorText(err)}`);
    }
  }

  private fetchRow(provider: string, field: string, outcome: ClaimFetchOutcome, recordId: string | null, detail: ClaimJson): ClaimRow {
    return {
      provider, kind: 'fetch', field, providerRecordId: recordId, value: null, fetchOutcome: outcome,
      selectorOutcome: null, inWinningGroup: null, matchConfidence: null, fieldConfidence: null, detail,
    };
  }

  private stageRow(stage: StageNote, byProvider: ReadonlyMap<string, FetchVerdict>): ClaimRow {
    // Pages were asked for and none came back: that stage failed, whatever the list fetch did.
    const outcome: ClaimFetchOutcome = stage.requested > 0 && stage.fetched === 0 ? 'failed' : 'ok';
    return this.fetchRow(
      stage.provider, `${FETCH_FIELD}.${stage.stage}`, outcome,
      byProvider.get(stage.provider)?.recordId ?? null,
      { requested: stage.requested, fetched: stage.fetched },
    );
  }

  /** Selector-voted values first; an unvoted value never replaces one. */
  private scalarFragments(): ScalarFragment[] {
    const taken = new Set(this.selected.map(f => `${f.provider}|${f.field}`));
    return [...this.selected, ...this.unvoted.filter(f => !taken.has(`${f.provider}|${f.field}`))];
  }

  private scalarRow(fragment: ScalarFragment, byProvider: ReadonlyMap<string, FetchVerdict>): ClaimRow {
    const verdict = byProvider.get(fragment.provider);
    return {
      provider: fragment.provider, kind: 'scalar', field: fragment.field,
      providerRecordId: verdict?.recordId ?? null, value: fragment.value,
      // A provider that made a claim answered, even if the phase never reported on it.
      fetchOutcome: verdict?.outcome ?? 'ok',
      selectorOutcome: fragment.selectorOutcome, inWinningGroup: fragment.inWinningGroup,
      matchConfidence: fragment.matchConfidence, fieldConfidence: fragment.fieldConfidence, detail: null,
    };
  }

  private manifestRows(byProvider: ReadonlyMap<string, FetchVerdict>): ClaimRow[] {
    const preGate = summarisePreGateManifests(this.preGate);
    const rows: ClaimRow[] = [];
    for (const source of new Set([...this.manifests.keys(), ...preGate.keys()])) {
      const gateReason = this.gated.get(source);
      // A gated wiki's ranges never reach cross-validation; record what it had.
      const summary = gateReason !== undefined ? preGate.get(source) : this.manifests.get(source);
      if (!summary) continue;
      const verdict = byProvider.get(source);
      rows.push({
        provider: source, kind: 'manifest', field: MANIFEST_FIELD,
        providerRecordId: verdict?.recordId ?? null, value: manifestValue(summary),
        fetchOutcome: verdict?.outcome ?? 'ok',
        selectorOutcome: null, inWinningGroup: null, matchConfidence: null, fieldConfidence: null,
        detail: this.manifestDetail(source, gateReason),
      });
    }
    return rows;
  }

  private manifestDetail(source: string, gateReason: string | undefined): ClaimJson {
    if (gateReason !== undefined) return { enteredCrossValidation: false, gateReason };
    if (this.validated === null) return { enteredCrossValidation: true };
    return {
      enteredCrossValidation: true,
      validatedVolumes: this.validated.length,
      backedVolumes: countBackedVolumes(this.validated, source),
    };
  }
}

/**
 * Run `body` with a claims recorder on its options, and write what the
 * recorder noted when `body` settles — resolved or rejected. The write cannot
 * change `body`'s result or error.
 */
export async function withClaimRun<T>(
  mangaId: number,
  options: EnrichmentPipelineOptions | undefined,
  body: (options: EnrichmentPipelineOptions) => Promise<T>,
): Promise<T> {
  const claimRun = new ClaimRun(mangaId);
  try {
    return await body({ ...options, claimRun });
  } finally {
    await claimRun.flush();
  }
}
