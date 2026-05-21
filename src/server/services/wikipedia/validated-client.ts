/**
 * Type-Safe Wikipedia Client with Zod Validation
 *
 * This module wraps the existing Wikipedia service with Zod schema validation,
 * providing runtime type safety for all Wikipedia API responses.
 *
 * @module server/services/wikipedia/validated-client
 */

import { TRPCError } from '@trpc/server';

import {
  WikipediaMangaDataSchema,
  WikipediaParseResultSchema,
  WikipediaSearchResultSchema,
  type WikipediaMangaDataValidated,
  type WikipediaParseResultValidated,
  type WikipediaSearchResultValidated,
} from '@/lib/schemas/wikipedia';
import { logger } from '@/utils/logger';

import { wikipediaService } from './wikipedia/service';

import type { WikipediaParserOptions } from './adaptive';

// ============================================================================
// Helper Functions
// ============================================================================

function validateMangaData(
  rawResponse: unknown,
  context: string
): WikipediaMangaDataValidated | null {
  const parseResult = WikipediaMangaDataSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    logger.error('[ValidatedWikipediaClient] Validation failed', {
      context,
      errors: parseResult.error.errors,
      rawResponse: JSON.stringify(rawResponse).substring(0, 500),
    });
    return null;
  }

  return parseResult.data;
}

function validateSearchResultItem(item: unknown): WikipediaSearchResultValidated | null {
  const parseResult = WikipediaSearchResultSchema.safeParse(item);
  return parseResult.success ? parseResult.data : null;
}

function createErrorParseResult(errorMessage: string): WikipediaParseResultValidated {
  return {
    success: false,
    data: null,
    volumes: [],
    chapters: [],
    error: errorMessage,
    pageType: null,
    structureType: null,
  };
}

function handleError(error: unknown, context: string): void {
  logger.error(`[ValidatedWikipediaClient] ${context}`, {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
}

// ============================================================================
// Validated Wikipedia Client
// ============================================================================

export const validatedWikipediaClient = {
  /**
   * Get detailed manga information (type-safe)
   */
  async getMangaDetails(title: string): Promise<WikipediaMangaDataValidated> {
    logger.info(`[ValidatedWikipediaClient] Fetching details for: "${title}"`);

    const rawResponse: unknown = await wikipediaService.getMangaInfo(title);

    if (!rawResponse) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No Wikipedia page found for "${title}"`,
      });
    }

    const validated = validateMangaData(rawResponse, `getMangaDetails: ${title}`);

    if (!validated) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Invalid response from Wikipedia API',
      });
    }

    return validated;
  },

  /**
   * Search for manga (type-safe)
   */
  async searchManga(query: string): Promise<WikipediaSearchResultValidated[]> {
    logger.info(`[ValidatedWikipediaClient] Searching for: "${query}"`);

    const rawResponse: unknown = await wikipediaService.searchManga(query);

    if (!Array.isArray(rawResponse)) {
      return [];
    }

    const results: WikipediaSearchResultValidated[] = [];

    for (const item of rawResponse) {
      const validated = validateSearchResultItem(item);
      if (validated) {
        results.push(validated);
      }
    }

    return results;
  },

  /**
   * Find best matching Wikipedia page (type-safe)
   */
  async findBestMatch(title: string): Promise<WikipediaMangaDataValidated | null> {
    logger.info(`[ValidatedWikipediaClient] Finding best match for: "${title}"`);

    const rawResponse: unknown = await wikipediaService.findBestMatch(title);

    if (!rawResponse) {
      return null;
    }

    return validateMangaData(rawResponse, `findBestMatch: ${title}`);
  },

  /**
   * Adaptive extraction with validation (type-safe)
   */
  async getAdaptiveResult(
    titleOrUrl: string,
    options: Partial<WikipediaParserOptions> = {}
  ): Promise<WikipediaParseResultValidated> {
    logger.info(`[ValidatedWikipediaClient] Adaptive extraction for: "${titleOrUrl}"`);

    const rawResponse: unknown = await wikipediaService.getAdaptiveMangaInfo(titleOrUrl, options);
    const parseResult = WikipediaParseResultSchema.safeParse(rawResponse);

    if (!parseResult.success) {
      handleError(parseResult.error, `Validation failed for: ${titleOrUrl}`);
      return createErrorParseResult('Validation failed: ' + parseResult.error.message);
    }

    return parseResult.data;
  },

  /**
   * Raw data validation (advanced)
   */
  validateData<T>(
    data: unknown,
    schema: { safeParse: (d: unknown) => { success: boolean; data?: T; error?: { message: string } } }
  ): T | null {
    const parseResult = schema.safeParse(data);

    if (!parseResult.success) {
      handleError(parseResult.error, 'Custom validation failed');
      return null;
    }

    return parseResult.data ?? null;
  },
};

export { wikipediaService };
