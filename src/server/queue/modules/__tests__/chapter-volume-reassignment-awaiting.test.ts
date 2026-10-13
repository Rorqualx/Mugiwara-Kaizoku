/**
 * @jest-environment node
 *
 * The daily chapter→volume sweep no longer invents a "Vol N+1 (placeholder)"
 * with a made-up range for a running series' newest chapters (One Piece
 * "Vol 116 (placeholder)" 1180-1195): it tags them awaiting their volume
 * (volume = -1), and its "Misc" step never folds those chapters into a volume.
 */
const queryRaw = jest.fn();
const executeRaw = jest.fn().mockResolvedValue(0);
const chapterFindMany = jest.fn();
const chapterUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
const volumeFindMany = jest.fn();
const volumeCreate = jest.fn().mockResolvedValue({ id: 5000, number: 116 });

jest.mock('@/server/db', () => ({
  prisma: {
    $queryRaw: (...a: unknown[]): unknown => queryRaw(...a),
    $executeRaw: (...a: unknown[]): unknown => executeRaw(...a),
    chapter: {
      findMany: (...a: unknown[]): unknown => chapterFindMany(...a),
      updateMany: (...a: unknown[]): unknown => chapterUpdateMany(...a),
    },
    volume: {
      findMany: (...a: unknown[]): unknown => volumeFindMany(...a),
      create: (...a: unknown[]): unknown => volumeCreate(...a),
      aggregate: jest.fn().mockResolvedValue({ _max: { number: 115 } }),
    },
  },
}));
jest.mock(
  '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/db-volume-cap',
  () => ({ getVolumeCapForManga: jest.fn().mockResolvedValue({ cap: 127, source: 'metadata' }) }),
);

import { reassignOrphanedChapters } from '../chapter-volume-reassignment';

const ONE_PIECE_TRAILING = { mangaId: 81, lastVolNum: 115, lastChEnd: 1179, maxCh: 1195 };

/** $queryRaw is called for step 2, 3, 4 in order. */
function queueSweep(step2: unknown[]): void {
  queryRaw.mockResolvedValueOnce(step2).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  volumeFindMany.mockResolvedValue([
    { number: 114, chapterStart: 1156, chapterEnd: 1166 },
    { number: 115, chapterStart: 1167, chapterEnd: 1179 },
  ]);
});

describe('reassignOrphanedChapters step 2 for chapters past the last volume', () => {
  it('tags a running series\' newest chapters -1 and creates no placeholder volume', async () => {
    queueSweep([{ ...ONE_PIECE_TRAILING, finished: false }]);
    chapterFindMany.mockResolvedValueOnce([
      { id: 1, chapterNumber: 1180, volume: null, volumeId: null, filePath: null },
      { id: 2, chapterNumber: 1195, volume: 116, volumeId: null, filePath: null },
    ]);
    chapterUpdateMany.mockResolvedValueOnce({ count: 2 });

    const report = await reassignOrphanedChapters();

    expect(volumeCreate).not.toHaveBeenCalled();
    expect(chapterUpdateMany).toHaveBeenCalledWith({ where: { id: { in: [1, 2] } }, data: { volume: -1 } });
    expect(report.step2AwaitingTagged).toBe(2);
    expect(report.step2TrailingPlaceholders).toBe(0);
  });

  it('still gives a finished series one placeholder volume within its cap', async () => {
    queueSweep([{ ...ONE_PIECE_TRAILING, finished: true }]);
    chapterUpdateMany.mockResolvedValueOnce({ count: 16 });

    const report = await reassignOrphanedChapters();

    expect(volumeCreate).toHaveBeenCalledTimes(1);
    expect(report.step2TrailingPlaceholders).toBe(1);
  });
});
