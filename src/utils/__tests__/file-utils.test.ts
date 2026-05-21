import { describe, it, expect } from '@jest/globals';

import {
  isMangaFile,
  isImageFile,
  extractVolumeNumber,
  extractChapterNumber,
  naturalSort,
  SUPPORTED_MANGA_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS
} from '../file-utils';

describe('file-utils', () => {
  describe('isMangaFile', () => {
    it('should identify supported manga files', () => {
      expect(isMangaFile('manga.cbz')).toBe(true);
      expect(isMangaFile('manga.zip')).toBe(true);
      expect(isMangaFile('manga.pdf')).toBe(true);
      expect(isMangaFile('manga.cbr')).toBe(true);
      expect(isMangaFile('manga.rar')).toBe(true);
      expect(isMangaFile('manga.7z')).toBe(true);
      expect(isMangaFile('novel.epub')).toBe(true);
    });

    it('should handle case-insensitive extensions', () => {
      expect(isMangaFile('manga.CBZ')).toBe(true);
      expect(isMangaFile('manga.ZIP')).toBe(true);
      expect(isMangaFile('manga.PDF')).toBe(true);
    });

    it('should reject non-manga files', () => {
      expect(isMangaFile('image.jpg')).toBe(false);
      expect(isMangaFile('document.txt')).toBe(false);
      expect(isMangaFile('video.mp4')).toBe(false);
      expect(isMangaFile('no-extension')).toBe(false);
    });
  });

  describe('isImageFile', () => {
    it('should identify supported image files', () => {
      expect(isImageFile('page1.jpg')).toBe(true);
      expect(isImageFile('page2.jpeg')).toBe(true);
      expect(isImageFile('cover.png')).toBe(true);
      expect(isImageFile('scan.webp')).toBe(true);
      expect(isImageFile('old.gif')).toBe(true);
      expect(isImageFile('raw.bmp')).toBe(true);
    });

    it('should handle case-insensitive extensions', () => {
      expect(isImageFile('page.JPG')).toBe(true);
      expect(isImageFile('cover.PNG')).toBe(true);
      expect(isImageFile('scan.WEBP')).toBe(true);
    });

    it('should reject non-image files', () => {
      expect(isImageFile('manga.cbz')).toBe(false);
      expect(isImageFile('document.pdf')).toBe(false);
      expect(isImageFile('text.txt')).toBe(false);
    });
  });

  describe('extractVolumeNumber', () => {
    it('should extract volume numbers from various formats', () => {
      expect(extractVolumeNumber('Manga Title Vol.1')).toBe(1);
      expect(extractVolumeNumber('Manga Title Volume 2')).toBe(2);
      expect(extractVolumeNumber('Title v03')).toBe(3);
      expect(extractVolumeNumber('Title V4')).toBe(4);
      expect(extractVolumeNumber('Vol_5_Chapter_10')).toBe(5);
    });

    it('should return null when no volume found', () => {
      expect(extractVolumeNumber('Just a title')).toBe(null);
      expect(extractVolumeNumber('Chapter 10')).toBe(null);
      expect(extractVolumeNumber('manga.cbz')).toBe(null);
    });
  });

  describe('extractChapterNumber', () => {
    it('should extract chapter numbers from various formats', () => {
      expect(extractChapterNumber('Chapter 1')).toBe(1);
      expect(extractChapterNumber('Ch.2')).toBe(2);
      expect(extractChapterNumber('ch_003')).toBe(3);
      expect(extractChapterNumber('Title - Chapter 10')).toBe(10);
      expect(extractChapterNumber('c20')).toBe(20);
    });

    it('should handle decimal chapter numbers', () => {
      expect(extractChapterNumber('Chapter 1.5')).toBe(1.5);
      expect(extractChapterNumber('Ch 10.1')).toBe(10.1);
      expect(extractChapterNumber('c2.75')).toBe(2.75);
    });

    it('should extract from common numeric patterns', () => {
      expect(extractChapterNumber('manga_001_scan')).toBe(1);
      expect(extractChapterNumber('title-025-hq')).toBe(25);
      expect(extractChapterNumber('manga-99')).toBe(99);
    });

    it('should return null when no chapter found', () => {
      expect(extractChapterNumber('Just a title')).toBe(null);
      expect(extractChapterNumber('Volume 5')).toBe(null);
      expect(extractChapterNumber('manga.cbz')).toBe(null);
    });
  });

  describe('naturalSort', () => {
    it('should sort files with numeric sequences correctly', () => {
      const files = [
        'chapter-10.cbz',
        'chapter-2.cbz',
        'chapter-1.cbz',
        'chapter-20.cbz',
        'chapter-3.cbz'
      ];

      const sorted = naturalSort(files);
      
      expect(sorted).toEqual([
        'chapter-1.cbz',
        'chapter-2.cbz',
        'chapter-3.cbz',
        'chapter-10.cbz',
        'chapter-20.cbz'
      ]);
    });

    it('should handle mixed numeric formats', () => {
      const files = [
        'vol_1_ch_10',
        'vol_1_ch_2',
        'vol_2_ch_1',
        'vol_1_ch_1',
        'vol_10_ch_1'
      ];

      const sorted = naturalSort(files);
      
      expect(sorted[0]).toBe('vol_1_ch_1');
      expect(sorted[1]).toBe('vol_1_ch_2');
      expect(sorted[2]).toBe('vol_1_ch_10');
    });

    it('should handle files without numbers', () => {
      const files = ['manga-b', 'manga-a', 'manga-c'];
      const sorted = naturalSort(files);
      
      expect(sorted).toEqual(['manga-a', 'manga-b', 'manga-c']);
    });
  });

  describe('constants', () => {
    it('should have all expected manga extensions', () => {
      expect(SUPPORTED_MANGA_EXTENSIONS).toContain('.cbz');
      expect(SUPPORTED_MANGA_EXTENSIONS).toContain('.zip');
      expect(SUPPORTED_MANGA_EXTENSIONS).toContain('.pdf');
      expect(SUPPORTED_MANGA_EXTENSIONS).toContain('.cbr');
      expect(SUPPORTED_MANGA_EXTENSIONS).toContain('.rar');
      expect(SUPPORTED_MANGA_EXTENSIONS).toContain('.7z');
      expect(SUPPORTED_MANGA_EXTENSIONS).toContain('.epub');
    });

    it('should have all expected image extensions', () => {
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('.jpg');
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('.jpeg');
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('.png');
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('.webp');
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('.gif');
      expect(SUPPORTED_IMAGE_EXTENSIONS).toContain('.bmp');
    });
  });
});