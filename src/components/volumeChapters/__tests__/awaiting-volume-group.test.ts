/**
 * @jest-environment node
 *
 * The volume browser lists chapters awaiting their volume (Chapter.volume = -1)
 * as their own "Not yet in a volume" group after the last volume — not in the
 * yellow "Unassigned" bucket, which listed them above Volume 1 with only
 * "reassign" and "delete all files" actions.
 */
import { ChapterStatus, type Chapter } from '@prisma/client';

import {
  AWAITING_VOLUME_GROUP, awaitingGroupTitle, missingChapterIds, serverVolumeNumber,
  volumeGroupKey, withAwaitingGroupTitle,
} from '../awaiting-volume-group';
import { processActualChapters, sortVolumeGroups } from '../hooks/useVolumeProcessing';

function chapter(id: number, chapterNumber: number | null, volume: number | null, extra: Partial<Chapter> = {}): Chapter {
  return {
    id, title: `Days ${chapterNumber ?? ''}`, alternativeTitles: [], mangaId: 18, index: chapterNumber ?? 0,
    downloadStatus: ChapterStatus.PENDING, createdAt: new Date(0), updatedAt: new Date(0), fileName: '',
    size: BigInt(0), pageCount: 0, pageCountAttempts: 0, chapterNumber, number: null, pages: null,
    resolutionWidth: null, resolutionHeight: null, resolutionLabel: null, language: null, releaseDate: null,
    downloadUrl: null, coverImage: null, description: null, hash: null, mimeType: null, filePath: null,
    fileFormat: null, isRead: false, monitored: true, volume, volumeId: volume !== null && volume > 0 ? 900 + volume : null,
    packDownloadId: null, mangadexId: null, suwayomiChapterId: null, ...extra,
  } as Chapter;
}

describe('volumeGroupKey', () => {
  it('puts a chapter awaiting its volume (-1) in the "Not yet in a volume" group', () => {
    expect(volumeGroupKey(chapter(1, 256, -1))).toBe(AWAITING_VOLUME_GROUP);
  });

  it('keeps an unknown volume (NULL) in the Unassigned bucket and real volumes in place', () => {
    expect(volumeGroupKey(chapter(1, 3, null))).toBe(-1);
    expect(volumeGroupKey(chapter(2, 250, 28))).toBe(28);
  });

  it('still lets a file name carrying a volume win over the tag', () => {
    expect(volumeGroupKey(chapter(1, 256, -1, { fileName: 'Sakamoto Days v29 c256.cbz' }))).toBe(29);
  });
});

describe('grouping Sakamoto Days for the volume browser', () => {
  const chapters = [
    chapter(10, 255, 28), chapter(11, 256, -1), chapter(12, 278, -1, { downloadStatus: ChapterStatus.COMPLETED }),
    chapter(13, 0, null), chapter(14, 1, 1),
  ];
  const map = new Map<number, Chapter[]>();
  processActualChapters(chapters, map);
  const groups = sortVolumeGroups(Array.from(map.entries()));

  it('orders volumes, then "Not yet in a volume", then Unassigned last (it was listed above Volume 1)', () => {
    expect(groups.map(([key]) => key)).toEqual([1, 28, AWAITING_VOLUME_GROUP, -1]);
  });

  it('titles the group by its chapters and the last volume without inventing a range for the next volume', () => {
    expect(withAwaitingGroupTitle(undefined, groups)?.[AWAITING_VOLUME_GROUP])
      .toBe('Not yet in a volume (256-278) - after Volume 28');
    expect(awaitingGroupTitle([], null)).toBe('Not yet in a volume');
  });

  it('downloads only the group\'s missing chapters and monitors them through the stored -1 tag', () => {
    const awaiting = groups.find(([key]) => key === AWAITING_VOLUME_GROUP)?.[1] ?? [];
    expect(missingChapterIds(awaiting)).toEqual([11]);
    expect(serverVolumeNumber(AWAITING_VOLUME_GROUP)).toBe(-1);
    expect(serverVolumeNumber(28)).toBe(28);
  });
});
