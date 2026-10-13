/**
 * @jest-environment node
 */
import { beforeEach, describe, it, expect, jest } from '@jest/globals';

import { prisma } from '@/server/db';
import { assignSpecialChapters } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/special-chapter-placement';

jest.mock('@/server/db', () => ({
  prisma: {
    volume: { findFirst: jest.fn(), findMany: jest.fn() },
    chapter: { update: jest.fn(), updateMany: jest.fn() },
  },
}));

const VOL0 = { id: 10008, number: 0, chapterStart: null, chapterEnd: null };

describe('assignSpecialChapters — chapter 0 and a real Vol 0', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(prisma.volume.findFirst).mockResolvedValue(VOL0 as never);
    jest.mocked(prisma.volume.findMany).mockResolvedValue([] as never);
  });

  it('leaves chapter 0 in the real Vol 0 instead of clearing it as an orphan (One Piece "Strong World": the cleared row stranded Vol 0\'s volume-file row, re-created on every refresh)', async () => {
    await assignSpecialChapters(81, [{ id: 40436, chapterNumber: 0, volume: 0, volumeId: 10008, filePath: null }]);
    expect(prisma.chapter.updateMany).not.toHaveBeenCalled();
    expect(prisma.chapter.update).not.toHaveBeenCalled();
  });

  it('still places an unplaced chapter 0 into the real Vol 0', async () => {
    await assignSpecialChapters(81, [{ id: 40436, chapterNumber: 0, volume: 0, volumeId: null, filePath: null }]);
    expect(prisma.chapter.update).toHaveBeenCalledWith({ where: { id: 40436 }, data: { volume: 0, volumeId: 10008 } });
  });

  it('still clears chapter 0 from another volume when there is no Vol 0', async () => {
    jest.mocked(prisma.volume.findFirst).mockResolvedValue(null as never);
    await assignSpecialChapters(81, [{ id: 40436, chapterNumber: 0, volume: 118, volumeId: 10052, filePath: null }]);
    expect(prisma.chapter.updateMany).toHaveBeenCalledWith({ where: { id: { in: [40436] } }, data: { volume: null, volumeId: null } });
  });
});
