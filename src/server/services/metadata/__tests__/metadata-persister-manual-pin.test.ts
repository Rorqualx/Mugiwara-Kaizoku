/**
 * Phase 4 v2-E — manual-pin guard tests for MetadataPersistenceService.
 *
 * Asserts the core contract: a field whose existing provenance carries
 * `manual: true` is NOT overwritten by an incoming enrichment write, AND
 * the manual flag survives the merge so the pin holds across re-enrichment.
 */

import { prisma } from '@/server/db';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { isObject } from '@/utils/type-guards';

import { MetadataPersistenceService } from '../metadata-persister';

import {
  createMockManga,
  createMockTransactionClient,
  type MockTransactionClient,
} from './test-utils';

jest.mock('@/server/db', () => ({
  prisma: {
    $transaction: jest.fn(),
    manga: { findUnique: jest.fn(), update: jest.fn() },
    metadata: { create: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('../../../../utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
    })),
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
  },
}));

interface Captured {
  metadataUpdateData: Record<string, unknown> | null;
  providerMetadata: Record<string, unknown> | null;
}

function runPersist(
  service: MetadataPersistenceService,
  pinnedProvenance: Record<string, unknown>,
  incoming: UnifiedMangaMetadata,
  incomingProvenance: Record<string, string>,
): Promise<Captured> {
  const mockManga = createMockManga({
    metadataId: 100,
    providerMetadata: { metadataProvenance: pinnedProvenance } as Parameters<typeof createMockManga>[0] extends { providerMetadata?: infer T } | undefined ? T : never,
  });

  const captured: Captured = { metadataUpdateData: null, providerMetadata: null };
  const mockTx = createMockTransactionClient();
  mockTx.manga.findUnique.mockResolvedValue({
    ...mockManga,
    Metadata: {
      id: 100,
      cover: 'pinned.jpg',
      coverLarge: 'pinned.jpg',
      coverMedium: 'pinned.jpg',
      coverExtraLarge: 'pinned.jpg',
      bannerImage: null,
    },
  });
  mockTx.metadata.update.mockImplementation((params: unknown) => {
    if (isObject(params) && 'data' in params) {
      captured.metadataUpdateData = params['data'] as Record<string, unknown>;
    }
    return Promise.resolve({ id: 100 });
  });
  mockTx.manga.update.mockImplementation((params: unknown) => {
    if (isObject(params) && 'data' in params) {
      const data = params['data'];
      if (isObject(data) && 'providerMetadata' in data) {
        captured.providerMetadata = data['providerMetadata'] as Record<string, unknown>;
      }
    }
    return Promise.resolve({ ...mockManga, Metadata: {} });
  });

  (prisma.$transaction as jest.Mock).mockImplementation(
    async <T>(cb: (tx: MockTransactionClient) => Promise<T>): Promise<T> => cb(mockTx),
  );

  return service.persistMetadata({
    mangaId: 1,
    metadata: incoming,
    metadataProvenance: incomingProvenance,
  }).then(() => captured);
}

describe('MetadataPersistenceService — Phase 4 v2-E manual pin', () => {
  let service: MetadataPersistenceService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetadataPersistenceService();
  });

  it('refuses to overwrite a manually-pinned cover during re-enrichment', async () => {
    const captured = await runPersist(
      service,
      { cover: { provider: 'manual', manual: true } },
      { cover: 'fresh-from-anilist.jpg' } as UnifiedMangaMetadata,
      { cover: 'anilist' },
    );
    expect(captured.metadataUpdateData).not.toBeNull();
    // The pinned cover write must be refused — none of the resolution columns
    // get the incoming value (coupled cover treatment).
    expect(captured.metadataUpdateData?.['cover']).toBeUndefined();
    expect(captured.metadataUpdateData?.['coverLarge']).toBeUndefined();
    expect(captured.metadataUpdateData?.['coverMedium']).toBeUndefined();
    expect(captured.metadataUpdateData?.['coverExtraLarge']).toBeUndefined();
  });

  it('preserves the manual flag in the merged provenance write', async () => {
    const captured = await runPersist(
      service,
      { cover: { provider: 'manual', manual: true } },
      { cover: 'ignored.jpg' } as UnifiedMangaMetadata,
      { cover: 'anilist' },
    );
    expect(captured.providerMetadata).not.toBeNull();
    const prov = captured.providerMetadata?.['metadataProvenance'] as Record<string, unknown>;
    expect(prov).toBeDefined();
    expect(prov['cover']).toEqual({ provider: 'manual', manual: true });
  });
});
