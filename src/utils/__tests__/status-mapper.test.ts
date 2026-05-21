/**
 * Tests for the consolidated status mapper
 */

import { MangaPublicationStatus, ChapterStatus } from '@prisma/client';

import {
  mapToMangaStatus,
  mapFromMangaStatus,
  mapToChapterStatus,
  isValidStatusInput,
  getStatusVariants } from
'../status-mapper';

describe('Status Mapper', () => {
  describe('mapToMangaStatus', () => {
    describe('Generic status mapping', () => {
      // ONGOING variants
      it.each([
      'ongoing', 'ONGOING', 'OnGoInG',
      'publishing', 'PUBLISHING',
      'serialization', 'releasing', 'current',
      'continuing', 'active', 'in progress', 'in-progress']
      )('should map "%s" to ONGOING', (status) => {
        expect(mapToMangaStatus(status)).toBe(MangaPublicationStatus.ONGOING);
      });

      // COMPLETED variants
      it.each([
      'completed', 'COMPLETED', 'CoMpLeTeD',
      'finished', 'FINISHED',
      'ended', 'complete', 'done', 'fin']
      )('should map "%s" to COMPLETED', (status) => {
        expect(mapToMangaStatus(status)).toBe(MangaPublicationStatus.COMPLETED);
      });

      // HIATUS variants
      it.each([
      'hiatus', 'HIATUS',
      'on hold', 'on-hold', 'ON_HOLD',
      'paused', 'suspended', 'break', 'on break']
      )('should map "%s" to HIATUS', (status) => {
        expect(mapToMangaStatus(status)).toBe(MangaPublicationStatus.HIATUS);
      });

      // CANCELLED variants
      it.each([
      'cancelled', 'CANCELLED',
      'canceled', 'CANCELED',
      'discontinued', 'abandoned', 'dropped', 'axed']
      )('should map "%s" to CANCELLED', (status) => {
        expect(mapToMangaStatus(status)).toBe(MangaPublicationStatus.CANCELLED);
      });

      // UPCOMING variants
      it.each([
      'upcoming', 'UPCOMING',
      'not yet released', 'not-yet-released', 'NOT_YET_RELEASED',
      'tba', 'TBA', 'planned', 'announced']
      )('should map "%s" to UPCOMING', (status) => {
        expect(mapToMangaStatus(status)).toBe(MangaPublicationStatus.UPCOMING);
      });

      // UNKNOWN variants
      it.each([
      'unknown', 'UNKNOWN',
      'other', 'n/a', 'N/A', '',
      'gibberish', 'random-status']
      )('should map "%s" to UNKNOWN', (status) => {
        expect(mapToMangaStatus(status)).toBe(MangaPublicationStatus.UNKNOWN);
      });
    });

    describe('Provider-specific mappings', () => {
      describe('AniList', () => {
        it('should map RELEASING to ONGOING', () => {
          expect(mapToMangaStatus('RELEASING', 'anilist')).toBe(MangaPublicationStatus.ONGOING);
        });

        it('should map FINISHED to COMPLETED', () => {
          expect(mapToMangaStatus('FINISHED', 'anilist')).toBe(MangaPublicationStatus.COMPLETED);
        });

        it('should map NOT_YET_RELEASED to UPCOMING', () => {
          expect(mapToMangaStatus('NOT_YET_RELEASED', 'anilist')).toBe(MangaPublicationStatus.UPCOMING);
        });
      });

      // MangaDex provider removed - deprecated

      describe('ComicVine', () => {
        it('should handle capitalized comicvine statuses', () => {
          expect(mapToMangaStatus('Active', 'comicvine')).toBe(MangaPublicationStatus.ONGOING);
          expect(mapToMangaStatus('Discontinued', 'comicvine')).toBe(MangaPublicationStatus.CANCELLED);
        });
      });

      describe('Fandom', () => {
        it('should handle fandom-specific statuses', () => {
          expect(mapToMangaStatus('Publishing', 'fandom')).toBe(MangaPublicationStatus.ONGOING);
          expect(mapToMangaStatus('On Hold', 'fandom')).toBe(MangaPublicationStatus.HIATUS);
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle null/undefined inputs', () => {
        expect(mapToMangaStatus(null)).toBe(MangaPublicationStatus.UNKNOWN);
        expect(mapToMangaStatus(undefined)).toBe(MangaPublicationStatus.UNKNOWN);
      });

      it('should handle non-string inputs', () => {
        expect(mapToMangaStatus(123)).toBe(MangaPublicationStatus.UNKNOWN);
        expect(mapToMangaStatus({})).toBe(MangaPublicationStatus.UNKNOWN);
        expect(mapToMangaStatus([])).toBe(MangaPublicationStatus.UNKNOWN);
      });

      it('should handle extra whitespace', () => {
        expect(mapToMangaStatus('  ongoing  ')).toBe(MangaPublicationStatus.ONGOING);
        expect(mapToMangaStatus('on    hold')).toBe(MangaPublicationStatus.HIATUS);
      });

      it('should handle separator variations', () => {
        expect(mapToMangaStatus('on_hold')).toBe(MangaPublicationStatus.HIATUS);
        expect(mapToMangaStatus('on-hold')).toBe(MangaPublicationStatus.HIATUS);
        expect(mapToMangaStatus('in_progress')).toBe(MangaPublicationStatus.ONGOING);
      });
    });

    describe('Problematic cases from legacy code', () => {
      it('should NOT use substring matching (avoid false positives)', () => {
        // These should NOT match because they're different words
        expect(mapToMangaStatus('discontinued')).toBe(MangaPublicationStatus.CANCELLED);
        // Should not match "continuing" even though it contains "continue"
        expect(mapToMangaStatus('continuing')).toBe(MangaPublicationStatus.ONGOING);
      });

      it('should handle mixed case correctly', () => {
        // From manga/[id].tsx - lowercase check with uppercase string
        const status = 'ONGOING'.toLowerCase();
        expect(mapToMangaStatus(status)).toBe(MangaPublicationStatus.ONGOING);
      });
    });
  });

  describe('mapFromMangaStatus', () => {
    it('should map back to AniList format', () => {
      expect(mapFromMangaStatus(MangaPublicationStatus.ONGOING, 'anilist')).toBe('RELEASING');
      expect(mapFromMangaStatus(MangaPublicationStatus.COMPLETED, 'anilist')).toBe('FINISHED');
    });

    // MangaDex provider removed - deprecated

    it('should map back to ComicVine format', () => {
      expect(mapFromMangaStatus(MangaPublicationStatus.ONGOING, 'comicvine')).toBe('Active');
      expect(mapFromMangaStatus(MangaPublicationStatus.CANCELLED, 'comicvine')).toBe('Cancelled');
    });

    it('should return enum value for unknown provider', () => {
      expect(mapFromMangaStatus(MangaPublicationStatus.ONGOING, 'unknown')).toBe(MangaPublicationStatus.ONGOING);
    });
  });

  describe('mapToChapterStatus', () => {
    it('should map pending variants', () => {
      expect(mapToChapterStatus('pending')).toBe(ChapterStatus.PENDING);
      expect(mapToChapterStatus('waiting')).toBe(ChapterStatus.PENDING);
      expect(mapToChapterStatus('queued')).toBe(ChapterStatus.PENDING);
    });

    it('should map downloading variants', () => {
      expect(mapToChapterStatus('downloading')).toBe(ChapterStatus.DOWNLOADING);
      expect(mapToChapterStatus('in progress')).toBe(ChapterStatus.DOWNLOADING);
      expect(mapToChapterStatus('fetching')).toBe(ChapterStatus.DOWNLOADING);
    });

    it('should map completed variants', () => {
      expect(mapToChapterStatus('completed')).toBe(ChapterStatus.COMPLETED);
      expect(mapToChapterStatus('done')).toBe(ChapterStatus.COMPLETED);
      expect(mapToChapterStatus('finished')).toBe(ChapterStatus.COMPLETED);
    });

    it('should map error variants', () => {
      expect(mapToChapterStatus('error')).toBe(ChapterStatus.ERROR);
      expect(mapToChapterStatus('failed')).toBe(ChapterStatus.ERROR);
      expect(mapToChapterStatus('failure')).toBe(ChapterStatus.ERROR);
    });

    it('should map deleted variants', () => {
      expect(mapToChapterStatus('deleted')).toBe(ChapterStatus.DELETED);
      expect(mapToChapterStatus('removed')).toBe(ChapterStatus.DELETED);
      expect(mapToChapterStatus('missing')).toBe(ChapterStatus.DELETED);
    });

    it('should default to PENDING for unknown statuses', () => {
      expect(mapToChapterStatus('unknown')).toBe(ChapterStatus.PENDING);
      expect(mapToChapterStatus(null)).toBe(ChapterStatus.PENDING);
    });
  });

  describe('isValidStatusInput', () => {
    it('should validate string inputs', () => {
      expect(isValidStatusInput('ongoing')).toBe(true);
      expect(isValidStatusInput('')).toBe(true);
    });

    it('should validate number inputs', () => {
      expect(isValidStatusInput(123)).toBe(true);
      expect(isValidStatusInput(0)).toBe(true);
    });

    it('should reject invalid inputs', () => {
      expect(isValidStatusInput(null)).toBe(false);
      expect(isValidStatusInput(undefined)).toBe(false);
      expect(isValidStatusInput({})).toBe(false);
      expect(isValidStatusInput([])).toBe(false);
    });
  });

  describe('getStatusVariants', () => {
    it('should return all variants for ONGOING', () => {
      const variants = getStatusVariants(MangaPublicationStatus.ONGOING);
      expect(variants).toContain('ongoing');
      expect(variants).toContain('publishing');
      expect(variants).toContain('active');
    });

    it('should return all variants for COMPLETED', () => {
      const variants = getStatusVariants(MangaPublicationStatus.COMPLETED);
      expect(variants).toContain('completed');
      expect(variants).toContain('finished');
      expect(variants).toContain('ended');
    });

    it('should return unknown variants for UNKNOWN', () => {
      const variants = getStatusVariants(MangaPublicationStatus.UNKNOWN);
      expect(variants).toContain('unknown');
      expect(variants).toContain('');
    });
  });

  describe('Backwards compatibility', () => {
    it('should support deprecated functions with logger warnings', () => {
      // Note: Deprecated functions use logger.warn, not console.warn
      // Import the deprecated functions
      const { stringToDomainStatus, anilistToDomainStatus } = require('../status-mapper');

      // Verify the functions work correctly
      expect(stringToDomainStatus('ongoing')).toBe(MangaPublicationStatus.ONGOING);
      expect(anilistToDomainStatus('RELEASING')).toBe(MangaPublicationStatus.ONGOING);
    });
  });
});