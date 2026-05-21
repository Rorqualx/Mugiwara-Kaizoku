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
  });
});
