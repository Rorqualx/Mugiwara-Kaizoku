/**
 * @jest-environment node
 *
 * Anchor gate: when AniList timed out or failed, `runEnrichmentPipeline`
 * stops after the provider fetch — no Volume/Chapter phase, no finalize, no
 * post-enrichment hook — and reports the run skipped. A title AniList simply
 * does not have (no match) still runs every phase.
 */
import { writeClaimRun } from '@/server/services/metadata/provider-claims/claim-store';

import { phaseDbPersistence } from '../phase-db-persistence';
import { phaseFinalize } from '../phase-finalize';
import { phaseProviderFetch } from '../phase-provider-fetch';
import { pruneFinishedSeriesPhantoms } from '../phase-volume-phantom-prune';
import { reconcileMissingVolumeRecords } from '../phase-volume-reconciliation';
import { runEnrichmentPipeline } from '../pipeline-orchestrator';
import { anchorUnanswered } from '../pipeline-orchestrator/anchor-gate';
import { persistValidatedVolumeRanges } from '../pipeline-orchestrator/volume-persistence';
import { maybePlausibilityCheck, maybeSyncSuwayomiChapters, maybeTriggerAutoDownload } from '../post-enrichment-hooks';
import { snapshotVolumes } from '../volume-snapshot';

import type { ProviderOutcomes } from '../phase-provider-fetch/provider-outcome';
import type { UnifiedProviderResults } from '../types';

jest.mock('@/server/db', () => ({
  prisma: {
    manga: { findUnique: jest.fn(() => Promise.resolve(null)) },
    $queryRaw: jest.fn(() => Promise.resolve([{ n: 0n }])),
  },
}));
jest.mock('@/server/services/metadata/provider-claims/claim-store', () => ({ writeClaimRun: jest.fn() }));
jest.mock('@/server/services/completeness/manga-completeness', () => ({}));
jest.mock('../phase-provider-fetch', () => ({ phaseProviderFetch: jest.fn() }));
jest.mock('../corroborated-final-chapter', () => ({
  collectFinalChapterWitnesses: jest.fn(() => []),
  corroborateFinalChapter: jest.fn(() => null),
  countExtrasAfterFinal: jest.fn(() => 0),
}));
jest.mock('../phase-volume-cross-validation/volume-gate-ceiling', () => ({
  applyCorroboratedFinalChapter: jest.fn(() => null),
  resolveVolumeGateCeiling: jest.fn(),
}));
jest.mock('../phase-volume-cross-validation/chapter-consensus-resolver', () => ({
  resolveExpectedChapterCount: jest.fn(() => ({ count: null, confidence: 'unknown', sources: [] })),
}));
jest.mock('../phase-bonus-reassignment', () => ({}));
jest.mock('../phase-chapter-reconciliation', () => ({}));
jest.mock('../phase-data-assembly', () => ({}));
jest.mock('../phase-db-persistence', () => ({ phaseDbPersistence: jest.fn() }));
jest.mock('../phase-fandom-enrichment', () => ({}));
jest.mock('../phase-finalize', () => ({ phaseFinalize: jest.fn() }));
jest.mock('../phase-volume-overflow', () => ({}));
jest.mock('../phase-volume-phantom-prune', () => ({ pruneFinishedSeriesPhantoms: jest.fn() }));
jest.mock('../phase-volume-reconciliation', () => ({ reconcileMissingVolumeRecords: jest.fn() }));
jest.mock('../phase-volume-stub-cleanup', () => ({}));
jest.mock('../pipeline-orchestrator/fandom-volume-fields', () => ({}));
jest.mock('../pipeline-orchestrator/volume-persistence', () => ({ persistValidatedVolumeRanges: jest.fn() }));
jest.mock('../post-enrichment-hooks', () => ({
  maybePlausibilityCheck: jest.fn(), maybeSyncSuwayomiChapters: jest.fn(), maybeTriggerAutoDownload: jest.fn(),
}));
jest.mock('../volume-snapshot', () => ({ snapshotVolumes: jest.fn(() => Promise.resolve([])) }));

const REACHED_VOLUME_PHASES = 'reached the chapter/volume persistence phase';

function fetchResult(anilist: ProviderOutcomes[string]): UnifiedProviderResults {
  return {
    enrichmentResult: { status: 'enriched' },
    providerStatus: { anilist, mangadex: 'ok', mangaupdates: 'ok', comicvine: 'ok', fandom: 'ok', wikipedia: 'ok', kitsu: 'ok', mal: 'no_match' },
  } as unknown as UnifiedProviderResults;
}

/** Every write the run could make after the fetch. */
const writers = [
  snapshotVolumes, phaseDbPersistence, persistValidatedVolumeRanges, reconcileMissingVolumeRecords,
  pruneFinishedSeriesPhantoms, phaseFinalize, maybeSyncSuwayomiChapters, maybeTriggerAutoDownload, maybePlausibilityCheck,
];

beforeEach(() => {
  jest.mocked(writeClaimRun).mockImplementation(batch => Promise.resolve({ written: batch.rows.length, retention: Promise.resolve(0) }));
  // The first write of a run that goes on ends it, so the test can see it got there.
  jest.mocked(phaseDbPersistence).mockRejectedValue(new Error(REACHED_VOLUME_PHASES));
});

describe('runEnrichmentPipeline — AniList did not answer', () => {
  it.each(['timeout', 'error'] as const)('runs no volume, chapter, finalize or hook phase when AniList had a %s, and reports the run skipped', async (outcome) => {
    jest.mocked(phaseProviderFetch).mockResolvedValue(fetchResult(outcome));

    const run = await runEnrichmentPipeline(87, 'Steel Ball Run', undefined, { forceRefresh: true });

    expect(run.skipped).toEqual({ reason: 'anchor-unanswered', provider: 'anilist', outcome });
    expect(run.manga).toBeNull();
    for (const writer of writers) expect(jest.mocked(writer)).not.toHaveBeenCalled();
    // The run's claims are still recorded.
    expect(jest.mocked(writeClaimRun)).toHaveBeenCalledTimes(1);
  });

  it('still runs the volume and chapter phases for a title AniList has no match for', async () => {
    jest.mocked(phaseProviderFetch).mockResolvedValue(fetchResult('no_match'));

    await expect(runEnrichmentPipeline(1234, 'A Western Comic')).rejects.toThrow(REACHED_VOLUME_PHASES);
    expect(jest.mocked(snapshotVolumes)).toHaveBeenCalledWith(1234);
    expect(jest.mocked(phaseDbPersistence)).toHaveBeenCalledTimes(1);
  });

  it('still runs the volume and chapter phases when AniList is switched off', async () => {
    jest.mocked(phaseProviderFetch).mockResolvedValue(fetchResult('disabled'));
    await expect(runEnrichmentPipeline(1234, 'A Western Comic')).rejects.toThrow(REACHED_VOLUME_PHASES);
  });
});

describe('anchorUnanswered', () => {
  it('stops a run only on an AniList timeout or error', () => {
    expect(anchorUnanswered({ anilist: 'timeout' })?.outcome).toBe('timeout');
    expect(anchorUnanswered({ anilist: 'error' })?.outcome).toBe('error');
    expect(anchorUnanswered({ anilist: 'ok' })).toBeNull();
    expect(anchorUnanswered({ anilist: 'no_match' })).toBeNull();
    expect(anchorUnanswered({ anilist: 'disabled' })).toBeNull();
    expect(anchorUnanswered(undefined)).toBeNull();
  });

  it('does not stop a run when only MAL (reached through AniList) did not answer', () => {
    expect(anchorUnanswered({ anilist: 'ok', mal: 'timeout' })).toBeNull();
  });
});
