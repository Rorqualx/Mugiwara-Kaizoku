import { prisma } from '@/server/db';

import { backfillRecommendationsForNewManga, resolveAniListRecommendations, resolveRecommendations } from '../recommendation-resolver';

jest.mock('@/server/db', () => ({
  prisma: {
    mangaRecommendation: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    manga: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

const mockUpsert = prisma.mangaRecommendation.upsert as jest.MockedFunction<typeof prisma.mangaRecommendation.upsert>;
const mockUpdateMany = prisma.mangaRecommendation.updateMany as jest.MockedFunction<typeof prisma.mangaRecommendation.updateMany>;
const mockQueryRaw = prisma.$queryRaw as jest.MockedFunction<typeof prisma.$queryRaw>;

beforeEach(() => {
  jest.clearAllMocks();
  // Default: target manga doesn't exist in local library.
  mockQueryRaw.mockResolvedValue([] as never);
  // Default upsert mock — same createdAt/updatedAt means "created".
  const now = new Date();
  mockUpsert.mockResolvedValue({ id: 1, createdAt: now, updatedAt: now } as never);
});

describe('resolveAniListRecommendations', () => {
  it('returns zero counts on empty edges', async () => {
    const r = await resolveAniListRecommendations(42, []);
    expect(r).toEqual({ created: 0, updated: 0, skipped: 0 });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('upserts one row per edge with correct composite key', async () => {
    const edges = [
      { anilistId: 111, title: 'Sequel Title', format: 'MANGA', coverUrl: 'https://x/c.jpg', medium: 'MANGA' as const, rating: 50 },
      { anilistId: 222, title: 'Spinoff Title', format: 'MANGA', coverUrl: null, medium: 'MANGA' as const, rating: 12 },
    ];
    const r = await resolveAniListRecommendations(42, edges);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(r.created).toBe(2);
    // Composite key shape.
    expect(mockUpsert.mock.calls[0]?.[0].where).toMatchObject({
      fromMangaId_externalSource_externalToId: {
        fromMangaId: 42,
        externalSource: 'anilist',
        externalToId: '111',
      },
    });
  });

  it('sets toMangaId when the target AL id matches a local manga', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 999 }] as never);
    const edges = [{ anilistId: 111, title: 'Local Manga', format: 'MANGA', coverUrl: null, medium: 'MANGA' as const, rating: null }];
    await resolveAniListRecommendations(42, edges);
    const createPayload = mockUpsert.mock.calls[0]?.[0].create as { toMangaId: number | null };
    expect(createPayload.toMangaId).toBe(999);
  });

  it('leaves toMangaId null when no local manga matches the AL id', async () => {
    mockQueryRaw.mockResolvedValueOnce([] as never);
    const edges = [{ anilistId: 111, title: 'External Manga', format: 'MANGA', coverUrl: null, medium: 'MANGA' as const, rating: null }];
    await resolveAniListRecommendations(42, edges);
    const createPayload = mockUpsert.mock.calls[0]?.[0].create as { toMangaId: number | null };
    expect(createPayload.toMangaId).toBeNull();
  });

  it('truncates extremely long titles to fit the 500-char column', async () => {
    const longTitle = 'A'.repeat(600);
    const edges = [{ anilistId: 111, title: longTitle, format: null, coverUrl: null, medium: null, rating: null }];
    await resolveAniListRecommendations(42, edges);
    const createPayload = mockUpsert.mock.calls[0]?.[0].create as { targetTitle: string };
    expect(createPayload.targetTitle.length).toBe(500);
  });

  it('marks updated when prisma returns different createdAt/updatedAt', async () => {
    const created = new Date('2024-01-01T00:00:00Z');
    const updated = new Date('2025-01-01T00:00:00Z');
    mockUpsert.mockResolvedValueOnce({ id: 1, createdAt: created, updatedAt: updated } as never);
    const r = await resolveAniListRecommendations(42, [
      { anilistId: 111, title: 'X', format: null, coverUrl: null, medium: null, rating: null },
    ]);
    expect(r.updated).toBe(1);
    expect(r.created).toBe(0);
  });

  it('skips edges where prisma upsert throws (non-critical)', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('db unavailable'));
    const r = await resolveAniListRecommendations(42, [
      { anilistId: 111, title: 'X', format: null, coverUrl: null, medium: null, rating: null },
    ]);
    expect(r.skipped).toBe(1);
  });
});

describe('resolveRecommendations (Sprint #2 — multi-source)', () => {
  it('writes externalSource=mal when called with the mal arg', async () => {
    const edges = [{ anilistId: 999, title: 'MAL Rec', format: null, coverUrl: null, medium: 'MANGA' as const, rating: 42 }];
    await resolveRecommendations(50, edges, 'mal');
    const writeCall = mockUpsert.mock.calls[0]?.[0] as unknown as {
      where: { fromMangaId_externalSource_externalToId: { externalSource: string } };
      create: { externalSource: string };
    };
    expect(writeCall.where.fromMangaId_externalSource_externalToId.externalSource).toBe('mal');
    expect(writeCall.create.externalSource).toBe('mal');
  });

  it('queries the mal providerId path when resolving target manga (Sprint #2)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 777 }] as never);
    const edges = [{ anilistId: 999, title: 'Local MAL Rec', format: null, coverUrl: null, medium: 'MANGA' as const, rating: null }];
    await resolveRecommendations(50, edges, 'mal');
    const createPayload = mockUpsert.mock.calls[0]?.[0].create as { toMangaId: number | null };
    expect(createPayload.toMangaId).toBe(777);
  });
});

describe('backfillRecommendationsForNewManga', () => {
  it('updates all rows pointing at the new manga\'s AL id and returns the count', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 5 } as never);
    const n = await backfillRecommendationsForNewManga(99, '12345');
    expect(n).toBe(5);
    expect(mockUpdateMany.mock.calls[0]?.[0].where).toEqual({
      externalSource: 'anilist',
      externalToId: '12345',
      toMangaId: null,
    });
    expect(mockUpdateMany.mock.calls[0]?.[0].data).toEqual({ toMangaId: 99 });
  });

  it('returns 0 when no rows match', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 } as never);
    const n = await backfillRecommendationsForNewManga(99, '12345');
    expect(n).toBe(0);
  });
});
