/**
 * @jest-environment node
 *
 * ImageCacheCleanupService tests — mock prisma so we exercise the orphan-only
 * eviction logic without touching the DB. The guarantee under test: cover/banner
 * art still referenced by live Metadata is kept permanently (never re-downloaded),
 * regardless of lastAccessed age; only unreferenced (orphaned) art is deleted.
 */

const metadataFindManyMock = jest.fn();
const imageCacheFindManyMock = jest.fn();
const imageCacheDeleteManyMock = jest.fn();
const imageCacheCountMock = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    metadata: {
      findMany: (...args: unknown[]) => metadataFindManyMock(...args),
    },
    imageCache: {
      findMany: (...args: unknown[]) => imageCacheFindManyMock(...args),
      deleteMany: (...args: unknown[]) => imageCacheDeleteManyMock(...args),
      count: (...args: unknown[]) => imageCacheCountMock(...args),
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { ImageCacheCleanupService } from '@/server/services/image-cache/ImageCacheCleanupService';

/** deleteMany returns a count matching the number of ids targeted */
function deleteManyByIdCount(args: unknown): { count: number } {
  const where = (args as { where?: { id?: { in?: number[] } } }).where;
  return { count: where?.id?.in?.length ?? 0 };
}

beforeEach(() => {
  metadataFindManyMock.mockReset();
  imageCacheFindManyMock.mockReset();
  imageCacheDeleteManyMock.mockReset().mockImplementation((args: unknown) => deleteManyByIdCount(args));
  imageCacheCountMock.mockReset().mockResolvedValue(0);
});

describe('ImageCacheCleanupService.runCleanup (orphan-only eviction)', () => {
  it('keeps referenced art (even when stale) and deletes only orphans', async () => {
    // Live metadata references three external URLs across cover fields + banner.
    metadataFindManyMock.mockResolvedValue([
      {
        cover: 'https://s4.anilist.co/cover-A.jpg',
        coverLarge: 'https://s4.anilist.co/cover-A-large.jpg',
        coverExtraLarge: null,
        coverMedium: null,
        bannerImage: 'https://s4.anilist.co/banner-A.jpg',
        galleryImages: [],
      },
    ]);

    // Cache holds the three referenced images plus two orphans.
    imageCacheFindManyMock.mockResolvedValue([
      { id: 1, originalUrl: 'https://s4.anilist.co/cover-A.jpg' },
      { id: 2, originalUrl: 'https://s4.anilist.co/cover-A-large.jpg' },
      { id: 3, originalUrl: 'https://s4.anilist.co/banner-A.jpg' },
      { id: 4, originalUrl: 'https://uploads.mangadex.org/orphan-1.jpg' },
      { id: 5, originalUrl: 'https://s4.anilist.co/deleted-manga-cover.jpg' },
    ]);
    imageCacheCountMock.mockResolvedValue(3); // 3 remain after orphan removal

    const service = new ImageCacheCleanupService();
    const result = await service.runCleanup();

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.data.orphansDeleted).toBe(2);
    expect(result.data.cappedDeleted).toBe(0);
    expect(result.data.remainingEntries).toBe(3);

    // Only the two orphan ids were deleted; referenced ids 1/2/3 survive.
    expect(imageCacheDeleteManyMock).toHaveBeenCalledTimes(1);
    expect(imageCacheDeleteManyMock).toHaveBeenCalledWith({ where: { id: { in: [4, 5] } } });
  });

  it('deletes nothing when every cached image is referenced', async () => {
    metadataFindManyMock.mockResolvedValue([
      {
        cover: 'https://s4.anilist.co/cover-A.jpg',
        coverLarge: null,
        coverExtraLarge: null,
        coverMedium: null,
        bannerImage: null,
        galleryImages: ['https://uploads.mangadex.org/gallery-1.jpg'],
      },
    ]);
    imageCacheFindManyMock.mockResolvedValue([
      { id: 1, originalUrl: 'https://s4.anilist.co/cover-A.jpg' },
      { id: 2, originalUrl: 'https://uploads.mangadex.org/gallery-1.jpg' },
    ]);
    imageCacheCountMock.mockResolvedValue(2);

    const service = new ImageCacheCleanupService();
    const result = await service.runCleanup();

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.data.orphansDeleted).toBe(0);
    expect(imageCacheDeleteManyMock).not.toHaveBeenCalled();
  });

  it('does not enforce a cap by default (live covers are never re-downloaded)', async () => {
    // No live references at all, but cap is disabled -> only orphan phase runs.
    metadataFindManyMock.mockResolvedValue([]);
    imageCacheFindManyMock.mockResolvedValue([
      { id: 1, originalUrl: 'https://s4.anilist.co/cover-A.jpg' },
    ]);
    imageCacheCountMock.mockResolvedValue(0);

    const service = new ImageCacheCleanupService(); // maxEntries defaults to 0
    const result = await service.runCleanup();

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.data.cappedDeleted).toBe(0);
    // The lone row is an orphan here (no metadata), so it is removed by phase 1.
    expect(result.data.orphansDeleted).toBe(1);
  });

  it('deletes orphan ids in chunks to respect bind-parameter limits', async () => {
    metadataFindManyMock.mockResolvedValue([]); // everything is an orphan
    const rows = Array.from({ length: 2500 }, (_, i) => ({
      id: i + 1,
      originalUrl: `https://s4.anilist.co/orphan-${i}.jpg`,
    }));
    imageCacheFindManyMock.mockResolvedValue(rows);
    imageCacheCountMock.mockResolvedValue(0);

    const service = new ImageCacheCleanupService();
    const result = await service.runCleanup();

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.data.orphansDeleted).toBe(2500);
    // 2500 ids / 1000 per chunk = 3 deleteMany calls.
    expect(imageCacheDeleteManyMock).toHaveBeenCalledTimes(3);
  });
});
