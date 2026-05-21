/**
 * Fandom Chapter Enricher
 *
 * Parses and persists volume/chapter metadata from Fandom wiki pages.
 * Handles Fandom-specific HTML parsing and volume data extraction.
 *
 * Key responsibilities:
 * - Fetches HTML content from Fandom wiki URLs
 * - Parses volume/chapter tables using adaptive parser (parsePageAdaptive)
 * - Stores volume metadata in database
 * - Updates providerMetadata with structured volume data
 * - Prevents duplicate enrichment when volume assignments exist
 *
 * Extracted from: chapter-enricher.ts (lines 235-408)
 */

import axios from 'axios';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { parsePageAdaptive } from '../utils/fandomTableParser';

import { isRecord, safeGet } from './types';

import type { EnrichChaptersInput, EnrichChaptersResult } from './types';
import type { Prisma } from '@prisma/client';

/**
 * Fandom Chapter Enricher Class
 *
 * Handles enrichment of chapter metadata from Fandom wiki pages.
 */
export class FandomEnricher {
  private logger = logger.child('FandomEnricher', {
    module: 'FandomEnricher'
  });

  /**
   * Enrich chapter metadata from Fandom
   *
   * Fetches and parses volume/chapter tables from Fandom wiki pages.
   * Creates/updates Chapter records with volume assignments.
   *
   * Flow:
   * 1. Fetch manga with existing chapters
   * 2. Skip if volume assignments already exist (prevents duplicate enrichment)
   * 3. Fetch HTML from Fandom URL
   * 4. Parse volume tables
   * 5. Update metadata with volume/chapter counts
   * 6. Store structured volume data in providerMetadata
   *
   * @param input - Enrichment input with manga ID
   * @returns AsyncResult with enrichment statistics
   */
  async enrichFromFandom(
    input: EnrichChaptersInput
  ): Promise<AsyncResult<EnrichChaptersResult, Error>> {
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

      // ✅ FIX: Removed unnecessary ?? 0 (Array.length is never null/undefined)
      this.logger.info(`[DEBUG] 📖 Manga found: ${manga.title}, ${manga.Chapter.length} existing chapters`);
      this.logger.info(`Enriching chapter metadata from Fandom for manga: ${manga.title} (ID: ${mangaId})`);

      // IMPORTANT: If chapters already exist with proper volume assignments, don't recreate them
      // ✅ FIX: Removed unnecessary manga.Chapter check (already checked by length > 0)
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
        // ✅ FIX: Removed unnecessary ?? 0 (Array.length is never null/undefined)
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

      // Extract wiki base URL for resolving relative links
      const wikiBaseUrl = new URL(fandomUrl).origin;

      // Parse volume tables using the adaptive parser (selects best strategy based on structure)
      const { volumes } = parsePageAdaptive(html, undefined, undefined, wikiBaseUrl);

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
          source: 'fandom-enricher'
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
}

/**
 * Singleton instance
 */
export const fandomEnricher = new FandomEnricher();
