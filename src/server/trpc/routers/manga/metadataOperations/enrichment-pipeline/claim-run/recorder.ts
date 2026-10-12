/**
 * Claims recorder — the interface the pipeline phases see, and the slices of
 * their data they hand it.
 *
 * One recorder is created per pipeline run and travels on the pipeline
 * options object (`EnrichmentPipelineOptions.claimRun`); there is no
 * process-wide state. Every method is synchronous, only takes notes, and
 * never throws — the one database write happens when the run ends.
 *
 * Kept free of imports from `../types` so that file can name this interface.
 */

import type { ProviderClaim } from '@/server/services/metadata/selectors/collect-candidates';
import type { ShadowSelection } from '@/server/services/metadata/selectors/shadow-mode';

import type { FandomVolumeLike, WikipediaVolumeLike } from '../pipeline-orchestrator/volume-inputs';

/** A provider's volume → chapter range as it enters cross-validation. */
export interface ManifestProposal {
  volumeNumber: number;
  chapterStart: number;
  chapterEnd: number;
  source: string;
  extractionMethod: string;
}

export interface FandomSnapshot {
  url: string;
  chapterList: ReadonlyArray<{ number: number }>;
  volumeList: readonly FandomVolumeLike[];
  parseSuccess: boolean;
}

export interface WikipediaSnapshot {
  data: {
    title: string;
    wikipediaUrl?: string;
    volumeListUrl?: string;
    chapters?: number;
    volumes?: number;
    volumeList?: readonly WikipediaVolumeLike[];
  };
  chapterList: ReadonlyArray<{ number: number }>;
  ownChapterCount?: number;
}

interface PinState {
  pin: { kind: string };
}

/** What the provider-fetch phase knows when it finishes. */
export interface FetchPhaseSnapshot {
  /** The phase's own per-provider outcome (`ok` / `no_match` / `timeout` / `error` / `disabled`). */
  providerStatus: Readonly<Record<string, string>>;
  directives: {
    mangadex: PinState;
    mangaupdates: PinState;
    kitsu: PinState;
    comicvine: PinState;
    malUnbound: boolean;
  };
  anilist: { id: number; details: { idMal?: number | null } } | null;
  mangadex: {
    mangaId: string;
    lastChapter: string | undefined;
    lastVolume: string | undefined;
    malId: number | undefined;
    chapterList: ReadonlyArray<{ number: number }>;
    aggregate: { volumes: readonly unknown[] } | null;
  } | null;
  comicvine: { volumeId: number; issues: readonly unknown[] } | null;
  mangaupdates: { seriesId: number } | null;
  kitsu: { kitsuId: string } | null;
  mal: { malId: number } | null;
  /** As returned by the phase — emptied when the cross-series gate fired. */
  fandom: FandomSnapshot | null;
  wikipedia: WikipediaSnapshot | null;
}

/** A wiki result as it was BEFORE the cross-series gate emptied it. */
export interface PreGateSnapshot {
  fandom?: FandomSnapshot;
  wikipedia?: WikipediaSnapshot;
}

export interface ClaimRecorder {
  readonly runId: string;
  /** A fetch that failed inside a client that reports failure as "nothing found". */
  noteFetchFailure(provider: string, reason: string): void;
  /** A gate is about to discard this provider's data; `preGate` is the data it discards. */
  noteGated(provider: 'fandom' | 'wikipedia', reason: string, preGate: PreGateSnapshot): void;
  noteFetchPhase(snapshot: FetchPhaseSnapshot): void;
  /** The claims the selector was given and what it decided. */
  noteSelection(claims: readonly ProviderClaim[], shadow: ShadowSelection): void;
  /** A follow-up fetch for a provider (e.g. Fandom's per-chapter pages). */
  noteStage(provider: string, stage: string, counts: { requested: number; fetched: number }): void;
  /** Every source's ranges as they enter cross-validation, before any of its drops. */
  noteManifests(proposals: readonly ManifestProposal[]): void;
  /** What cross-validation kept, and which sources back each kept volume. */
  noteValidatedRanges(ranges: ReadonlyArray<{ volumeNumber: number; sources: readonly string[] }>): void;
}
