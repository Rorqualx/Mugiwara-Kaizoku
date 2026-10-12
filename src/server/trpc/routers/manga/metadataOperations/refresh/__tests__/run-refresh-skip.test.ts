/**
 * @jest-environment node
 *
 * A refresh whose pipeline run was skipped (AniList did not answer) must not
 * run the phantom sweep, and must end as an error rather than a result.
 */
import { runEnrichmentPipeline } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline';
import { removePhantomArtifacts } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-phantom-prune';
import { MetadataRefreshSkippedError } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator/anchor-gate';

import { runMetadataRefresh } from '../run-refresh';

type Db = Parameters<typeof runMetadataRefresh>[0];

jest.mock('@/server/services/realtime/RealtimeEventEmitter', () => ({
  realtimeEmitter: { emitMetadataRefreshProgress: jest.fn(() => Promise.resolve()) },
}));
jest.mock('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline', () => ({ runEnrichmentPipeline: jest.fn() }));
jest.mock('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch', () => ({ extractBoundAniListId: jest.fn(() => '1') }));
jest.mock('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-phantom-prune', () => ({
  removePhantomArtifacts: jest.fn(() => Promise.resolve({ outOfRangeVolumes: 0, chapters: 0, emptyVolumes: 0 })),
}));
jest.mock('../clear-auto-bindings', () => ({ clearAutoBindingsForReidentify: jest.fn() }));

const TITLE = { id: 87, title: 'Steel Ball Run', providerMetadata: {} };

describe('runMetadataRefresh — skipped pipeline run', () => {
  it('throws MetadataRefreshSkippedError and skips the phantom sweep when AniList did not answer', async () => {
    jest.mocked(runEnrichmentPipeline).mockResolvedValue({
      result: null, manga: null, skipped: { reason: 'anchor-unanswered', provider: 'anilist', outcome: 'timeout' },
    });

    const refresh = runMetadataRefresh({} as Db, TITLE, false);
    await expect(refresh).rejects.toBeInstanceOf(MetadataRefreshSkippedError);
    await expect(refresh).rejects.toThrow('anilist timed out');
    expect(jest.mocked(removePhantomArtifacts)).not.toHaveBeenCalled();
  });

  it('runs the phantom sweep after a run that was not skipped', async () => {
    jest.mocked(runEnrichmentPipeline).mockResolvedValue({ result: null, manga: null });
    await expect(runMetadataRefresh({} as Db, TITLE, false)).resolves.toEqual({ manga: null, removedPhantoms: 0 });
    expect(jest.mocked(removePhantomArtifacts)).toHaveBeenCalledWith(87);
  });
});
