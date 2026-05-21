/**
 * Chapter Enrichment Service
 *
 * Handles enriching chapter metadata from ComicVine and Fandom providers.
 *
 * This service:
 * - Fetches chapter/issue data from ComicVine API
 * - Parses volume/chapter tables from Fandom wiki pages
 * - Creates/updates Chapter records in database
 * - Updates metadata with chapter counts
 * - Returns AsyncResult for type-safe error handling
 * - Zero `any` types - fully DEVELOPMENT_RULES.md compliant
 *
 * @module ChapterEnrichmentService
 */

import { ChapterStatus } from '@prisma/client';
import axios from 'axios';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { AsyncResult, createSuccessResult, createErrorResult } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { toStringId, toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { searchProviderRegistry } from '../search/registerProviders';

import { parseVolumeTables } from './utils/fandomTableParser';

import type { Prisma } from '@prisma/client';


/**
 * Input for chapter enrichment
 */
export interface EnrichChaptersInput {
  /** Database manga ID */
  mangaId: number;
}

/**
 * Result of chapter enrichment
 */
export interface EnrichChaptersResult {
  /** Number of chapters created */
  createdCount: number;
  /** Number of chapters updated */
  updatedCount: number;
  /** Total chapters processed */
  totalChapters: number;
}

/**
 * Type-safe chapter create input matching Prisma schema
 */
interface ChapterCreateInput {
  mangaId: number;
  fileName: string;
  index: number;
  title: string;
  size: number;
  downloadStatus: ChapterStatus;
  downloadUrl: string | null;
  coverImage: string | null;
  description: string | null;
  pageCount: number | null;
}

/**
 * Helper type guards
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeGet(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

/**
 * Chapter Enrichment Service
 *
 * Responsible for fetching and persisting chapter metadata from external providers
 */
export class ChapterEnrichmentService {
  private logger = logger.child('ChapterEnrichmentService', {
    module: 'ChapterEnrichmentService'
  });

  /**
   * Enrich chapter metadata from ComicVine
   *
   * Fetches issues from ComicVine API and creates/updates Chapter records.
   * Only works for manga with source='comicvine'.
   *
   * @param input - Enrichment input with manga ID
   * @returns AsyncResult with enrichment statistics
   */
  async enrichFromComicVine(
    input: EnrichChaptersInput
  ): Promise<AsyncResult<EnrichChaptersResult>> {
    try {
      const { mangaId } = input;

      // Get manga from database
      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        include: {
          Metadata: true,
          Chapter: true
        }
      });

      if (!manga) {
        return createErrorResult(new ValidationError(`Manga with ID ${mangaId} not found`));
      }

      // Check if this is a ComicVine manga
      if (manga.source !== 'comicvine') {
        this.logger.info(`Manga ${manga.title} is not from ComicVine, skipping ComicVine chapter enrichment`);
        return createSuccessResult({
          createdCount: 0,
          updatedCount: 0,
          totalChapters: 0
        });
      }

      this.logger.info(`Enriching chapter metadata from ComicVine for manga: ${manga.title} (ID: ${mangaId})`);

      // Get ComicVine volume ID from provider metadata
      const volumeId = this.extractComicVineVolumeId(manga.providerMetadata);

      if (!volumeId) {
        this.logger.warn(`No ComicVine volume ID found for manga ${manga.title}`);
        return createErrorResult(new Error(`No ComicVine volume ID found for manga: ${manga.title}`));
      }

      this.logger.info(`Using ComicVine volume ID: ${volumeId}`);

      // Get ComicVine provider instance
      const comicvineProvider = searchProviderRegistry.get('comicvine');
      if (!comicvineProvider) {
        return createErrorResult(new Error('ComicVine provider not found in registry'));
      }

      // Fetch issues from ComicVine
      const issues = await this.fetchComicVineIssues(volumeId);

      if (!issues) {
        return createErrorResult(new Error('Failed to fetch issues from ComicVine'));
      }

      this.logger.info(`Fetched ${issues.length} issues from ComicVine for ${manga.title}`);

      // Create/update chapters from issues in parallel
      const operations = await Promise.all(
        issues.map(async (issue) => {
          const chapterNumber = this.parseChapterNumber(issue['issueNumber']);
          const existingChapter = manga.Chapter.find((ch) => ch.index === chapterNumber);

          if (existingChapter) {
            // Update existing chapter with ComicVine data
            await prisma.chapter.update({
              where: { id: existingChapter.id },
              data: {
                title: this.extractTitle(issue) ?? existingChapter.title,
                downloadUrl: this.extractCoverImage(issue) ?? existingChapter.downloadUrl,
                coverImage: this.extractCoverImage(issue) ?? existingChapter.coverImage,
                description: this.extractDescription(issue) ?? existingChapter.description,
                pageCount: this.extractPageCount(issue) ?? existingChapter.pageCount
              }
            });
            this.logger.debug(`Updated chapter ${chapterNumber} with ComicVine data`);
            return { operation: 'updated' as const };
          } else {
            // Create new chapter with enhanced issue data
            const createData: ChapterCreateInput = {
              mangaId: toNumberId(manga.id),
              fileName: `issue-${issue['issueNumber'] ?? chapterNumber}.cbz`,
              index: chapterNumber,
              title: this.extractTitle(issue) ?? `Issue #${issue['issueNumber'] ?? chapterNumber}`,
              size: 0,
              downloadStatus: ChapterStatus.PENDING,
              downloadUrl: this.extractCoverImage(issue),
              coverImage: this.extractCoverImage(issue),
              description: this.extractDescription(issue),
              pageCount: this.extractPageCount(issue)
            };

            await prisma.chapter.create({
              data: createData as unknown as Prisma.ChapterCreateInput
            });
            this.logger.debug(`Created chapter ${chapterNumber}: ${this.extractTitle(issue)}`);
            return { operation: 'created' as const };
          }
        })
      );

      // Count the operations
      const createdCount = operations.filter(op => op.operation === 'created').length;
      const updatedCount = operations.filter(op => op.operation === 'updated').length;

      // Update metadata with issue count
      if (manga.metadataId && issues.length > 0) {
        await prisma.metadata.update({
          where: { id: manga.metadataId },
          data: { chapters: issues.length }
        });
      }

      this.logger.info(
        `Successfully enriched chapter metadata from ComicVine for ${manga.title}. Created ${createdCount}, updated ${updatedCount}.`
      );

      // Emit WebSocket event for real-time UI sync
      void realtimeEmitter.emitMangaUpdate({
        mangaId,
        action: 'updated',
        data: {
          comicVineEnrichmentCompleted: true,
          chaptersCreated: createdCount,
          chaptersUpdated: updatedCount,
          totalChapters: issues.length,
          source: 'chapter-enrichment-service'
        }
      });

      return createSuccessResult({
        createdCount,
        updatedCount,
        totalChapters: issues.length
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error enriching ComicVine chapters:`, error);
      return createErrorResult(new Error(`Failed to enrich ComicVine chapters: ${errorMessage}`));
    }
  }

  /**
   * Enrich chapter metadata from Fandom
   *
   * Fetches and parses volume/chapter tables from Fandom wiki pages.
   * Creates/updates Chapter records with volume assignments.
   *
   * @param input - Enrichment input with manga ID
   * @returns AsyncResult with enrichment statistics
   */
  async enrichFromFandom(
    input: EnrichChaptersInput
  ): Promise<AsyncResult<EnrichChaptersResult>> {
    this.logger.info(`[DEBUG] 🎬 enrichFromFandom called for manga ${input.mangaId}`);

    try {
      const { mangaId } = input;

      // Get manga from database
      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        include: {
          Metadata: true,
          Chapter: true
        }
      });

      if (!manga) {
        return createErrorResult(new ValidationError(`Manga with ID ${mangaId} not found`));
      }

      this.logger.info(`[DEBUG] 📖 Manga found: ${manga.title}, ${manga.Chapter.length} existing chapters`);
      this.logger.info(`Enriching chapter metadata from Fandom for manga: ${manga.title} (ID: ${mangaId})`);

      // IMPORTANT: If chapters already exist with proper volume assignments, don't recreate them
      if (manga.Chapter.length > 0) {
        const hasVolumeAssignments = manga.Chapter.some((ch) => ch.volume && ch.volume > 0);
        this.logger.info(
          `[DEBUG] 🔍 Existing chapters check: ${manga.Chapter.length} chapters, hasVolumeAssignments=${hasVolumeAssignments}`
        );

        if (hasVolumeAssignments) {
          this.logger.warn(`[DEBUG] ⚠️ SKIPPING enrichment: Manga already has chapters with volume assignments`);
          this.logger.info(
            `Manga ${manga.title} already has ${manga.Chapter.length} chapters with volume assignments. Skipping enrichment to preserve existing data.`
          );
          return createSuccessResult({
            createdCount: 0,
            updatedCount: 0,
            totalChapters: manga.Chapter.length
          });
        }

        this.logger.info(`[DEBUG] ✅ Proceeding with enrichment: No volume assignments found in existing chapters`);
      } else {
        this.logger.info(`[DEBUG] ✅ Proceeding with enrichment: No existing chapters (${manga.Chapter.length})`);
      }

      // Try to get enhanced data from Fandom
      const storedUrls = manga.Metadata?.urls ?? [];
      const fandomUrl = storedUrls.find((url) => url.includes('fandom.com'));

      if (!fandomUrl) {
        this.logger.warn(`No Fandom URL found for manga ${manga.title}`);
        return createErrorResult(new Error(`No Fandom URL found for manga: ${manga.title}`));
      }

      this.logger.info(`Found stored Fandom URL: ${fandomUrl}`);

      // Fetch the page content
      const response = await axios.get(fandomUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const html = response.data as string;

      // Parse volume tables using the enhanced parser (✅ FIXED: Restored real implementation!)
      const volumes = parseVolumeTables(html);

      if (volumes.length === 0) {
        this.logger.warn(`No volumes parsed from Fandom URL for ${manga.title}`);
        return createErrorResult(new Error(`No volumes found in Fandom page for: ${manga.title}`));
      }

      this.logger.info(`Successfully parsed ${volumes.length} volumes from Fandom URL for ${manga.title}`);

      // Deduplicate volumes by volume number
      const uniqueVolumes = volumes.filter((vol: unknown, index: number, self: unknown[]) => {
        if (!isRecord(vol)) return false;
        return index === self.findIndex((v: unknown) => isRecord(v) && safeGet(v, 'number') === safeGet(vol, 'number'));
      });

      // Store volume metadata in the database
      if (manga.metadataId) {
        const volumeMetadata = {
          volumes: uniqueVolumes.length,
          chapters: uniqueVolumes.reduce((total: number, vol: unknown) => {
            if (!isRecord(vol)) return total;
            const chapters = safeGet(vol, 'chapters');
            return total + (Array.isArray(chapters) ? chapters.length : 0);
          }, 0)
        };

        await prisma.metadata.update({
          where: { id: manga.metadataId },
          data: volumeMetadata
        });

        this.logger.info(`Updated metadata: ${volumeMetadata.volumes} volumes, ${volumeMetadata.chapters} chapters`);
      }

      // Store parsed volume data in providerMetadata for display
      const fandomProviderData = {
        providerId: 'fandom',
        externalId: manga.title.replace(/ /g, '_'),
        metadata: {
          volumeData: uniqueVolumes.map((v: unknown) => {
            if (!isRecord(v)) return {};
            const chapters = safeGet(v, 'chapters');
            return {
              number: safeGet(v, 'number'),
              title: safeGet(v, 'title'),
              chapterCount: Array.isArray(chapters) ? chapters.length : 0,
              chapters: Array.isArray(chapters)
                ? chapters.map((ch: unknown) => {
                    if (!isRecord(ch)) return {};
                    return {
                      number: safeGet(ch, 'chapterNumber') ?? safeGet(ch, 'number'),
                      title: safeGet(ch, 'title')
                    };
                  })
                : []
            };
          }),
          url: fandomUrl,
          totalVolumes: uniqueVolumes.length,
          totalChapters: uniqueVolumes.reduce((total: number, vol: unknown) => {
            if (!isRecord(vol)) return total;
            const chapters = safeGet(vol, 'chapters');
            return total + (Array.isArray(chapters) ? chapters.length : 0);
          }, 0)
        }
      };

      // Update providerMetadata
      const existingProviderMetadata = manga.providerMetadata ?? [];
      const providerMetadataArray = Array.isArray(existingProviderMetadata)
        ? existingProviderMetadata
        : [existingProviderMetadata];

      // Remove any existing fandom provider data
      const filteredMetadata = providerMetadataArray.filter(
        (p: unknown) => !(isRecord(p) && safeGet(p, 'providerId') === 'fandom')
      );
      filteredMetadata.push(fandomProviderData as never);

      await prisma.manga.update({
        where: { id: manga.id },
        data: {
          providerMetadata: filteredMetadata as unknown as Prisma.InputJsonValue
        }
      });

      const totalChapters = uniqueVolumes.reduce((total: number, vol: unknown) => {
        if (!isRecord(vol)) return total;
        const chapters = safeGet(vol, 'chapters');
        return total + (Array.isArray(chapters) ? chapters.length : 0);
      }, 0);

      this.logger.info(
        `Successfully enriched chapter metadata from Fandom for ${manga.title}. Parsed ${uniqueVolumes.length} volumes.`
      );

      // Emit WebSocket event for real-time UI sync
      void realtimeEmitter.emitMangaUpdate({
        mangaId,
        action: 'updated',
        data: {
          fandomEnrichmentCompleted: true,
          volumesParsed: uniqueVolumes.length,
          totalChapters,
          source: 'chapter-enrichment-service'
        }
      });

      return createSuccessResult({
        createdCount: 0, // Fandom enrichment doesn't create chapters, just updates metadata
        updatedCount: 0,
        totalChapters
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error enriching Fandom chapters:`, error);
      return createErrorResult(new Error(`Failed to enrich Fandom chapters: ${errorMessage}`));
    }
  }

  /**
   * Extract ID from ComicVine data structure
   */
  private extractIdFromComicVineData(comicVineData: Record<string, unknown>): string | null {
    const externalId = safeGet(comicVineData, 'externalId');
    if (externalId && typeof externalId === 'string') {
      return externalId;
    }

    const metadata = safeGet(comicVineData, 'metadata');
    if (metadata && isRecord(metadata)) {
      const id = safeGet(metadata, 'id');
      if (id) {
        return toStringId(id);
      }
    }

    return null;
  }

  /**
   * Extract ComicVine volume ID from provider metadata
   */
  private extractComicVineVolumeId(providerMetadata: unknown): string | null {
    try {
      if (!providerMetadata || typeof providerMetadata !== 'object') {
        return null;
      }

      // Check if provider metadata is an array (new format)
      if (Array.isArray(providerMetadata) && providerMetadata.length > 0) {
        const comicVineData: unknown = providerMetadata.find(
          (p: unknown) => isRecord(p) && safeGet(p, 'providerId') === 'comicvine'
        );

        if (comicVineData && isRecord(comicVineData)) {
          const id = this.extractIdFromComicVineData(comicVineData);
          if (id) {
            return id;
          }
        }
      }

      // Check if provider metadata is an object (old format)
      if (isRecord(providerMetadata)) {
        const id = safeGet(providerMetadata, 'id');
        if (id) {
          return toStringId(id);
        }
      }

      return null;
    } catch (error: unknown) {
      this.logger.error('Error extracting ComicVine volume ID:', error);
      return null;
    }
  }

  /**
   * Fetch issues from ComicVine API
   */
  private async fetchComicVineIssues(volumeId: string): Promise<Array<Record<string, unknown>> | null> {
    try {
      // Use the ComicVine client to get issues
      const { FullyProtectedComicVineClient } = await import('../comicvine/modules/fullyProtectedClient');
      const { ConfigService } = await import('../config/configService');
      const configService = new ConfigService();

      // Get ComicVine API key from config
      const apiKey = await configService.get<string>('metadataProviders.providers.comicvine.settings.apiKey');

      if (!apiKey) {
        this.logger.error('ComicVine API key not configured');
        return null;
      }

      const client = new FullyProtectedComicVineClient({ apiKey });

      const issuesResult = await client.request({
        path: `volume/4050-${volumeId}/`,
        params: { format: 'json' },
        fields: ['issues']
      });

      if (!('data' in issuesResult) || !issuesResult.data) {
        this.logger.error('Failed to fetch issues from ComicVine');
        return null;
      }

      const data = issuesResult.data as Record<string, unknown>;
      const issues = safeGet(data, 'issues');

      return Array.isArray(issues) ? (issues as Array<Record<string, unknown>>) : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching ComicVine issues: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Parse chapter number from issue number
   */
  private parseChapterNumber(issueNumber: unknown): number {
    if (typeof issueNumber === 'number') {
      return issueNumber;
    }

    if (typeof issueNumber === 'string') {
      const parsed = parseInt(issueNumber, 10);
      return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
  }

  /**
   * Extract title from issue data
   */
  private extractTitle(issue: Record<string, unknown>): string | null {
    const title = safeGet(issue, 'title');
    return typeof title === 'string' ? title : null;
  }

  /**
   * Extract cover image from issue data
   */
  private extractCoverImage(issue: Record<string, unknown>): string | null {
    const coverImage = safeGet(issue, 'coverImage');
    return typeof coverImage === 'string' ? coverImage : null;
  }

  /**
   * Extract description from issue data
   */
  private extractDescription(issue: Record<string, unknown>): string | null {
    const description = safeGet(issue, 'description');
    return typeof description === 'string' ? description : null;
  }

  /**
   * Extract page count from issue data
   */
  private extractPageCount(issue: Record<string, unknown>): number | null {
    const pageCount = safeGet(issue, 'pageCount');
    return typeof pageCount === 'number' ? pageCount : null;
  }
}

/**
 * Get singleton instance of ChapterEnrichmentService
 */
let chapterEnrichmentServiceInstance: ChapterEnrichmentService | null = null;

export function getChapterEnrichmentService(): ChapterEnrichmentService {
  chapterEnrichmentServiceInstance ??= new ChapterEnrichmentService();
  return chapterEnrichmentServiceInstance;
}

/**
 * Export singleton instance
 */
export const chapterEnrichmentService = getChapterEnrichmentService();
