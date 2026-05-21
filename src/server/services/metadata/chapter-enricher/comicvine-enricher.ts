/**
 * ComicVine Chapter Enricher
 *
 * Fetches and persists chapter/issue metadata from ComicVine API.
 * Handles ComicVine-specific data extraction and normalization.
 *
 * This module:
 * - Extracts ComicVine volume IDs from provider metadata
 * - Fetches issues using the ComicVine API client
 * - Creates new chapter records for issues
 * - Updates existing chapter records with enriched metadata
 * - Handles parallel database operations for optimal performance
 * - Returns AsyncResult for type-safe error handling
 *
 * Extracted from: chapter-enricher.ts (lines 99-224, 413-545)
 *
 * @module ComicVineEnricher
 */


import { ChapterStatus, type Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { searchProviderRegistry } from '@/server/services/search/registerProviders';
import { createSuccessResult, createErrorResult, type AsyncResult } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { toStringId, toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { isRecord, safeGet, type EnrichChaptersInput, type EnrichChaptersResult, type ChapterCreateInput } from './types';

/**
 * ComicVine Chapter Enricher
 *
 * Responsible for fetching and persisting chapter/issue metadata from ComicVine API.
 */
export class ComicVineEnricher {
  private logger = logger.child('ComicVineEnricher', {
    module: 'ComicVineEnricher'
  });

  /**
   * Enrich chapter metadata from ComicVine
   *
   * Fetches issues from ComicVine API and creates/updates Chapter records.
   * Only works for manga with source='comicvine'.
   *
   * ESLint fixes applied:
   * - Line 167, 194: Parallelized database operations (no-await-in-loop)
   * - Line 421: Fixed unsafe assignment to any
   * - Line 483: Removed unnecessary condition
   *
   * @param input - Enrichment input with manga ID
   * @returns AsyncResult with enrichment statistics
   */
  async enrichFromComicVine(
    input: EnrichChaptersInput
  ): Promise<AsyncResult<EnrichChaptersResult, Error>> {
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

      // ✅ ESLint Fix (lines 167, 194): Parallelize database operations
      // Separate updates and creates for parallel execution

      // Build update operations for existing chapters
      const updateOps = issues
        .map((issue) => {
          const chapterNumber = this.parseChapterNumber(issue['issueNumber']);
          const existingChapter = manga.Chapter.find((ch) => ch.index === chapterNumber);

          if (!existingChapter) {
            return null;
          }

          return {
            chapter: existingChapter,
            data: {
              title: this.extractTitle(issue) ?? existingChapter.title,
              downloadUrl: this.extractCoverImage(issue) ?? existingChapter.downloadUrl,
              coverImage: this.extractCoverImage(issue) ?? existingChapter.coverImage,
              description: this.extractDescription(issue) ?? existingChapter.description,
              pageCount: this.extractPageCount(issue) ?? existingChapter.pageCount
            }
          };
        })
        .filter((op): op is NonNullable<typeof op> => op !== null);

      // Build create operations for new chapters
      const createOps = issues
        .map((issue) => {
          const chapterNumber = this.parseChapterNumber(issue['issueNumber']);
          const existingChapter = manga.Chapter.find((ch) => ch.index === chapterNumber);

          if (existingChapter) {
            return null;
          }

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

          return createData;
        })
        .filter((op): op is NonNullable<typeof op> => op !== null);

      // Execute all operations in parallel
      const updatePromises = updateOps.map(async (op) => {
        await prisma.chapter.update({
          where: { id: op.chapter.id },
          data: op.data
        });
        this.logger.debug(`Updated chapter ${op.chapter.index} with ComicVine data`);
      });

      const createPromises = createOps.map(async (createData) => {
        await prisma.chapter.create({
          data: createData as unknown as Prisma.ChapterCreateInput
        });
        this.logger.debug(`Created chapter ${createData.index}: ${createData.title}`);
      });

      await Promise.all([...updatePromises, ...createPromises]);

      const createdCount = createOps.length;
      const updatedCount = updateOps.length;

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
          source: 'comicvine-enricher'
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
   * Extract ComicVine volume ID from provider metadata
   *
   * Handles both array format (new) and object format (legacy).
   *
   * ESLint fix applied:
   * - Line 421: Fixed unsafe assignment to any by using proper type guards
   *
   * @param providerMetadata - Provider metadata from manga record
   * @returns ComicVine volume ID or null if not found
   */
  private extractComicVineVolumeId(providerMetadata: unknown): string | null {
    try {
      if (!providerMetadata || typeof providerMetadata !== 'object') {
        return null;
      }

      // Check if provider metadata is an array (new format)
      if (Array.isArray(providerMetadata) && providerMetadata.length > 0) {
        // ✅ ESLint Fix (line 421): Use filter with type guard to avoid unsafe assignment
        const comicVineMatches = providerMetadata.filter(
          (p: unknown): p is Record<string, unknown> =>
            isRecord(p) && safeGet(p, 'providerId') === 'comicvine'
        );

        const comicVineData = comicVineMatches.length > 0 ? comicVineMatches[0] : null;

        if (comicVineData) {
          const volumeId = this.extractVolumeIdFromProviderData(comicVineData);
          if (volumeId) {
            return volumeId;
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
   * Extract volume ID from provider data object
   *
   * Helper method to reduce nesting in extractComicVineVolumeId.
   *
   * @param providerData - Provider data record
   * @returns Volume ID or null
   */
  private extractVolumeIdFromProviderData(providerData: Record<string, unknown>): string | null {
    // Try externalId first
    const externalId = safeGet(providerData, 'externalId');
    if (externalId && typeof externalId === 'string') {
      return externalId;
    }

    // Try nested metadata.id
    const metadata = safeGet(providerData, 'metadata');
    if (isRecord(metadata)) {
      const id = safeGet(metadata, 'id');
      if (id) {
        return toStringId(id);
      }
    }

    return null;
  }

  /**
   * Fetch issues from ComicVine API
   *
   * Uses the FullyProtectedComicVineClient to retrieve issue data.
   *
   * ESLint fix applied:
   * - Line 483: Removed unnecessary !issuesResult check (already checked by 'data' in issuesResult)
   *
   * @param volumeId - ComicVine volume ID
   * @returns Array of issue records or null if fetch fails
   */
  private async fetchComicVineIssues(volumeId: string): Promise<Array<Record<string, unknown>> | null> {
    try {
      // Use the ComicVine client to get issues
      const { FullyProtectedComicVineClient } = await import('@/server/services/comicvine/modules/fullyProtectedClient');
      const { ConfigService } = await import('@/server/services/config/configService');
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

      // ✅ ESLint Fix (line 483): Remove redundant !issuesResult check
      // The 'data' in issuesResult check already ensures issuesResult is truthy
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
   *
   * Handles numeric and string issue numbers, defaulting to 0 for invalid values.
   *
   * @param issueNumber - Issue number from ComicVine API
   * @returns Parsed chapter number
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
   *
   * @param issue - Issue record from ComicVine API
   * @returns Title string or null
   */
  private extractTitle(issue: Record<string, unknown>): string | null {
    const title = safeGet(issue, 'title');
    return typeof title === 'string' ? title : null;
  }

  /**
   * Extract cover image from issue data
   *
   * @param issue - Issue record from ComicVine API
   * @returns Cover image URL or null
   */
  private extractCoverImage(issue: Record<string, unknown>): string | null {
    const coverImage = safeGet(issue, 'coverImage');
    return typeof coverImage === 'string' ? coverImage : null;
  }

  /**
   * Extract description from issue data
   *
   * @param issue - Issue record from ComicVine API
   * @returns Description string or null
   */
  private extractDescription(issue: Record<string, unknown>): string | null {
    const description = safeGet(issue, 'description');
    return typeof description === 'string' ? description : null;
  }

  /**
   * Extract page count from issue data
   *
   * @param issue - Issue record from ComicVine API
   * @returns Page count or null
   */
  private extractPageCount(issue: Record<string, unknown>): number | null {
    const pageCount = safeGet(issue, 'pageCount');
    return typeof pageCount === 'number' ? pageCount : null;
  }
}

/**
 * Singleton instance
 */
export const comicVineEnricher = new ComicVineEnricher();
