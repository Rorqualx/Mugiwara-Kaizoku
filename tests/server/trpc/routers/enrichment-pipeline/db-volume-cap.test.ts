/**
 * @jest-environment node
 *
 * Volume cap: exact for a finished series, 1.1x for a running one.
 *
 * Bug protected: with a 1.1x cap on a finished series, reconciliation and the
 * daily sweep rebuilt a placeholder "Volume 75" for 74-volume Bleach, the
 * phantom prune deleted it on the next refresh, and its chapters lost their
 * volume each time (29 titles held 34 such volumes).
 */
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: { $queryRaw: jest.fn() } }));

import { prisma } from '@/server/db';
import { corroboratedFinalChapter, filesOutrunLastVolume, getVolumeCapForManga, misnumberedPastFinalRows, volumeCapFor } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/db-volume-cap';

const base = { endDate: null, country: 'JP', format: 'MANGA' };

describe('volumeCapFor', () => {
  it('caps a finished 74-volume series at exactly 74, with or without a caller hint', () => {
    expect(volumeCapFor({ ...base, volumes: 74, status: 'COMPLETED' })).toEqual({ cap: 74, source: 'metadata' });
    expect(volumeCapFor({ ...base, volumes: 74, status: 'COMPLETED' }, 74).cap).toBe(74);
  });

  it('treats a series with an end date as finished even when its status still says ongoing', () => {
    expect(volumeCapFor({ ...base, volumes: 41, status: 'ONGOING', endDate: new Date('2021-09-10') }).cap).toBe(41);
  });

  it('does not let a low hint cut a finished series below its stored count (Tokyo Ghoul: hint 8, stored 14)', () => {
    expect(volumeCapFor({ ...base, volumes: 14, status: 'COMPLETED' }, 8)).toEqual({ cap: 14, source: 'metadata' });
  });

  it('allows exactly one volume past the count when downloaded chapters outrun the last volume (Solo Leveling: 15 volumes to chapter 48, files to 201)', () => {
    expect(volumeCapFor({ ...base, volumes: 15, status: 'COMPLETED', filesPastLastVolume: true }).cap).toBe(16);
    expect(volumeCapFor({ ...base, volumes: 15, status: 'COMPLETED', filesPastLastVolume: false }).cap).toBe(15);
    expect(volumeCapFor({ ...base, volumes: 15, status: 'COMPLETED', filesPastLastVolume: true }, 15).cap).toBe(16);
  });

  it('keeps the 1.1x allowance for a running series, so the next volume can be created', () => {
    expect(volumeCapFor({ ...base, volumes: 74, status: 'ONGOING' }).cap).toBe(82);
    expect(volumeCapFor({ ...base, volumes: 74, status: 'HIATUS' }, 20).cap).toBe(22);
  });

  it('has no cap without a count, one volume for a Korean webtoon without volumes, and the hint alone when the title is unknown', () => {
    expect(volumeCapFor({ ...base, volumes: null, status: 'ONGOING' }).cap).toBe(Infinity);
    expect(volumeCapFor({ ...base, volumes: 0, status: 'ONGOING', country: 'KR', format: 'MANHWA' })).toEqual({ cap: 1, source: 'kr-webtoon' });
    expect(volumeCapFor(null, 20)).toEqual({ cap: 22, source: 'caller' });
    expect(volumeCapFor(null)).toEqual({ cap: Infinity, source: 'none' });
  });
});

describe('filesOutrunLastVolume — which downloads earn the one volume past the count', () => {
  it('does not let a decimal extra right after the last volume allow another volume (Attack on Titan: 139.5 after volume 34 ending at 139)', () => {
    expect(filesOutrunLastVolume([{ chapterNumber: 139.5, volume: 34 }], 139, 34)).toBe(false);
    // Even when an earlier run had already filed it in a volume 35.
    expect(filesOutrunLastVolume([{ chapterNumber: 139.5, volume: 35 }], 139, 34)).toBe(false);
  });

  it('lets a whole-numbered file at least one past the last volume\'s end allow it (Solo Leveling: volumes end at 48, files to 201)', () => {
    expect(filesOutrunLastVolume([{ chapterNumber: 49, volume: null }], 48, 15)).toBe(true);
    expect(filesOutrunLastVolume([{ chapterNumber: 201, volume: 16 }], 48, 15)).toBe(true);
  });

  it('keeps the volume for files that no counted range holds and that already sit past the count (Yofukashi no Uta: chapters 10-22 in Misc volume 21)', () => {
    const misc = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(n => ({ chapterNumber: n, volume: 21 }));
    expect(filesOutrunLastVolume([...misc, { chapterNumber: 200.5, volume: 20 }], 200, 20)).toBe(true);
  });

  it('keeps the volume for chapter 0 and numberless archives filed past the count (Jujutsu Kaisen: volume 31; Vinland Saga: "Vol 30")', () => {
    const jjk = [
      { chapterNumber: null, volume: 31 }, { chapterNumber: 0, volume: 31 },
      { chapterNumber: 272.1, volume: 30 }, { chapterNumber: 272.2, volume: 30 },
    ];
    expect(filesOutrunLastVolume(jjk, 272, 30)).toBe(true);
    expect(filesOutrunLastVolume([{ chapterNumber: null, volume: 30 }], 220, 29)).toBe(true);
  });

  it('allows nothing without a past-the-end file, a last volume end or a count', () => {
    expect(filesOutrunLastVolume([], 139, 34)).toBe(false);
    expect(filesOutrunLastVolume([{ chapterNumber: 140, volume: null }], null, 34)).toBe(false);
    expect(filesOutrunLastVolume([{ chapterNumber: null, volume: 35 }], 139, null)).toBe(false);
  });
});

describe('getVolumeCapForManga', () => {
  it('caps finished Attack on Titan at 34 when its only file past volume 34 is the decimal extra 139.5', async () => {
    jest.mocked(prisma.$queryRaw).mockResolvedValueOnce([{
      ...base, volumes: 34, status: 'COMPLETED', endDate: new Date('2021-04-09'),
      lastVolumeEnd: 139, pastRows: [{ chapterNumber: 139.5, volume: 34 }],
    }] as never);
    await expect(getVolumeCapForManga(52)).resolves.toEqual({ cap: 34, source: 'metadata' });
  });

  it('keeps Yofukashi no Uta\'s 21st volume while its downloaded chapters 10-22 are filed there', async () => {
    jest.mocked(prisma.$queryRaw).mockResolvedValueOnce([{
      ...base, volumes: 20, status: 'COMPLETED', lastVolumeEnd: 200,
      pastRows: [{ chapterNumber: 10, volume: 21 }, { chapterNumber: 200.5, volume: 20 }],
    }] as never);
    await expect(getVolumeCapForManga(27)).resolves.toEqual({ cap: 21, source: 'metadata' });
  });
});

describe('mis-numbered files past a finished series\' agreed final chapter', () => {
  // Tokyo Ghoul: 14 volumes end at 143; AniList and Kitsu count 144 (one extra),
  // MangaUpdates 143. Rows from "V09"-"V13" archives numbered 144-159 (they hold
  // chapters 69-121) used to raise the cap to 15 and reconciliation rebuilt a
  // "volume 15" over 144-159 on every refresh.
  const tgClaims = [
    { provider: 'anilist', chapters: 144 }, { provider: 'kitsu', chapters: 144 },
    { provider: 'mangaupdates', chapters: 143 },
  ];
  const tgRows = [144, 145, 146, 147, 148, 158, 159].map(n => ({ chapterNumber: n, volume: 15 }));

  it('takes the final chapter two providers agree on, and none when no two agree', () => {
    expect(corroboratedFinalChapter(tgClaims)).toBe(144);
    expect(corroboratedFinalChapter([{ provider: 'anilist', chapters: 66 }, { provider: 'mangaupdates', chapters: 48 }])).toBeNull();
    expect(corroboratedFinalChapter([{ provider: 'anilist', chapters: 201 }, { provider: 'anilist', chapters: 201 }])).toBeNull();
    expect(corroboratedFinalChapter([{ provider: 'anilist', chapters: null }, { provider: 'kitsu', chapters: 0 }])).toBeNull();
  });

  it('does not let Tokyo Ghoul\'s rows numbered 144-159 (filed in a rebuilt volume 15) earn a 15th volume', () => {
    expect(filesOutrunLastVolume(tgRows, 143, 14, 144)).toBe(false);
    expect(misnumberedPastFinalRows(tgRows, 143, 14, 144)).toHaveLength(tgRows.length);
    // Without the agreed final chapter the old rule still applies.
    expect(filesOutrunLastVolume(tgRows, 143, 14, null)).toBe(true);
  });

  it('treats a row past the agreed final chapter as mis-numbered even before the last volume\'s range is known', () => {
    expect(misnumberedPastFinalRows([{ chapterNumber: 159, volume: 15 }], null, 14, 144)).toHaveLength(1);
    expect(misnumberedPastFinalRows([{ chapterNumber: 143.5, volume: 14 }], null, 14, 143)).toHaveLength(0);
  });

  it('keeps Solo Leveling\'s volume 16: files 49-201 lie inside a series that ends at 201, far past volume 15\'s end at 48', () => {
    const rows = [{ chapterNumber: 49, volume: 16 }, { chapterNumber: 201, volume: 16 }];
    expect(misnumberedPastFinalRows(rows, 48, 15, 201)).toHaveLength(0);
    expect(filesOutrunLastVolume(rows, 48, 15, 201)).toBe(true);
  });

  it('still lets a numberless archive filed past the count earn its volume (Jujutsu Kaisen "V31")', () => {
    expect(filesOutrunLastVolume([{ chapterNumber: null, volume: 31 }], 271, 30, 271)).toBe(true);
  });

  it('caps finished Tokyo Ghoul at 14 from its stored claims, and finished Solo Leveling at 16', async () => {
    jest.mocked(prisma.$queryRaw).mockResolvedValueOnce([{
      ...base, volumes: 14, status: 'COMPLETED', lastVolumeEnd: 143, pastRows: tgRows, finalClaims: tgClaims,
    }] as never);
    await expect(getVolumeCapForManga(38)).resolves.toEqual({ cap: 14, source: 'metadata' });
    jest.mocked(prisma.$queryRaw).mockResolvedValueOnce([{
      ...base, volumes: 15, status: 'COMPLETED', lastVolumeEnd: 48,
      pastRows: [{ chapterNumber: 49, volume: 16 }, { chapterNumber: 201, volume: 16 }],
      finalClaims: [{ provider: 'anilist', chapters: 201 }, { provider: 'mangaupdates', chapters: 201 }],
    }] as never);
    await expect(getVolumeCapForManga(102)).resolves.toEqual({ cap: 16, source: 'metadata' });
  });

  it('ignores the chapter counts of a running series: its latest chapter is not a final one', async () => {
    jest.mocked(prisma.$queryRaw).mockResolvedValueOnce([{
      ...base, volumes: 10, status: 'ONGOING', lastVolumeEnd: 90,
      pastRows: [{ chapterNumber: 95, volume: null }],
      finalClaims: [{ provider: 'anilist', chapters: 91 }, { provider: 'mangaupdates', chapters: 91 }],
    }] as never);
    await expect(getVolumeCapForManga(1)).resolves.toEqual({ cap: 11, source: 'metadata' });
  });
});
