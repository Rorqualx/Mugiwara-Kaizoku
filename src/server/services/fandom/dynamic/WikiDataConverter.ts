/**
 * Wiki Data Converter
 *
 * Handles conversion of extracted wiki data to standard format
 */

import { logger } from '@/utils/logger';

import type { ExtractedData } from './DynamicWikiParser';

export interface VolumeInfo {
  number: number;
  title: string;
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
  pageCount?: number;
  chapters: ChapterInfo[];
  url?: string;
}

export interface ChapterInfo {
  number: number | string;
  title: string;
  alternativeTitles?: string[];
  volume?: number;
  pages?: number;
  releaseDate?: string;
  url?: string;
  summary?: string;
  coverImage?: string;
}

export interface ConvertedData {
  volumes: VolumeInfo[];
  chapters: ChapterInfo[];
  gallery?: unknown[];
}

export class WikiDataConverter {
  private log = logger.child('WikiDataConverter', { service: 'WikiDataConverter' });

  /**
   * Convert extracted data to standard format
   */
  convertExtractedData(extracted: ExtractedData, baseUrl: string): ConvertedData {
    const volumes: VolumeInfo[] = [];
    const chapters: ChapterInfo[] = [];
    const gallery: unknown[] = [];

    const data = extracted.data as Record<string, unknown>;

    // Extract volumes
    if (data["volumes"] && Array.isArray(data["volumes"])) {
      this.extractVolumes(data["volumes"], volumes, chapters, baseUrl);
    }

    // Extract standalone chapters
    if (data["chapters"] && Array.isArray(data["chapters"]) && !volumes.length) {
      this.extractStandaloneChapters(data["chapters"], chapters, baseUrl);
    }

    // Extract gallery
    if (data["gallery"] && Array.isArray(data["gallery"]) && data["gallery"].length > 0) {
      this.log.info(`Found ${data["gallery"].length} gallery images from extraction`);
      gallery.push(...(data["gallery"] as unknown[]));
    }

    // Log gallery data
    if (gallery.length > 0) {
      this.log.info(`🖼️ [GALLERY] Returning ${gallery.length} gallery images from convertExtractedData`);
    }

    return { volumes, chapters, ...(gallery.length > 0 ? { gallery } : {}) };
  }

  /**
   * Extract volumes from data
   */
  private extractVolumes(
    volumesData: unknown[],
    volumes: VolumeInfo[],
    chapters: ChapterInfo[],
    baseUrl: string
  ): void {
    for (const volData of volumesData) {
      const vol = volData as Record<string, unknown>;
      const volume = this.createVolumeInfo(vol, volumes.length, baseUrl);

      // Add chapters if present
      if (vol["chapters"] && Array.isArray(vol["chapters"])) {
        this.extractVolumeChapters(vol["chapters"], volume, chapters, baseUrl);
      }

      volumes.push(volume);
    }
  }

  /**
   * Create volume info object
   */
  private createVolumeInfo(vol: Record<string, unknown>, currentCount: number, baseUrl: string): VolumeInfo {
    const volNumber = typeof vol["number"] === 'number' ? vol["number"] : currentCount + 1;
    const volume: VolumeInfo = {
      number: volNumber,
      title: typeof vol["title"] === 'string' ? vol["title"] : `Volume ${volNumber}`,
      chapters: []
    };

    // Add optional fields
    return this.addVolumeOptionalFields(vol, volume, baseUrl);
  }

  /**
   * Add optional fields to volume
   */
  private addVolumeOptionalFields(vol: Record<string, unknown>, volumeParam: VolumeInfo, baseUrl: string): VolumeInfo {
    const volume = { ...volumeParam };

    const coverImage = (vol["coverImage"] ?? vol["cover"]) as string | undefined;
    if (coverImage !== undefined) volume.coverImage = coverImage;

    const releaseDate = this.parseReleaseDate((vol["releaseDate"] ?? vol["date"]) as string | undefined);
    if (releaseDate !== undefined) volume.releaseDate = releaseDate;

    const isbn = vol["isbn"] as string | undefined;
    if (isbn !== undefined) volume.isbn = isbn;

    const pageCount = vol["pages"] as number | undefined;
    if (pageCount !== undefined) volume.pageCount = pageCount;

    const volumeUrl = this.resolveUrl((vol["url"] ?? vol["link"]) as string | undefined, baseUrl);
    if (volumeUrl !== undefined) volume.url = volumeUrl;

    return volume;
  }

  /**
   * Extract chapters from volume data
   */
  private extractVolumeChapters(
    chaptersData: unknown[],
    volume: VolumeInfo,
    chapters: ChapterInfo[],
    baseUrl: string
  ): void {
    for (const chData of chaptersData) {
      const ch = chData as Record<string, unknown>;
      const chNumber = ch["number"] ?? ch["chapter"] ?? chapters.length + 1;
      const chapter: ChapterInfo = {
        number: chNumber as string | number,
        title: typeof ch["title"] === 'string' ? ch["title"] : `Chapter ${chNumber}`,
        volume: volume.number
      };

      const chapterUrl = this.resolveUrl((ch["url"] ?? ch["link"]) as string | undefined, baseUrl);
      if (chapterUrl !== undefined) chapter.url = chapterUrl;

      volume.chapters.push(chapter);
      chapters.push(chapter);
    }
  }

  /**
   * Extract standalone chapters (without volume organization)
   */
  private extractStandaloneChapters(
    chaptersData: unknown[],
    chapters: ChapterInfo[],
    baseUrl: string
  ): void {
    for (const chData of chaptersData) {
      const ch = chData as Record<string, unknown>;
      const chNumber = ch["number"] ?? ch["chapter"] ?? chapters.length + 1;
      const chapter: ChapterInfo = {
        number: chNumber as string | number,
        title: typeof ch["title"] === 'string' ? ch["title"] : `Chapter ${chNumber}`
      };

      const chapterUrl = this.resolveUrl((ch["url"] ?? ch["link"]) as string | undefined, baseUrl);
      if (chapterUrl !== undefined) chapter.url = chapterUrl;

      chapters.push(chapter);
    }
  }

  /**
   * Resolve relative URLs
   */
  private resolveUrl(url: string | undefined, baseUrl: string): string | undefined {
    if (!url) return undefined;

    try {
      const base = new URL(baseUrl);

      if (url.startsWith('http')) {
        return url;
      } else if (url.startsWith('//')) {
        return base.protocol + url;
      } else if (url.startsWith('/')) {
        return base.origin + url;
      }

      // Relative path
      const pathParts = base.pathname.split('/');
      pathParts.pop();
      return base.origin + pathParts.join('/') + '/' + url;
    } catch {
      return url;
    }
  }

  /**
   * Parse release date string
   */
  private parseReleaseDate(date: string | undefined): string | undefined {
    if (!date) return undefined;

    if (date.length <= 1) return undefined;

    const cleanDate = date.trim();

    const datePatterns = [
      /(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2}\s+\w+\s+\d{4})/
    ];

    for (const pattern of datePatterns) {
      const match = cleanDate.match(pattern);
      if (match) {
        return match[1];
      }
    }

    if (cleanDate.match(/\d{4}/) && cleanDate.length > 4) {
      return cleanDate;
    }

    return undefined;
  }
}
