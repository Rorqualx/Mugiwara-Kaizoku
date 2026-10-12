/**
 * @jest-environment node
 *
 * Call-site wiring: `runEnrichmentPipeline` must run its phases inside
 * `withClaimRun`, so every run gets one recorder and its notes are written
 * when the run ends — also when it fails. Removing the wrapper fails here.
 */
import { writeClaimRun } from '@/server/services/metadata/provider-claims/claim-store';

import { phaseProviderFetch } from '../phase-provider-fetch';
import { runEnrichmentPipeline } from '../pipeline-orchestrator';

import { snapshot } from './claim-test-fixtures';

import type { EnrichmentPipelineOptions } from '../types';

jest.mock('@/server/db', () => ({ prisma: {} }));
jest.mock('@/server/services/metadata/provider-claims/claim-store', () => ({ writeClaimRun: jest.fn() }));
jest.mock('../phase-provider-fetch', () => ({ phaseProviderFetch: jest.fn() }));
// The run stops in the provider-fetch phase, so the later phases are never
// called. They are replaced so their modules (and the long-lived services
// those start) are not loaded.
jest.mock('@/server/services/completeness/manga-completeness', () => ({}));
jest.mock('../phase-bonus-reassignment', () => ({}));
jest.mock('../phase-chapter-reconciliation', () => ({}));
jest.mock('../phase-data-assembly', () => ({}));
jest.mock('../phase-db-persistence', () => ({}));
jest.mock('../phase-fandom-enrichment', () => ({}));
jest.mock('../phase-finalize', () => ({}));
jest.mock('../phase-volume-overflow', () => ({}));
jest.mock('../phase-volume-phantom-prune', () => ({}));
jest.mock('../phase-volume-reconciliation', () => ({}));
jest.mock('../phase-volume-stub-cleanup', () => ({}));
jest.mock('../pipeline-orchestrator/fandom-volume-fields', () => ({}));
jest.mock('../pipeline-orchestrator/volume-persistence', () => ({}));
jest.mock('../post-enrichment-hooks', () => ({}));
jest.mock('../volume-snapshot', () => ({}));

const mockedFetch = jest.mocked(phaseProviderFetch);
const mockedWrite = jest.mocked(writeClaimRun);

/** The options the provider-fetch phase was called with on its n-th call. */
function optionsOfCall(n: number): EnrichmentPipelineOptions | undefined {
  return mockedFetch.mock.calls[n]?.[3];
}

beforeEach(() => {
  mockedFetch.mockReset();
  mockedWrite.mockReset();
  mockedWrite.mockImplementation(batch => Promise.resolve({ written: batch.rows.length, retention: Promise.resolve(0) }));
  // The phase notes its outcomes, then the run dies: enough to prove the wiring.
  mockedFetch.mockImplementation((_mangaId, _title, _onProgress, options) => {
    options?.claimRun?.noteFetchPhase(snapshot());
    return Promise.reject(new Error('stop after provider fetch'));
  });
});

describe('runEnrichmentPipeline — one claims recorder per run', () => {
  it('hands the provider-fetch phase a recorder and keeps the caller\'s options', async () => {
    await expect(runEnrichmentPipeline(990_073, 'Bleach', undefined, { forceRefresh: true })).rejects.toThrow('stop after provider fetch');

    expect(optionsOfCall(0)?.forceRefresh).toBe(true);
    expect(typeof optionsOfCall(0)?.claimRun?.runId).toBe('string');
  });

  it('writes what the run noted, under that run\'s id, even though the run failed', async () => {
    await expect(runEnrichmentPipeline(990_073, 'Bleach')).rejects.toThrow('stop after provider fetch');

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const batch = mockedWrite.mock.calls[0]?.[0];
    expect(batch?.mangaId).toBe(990_073);
    expect(batch?.runId).toBe(optionsOfCall(0)?.claimRun?.runId);
    expect(batch?.rows.filter(r => r.kind === 'fetch' && r.field === '_fetch')).toHaveLength(8);
  });

  it('gives a second run of the same title a different run id', async () => {
    await expect(runEnrichmentPipeline(990_073, 'Bleach')).rejects.toThrow();
    await expect(runEnrichmentPipeline(990_073, 'Bleach')).rejects.toThrow();

    expect(optionsOfCall(0)?.claimRun?.runId).not.toBe(optionsOfCall(1)?.claimRun?.runId);
    expect(mockedWrite).toHaveBeenCalledTimes(2);
  });
});
