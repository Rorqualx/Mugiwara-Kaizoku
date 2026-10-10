/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { enrichMangaMetadata } from '@/server/services/library/scanner/enrichment-handler';
import { runEnrichmentPipeline } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator';

jest.mock('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator', () => ({
  runEnrichmentPipeline: jest.fn(),
}));

const mockedPipeline = jest.mocked(runEnrichmentPipeline);

describe('enrichMangaMetadata — returns the pipeline EnrichmentResult', () => {
  // Why this exists: the handler read `.enrichmentResult` off a value that
  // already IS the EnrichmentResult, so it always returned null and scanned
  // items were never marked enriched.
  beforeEach(() => {
    mockedPipeline.mockReset();
  });

  it('returns the result the pipeline produced', async () => {
    const enrichment = {
      status: 'enriched',
      manga: { id: 7, title: 'Berserk' },
      appliedMatch: { id: 'anilist-30002', provider: 'anilist', providerId: '30002' },
    };
    mockedPipeline.mockResolvedValue({ result: enrichment, manga: null });

    await expect(enrichMangaMetadata({ id: 7, title: 'Berserk' })).resolves.toBe(enrichment);
    expect(mockedPipeline).toHaveBeenCalledWith(7, 'Berserk');
  });

  it('returns null when the pipeline produced no result', async () => {
    mockedPipeline.mockResolvedValue({ result: undefined, manga: null });
    await expect(enrichMangaMetadata({ id: 7, title: 'Berserk' })).resolves.toBeNull();
  });

  it('returns null and does not throw when the pipeline fails', async () => {
    mockedPipeline.mockRejectedValue(new Error('provider outage'));
    await expect(enrichMangaMetadata({ id: 7, title: 'Berserk' })).resolves.toBeNull();
  });

  it('skips the pipeline when id or title is missing', async () => {
    await expect(enrichMangaMetadata({ title: 'No id' })).resolves.toBeNull();
    expect(mockedPipeline).not.toHaveBeenCalled();
  });
});
