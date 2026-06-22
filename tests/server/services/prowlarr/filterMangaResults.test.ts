/**
 * @jest-environment node
 *
 * filterMangaResults — video-release rejection tests
 *
 * Regression-locks the indicators that matter: width×height resolution
 * notation (e.g. "[1280x720]"), file extensions in the title, codec /
 * audio / source tags. The Asshou pipeline was dispatching an unrelated
 * anime episode "Anata mo Robot ni Nararu feat. Kamome Jidou Gasshoudan
 * [1280x720] [TardS]" because the original regex only knew "720p" — not
 * the dimensional form.
 */

import { filterMangaResults } from '@/server/services/prowlarr/prowlarr-scoring';

import type { ProwlarrApiSearchResult } from '@/server/services/prowlarr/prowlarr-types';

function fixture(title: string, overrides: Partial<ProwlarrApiSearchResult> = {}): ProwlarrApiSearchResult {
  return {
    title,
    guid: `guid-${title}`,
    indexer: 'TestIndexer',
    indexerName: 'Test',
    seeders: 5,
    leechers: 0,
    size: 100_000_000,
    publishDate: '2026-01-01T00:00:00Z',
    downloadUrl: 'http://example.com/download',
    categories: [{ id: 7000, name: 'Books' }],
    protocol: 'torrent',
    ...overrides,
  } as ProwlarrApiSearchResult;
}

describe('filterMangaResults — video rejection', () => {
  describe('rejects', () => {
    it('rejects bracketed width×height resolution (the Asshou bug case)', () => {
      const out = filterMangaResults([
        fixture('Anata mo Robot ni Nararu feat. Kamome Jidou Gasshoudan [1280x720] [TardS]'),
      ]);
      expect(out).toEqual([]);
    });

    it('rejects 1920x1080', () => {
      const out = filterMangaResults([fixture('Some Anime [1920x1080] [Group]')]);
      expect(out).toEqual([]);
    });

    it('rejects 1080p / 720p / 480p / 2160p', () => {
      for (const tag of ['1080p', '720p', '480p', '2160p']) {
        const out = filterMangaResults([fixture(`Anime Title ${tag} BluRay`)]);
        expect(out).toEqual([]);
      }
    });

    it('rejects video codecs', () => {
      for (const tag of ['x264', 'x265', 'h264', 'h.265', 'HEVC']) {
        const out = filterMangaResults([fixture(`Anime ${tag} 10bit`)]);
        expect(out).toEqual([]);
      }
    });

    it('rejects video file extensions in the title', () => {
      for (const ext of ['mkv', 'mp4', 'avi', 'webm', 'm4v']) {
        const out = filterMangaResults([fixture(`Manga Title.${ext}`)]);
        expect(out).toEqual([]);
      }
    });

    it('rejects TV episode notation', () => {
      const out = filterMangaResults([fixture('Some Show S01E05 720p')]);
      expect(out).toEqual([]);
    });

    it('rejects BluRay / WebRip source tags', () => {
      for (const tag of ['BluRay', 'BDRip', 'WebRip', 'Web-DL', 'HDTV']) {
        const out = filterMangaResults([fixture(`Anime Title ${tag}`)]);
        expect(out).toEqual([]);
      }
    });

    it('rejects anime movie releases (the MTBB Owarimonogatari bug case)', () => {
      const out = filterMangaResults([
        fixture('[MTBB] Zoku Owarimonogatari the Movie (v2) [2A9A3B86]'),
      ]);
      expect(out).toEqual([]);
    });

    it('rejects OVA and ONA tags', () => {
      for (const tag of ['OVA', 'ONA']) {
        const out = filterMangaResults([fixture(`Some Series ${tag} Bundle`)]);
        expect(out).toEqual([]);
      }
    });
  });

  describe('keeps', () => {
    it('keeps a Japanese-titled volume pack', () => {
      const out = filterMangaResults([fixture('圧勝 第01-04巻 [Asshou vol 02-04]')]);
      expect(out).toHaveLength(1);
    });

    it('keeps a standard manga volume pack', () => {
      const out = filterMangaResults([fixture('Naruto v01-v72 (Digital) (BWX) [Manga]')]);
      expect(out).toHaveLength(1);
    });

    it('keeps a CBZ release', () => {
      const out = filterMangaResults([fixture('Series Name v01 (CBZ)')]);
      expect(out).toHaveLength(1);
    });

    it('keeps a firm-category release with no manga keyword in the title', () => {
      // Category 7030 (Comics) stands on its own — title need not say "manga".
      const out = filterMangaResults([
        fixture('Berserk Deluxe Edition', { categories: [7030] }),
      ]);
      expect(out).toHaveLength(1);
    });

    it('keeps a weak-category (Other) release WHEN the title has a manga keyword', () => {
      const out = filterMangaResults([
        fixture('One Piece vol 01-105', { categories: [8000] }),
      ]);
      expect(out).toHaveLength(1);
    });
  });

  describe('size + weak-category gating', () => {
    it('rejects an oversized (>20GB) release even with manga signals', () => {
      const out = filterMangaResults([
        fixture('Some Manga vol 01-10', { size: 25 * 1024 ** 3, categories: [7030] }),
      ]);
      expect(out).toEqual([]);
    });

    it('rejects the JoJo BD pack (job 13168): clean title, 8000/Other, 31GB', () => {
      const out = filterMangaResults([
        fixture("Jojo's Bizarre Adventure Part 1 and 2 - Phantom Blood and Battle Tendency (Old)", {
          size: 31_549_652_005,
          categories: [8000],
          indexer: 'TorrentsCSV',
        }),
      ]);
      expect(out).toEqual([]);
    });

    it('rejects a weak-category (Other) release with no manga keyword', () => {
      const out = filterMangaResults([
        fixture('Random Bundle Pack', { categories: [8000] }),
      ]);
      expect(out).toEqual([]);
    });

    it('keeps a normal-sized manga release just under the ceiling', () => {
      const out = filterMangaResults([
        fixture('Naruto Complete v01-v72 Manga', { size: 5 * 1024 ** 3 }),
      ]);
      expect(out).toHaveLength(1);
    });
  });
});
