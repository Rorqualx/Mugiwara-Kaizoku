/**
 * Type-Safe Fandom Client with Zod Validation
 *
 * This module wraps the existing Fandom service with Zod schema validation,
 * providing runtime type safety for all Fandom API responses.
 *
 * @module server/services/fandom/validated-client
 */

import { TRPCError } from '@trpc/server';

import {
  FandomMangaDataSchema,
  FandomSearchResultSchema,
  FandomCharacterDataSchema,
  FandomVolumeSchema,
  FandomChapterSchema,
  type FandomMangaDataValidated,
  type FandomSearchResultValidated,
  type FandomCharacterDataValidated,
  type FandomVolumeValidated,
  type FandomChapterValidated,
} from '@/lib/schemas/fandom';
import { logger } from '@/utils/logger';

import { fandomService } from './service';

// ============================================================================
// Helper Functions
// ============================================================================

function validateMangaData(
  rawResponse: unknown,
  context: string
): FandomMangaDataValidated | null {
  const parseResult = FandomMangaDataSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    logger.error('[ValidatedFandomClient] Manga data validation failed', {
      context,
      errors: parseResult.error.errors,
      rawResponse: JSON.stringify(rawResponse).substring(0, 500),
    });
    return null;
  }

  return parseResult.data;
}

function validateSearchResult(item: unknown): FandomSearchResultValidated | null {
  const parseResult = FandomSearchResultSchema.safeParse(item);
  return parseResult.success ? parseResult.data : null;
}

function validateCharacterData(
  rawResponse: unknown,
  context: string
): FandomCharacterDataValidated | null {
  const parseResult = FandomCharacterDataSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    logger.error('[ValidatedFandomClient] Character data validation failed', {
      context,
      errors: parseResult.error.errors,
      rawResponse: JSON.stringify(rawResponse).substring(0, 500),
    });
    return null;
  }

  return parseResult.data;
}

function validateVolume(item: unknown): FandomVolumeValidated | null {
  const parseResult = FandomVolumeSchema.safeParse(item);
  return parseResult.success ? parseResult.data : null;
}

function validateChapter(item: unknown): FandomChapterValidated | null {
  const parseResult = FandomChapterSchema.safeParse(item);
  return parseResult.success ? parseResult.data : null;
}

function handleError(error: unknown, context: string): void {
  logger.error(`[ValidatedFandomClient] ${context}`, {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
}

// ============================================================================
// Validated Fandom Client
// ============================================================================

export const validatedFandomClient = {
  /**
   * Get manga information (type-safe)
   */
  async getMangaInfo(title: string): Promise<FandomMangaDataValidated> {
    logger.info(`[ValidatedFandomClient] Fetching manga info for: "${title}"`);

    const rawResponse: unknown = await fandomService.getMangaInfo(title);

    if (!rawResponse) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No Fandom page found for "${title}"`,
      });
    }

    const validated = validateMangaData(rawResponse, `getMangaInfo: ${title}`);

    if (!validated) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Invalid response from Fandom API',
      });
    }

    return validated;
  },

  /**
   * Get manga information (returns null on not found)
   */
  async getMangaInfoOrNull(title: string): Promise<FandomMangaDataValidated | null> {
    logger.info(`[ValidatedFandomClient] Fetching manga info for: "${title}"`);

    const rawResponse: unknown = await fandomService.getMangaInfo(title);

    if (!rawResponse) {
      return null;
    }

    return validateMangaData(rawResponse, `getMangaInfoOrNull: ${title}`);
  },

  /**
   * Search for manga or characters (type-safe)
   */
  async search(
    query: string,
    options: {
      type?: 'all' | 'manga' | 'character';
      limit?: number;
      includeDetails?: boolean;
    } = {}
  ): Promise<FandomSearchResultValidated[]> {
    logger.info(`[ValidatedFandomClient] Searching for: "${query}"`);

    const rawResponse: unknown = await fandomService.search(query, options);

    if (!Array.isArray(rawResponse)) {
      return [];
    }

    const results: FandomSearchResultValidated[] = [];

    for (const item of rawResponse) {
      const validated = validateSearchResult(item);
      if (validated) {
        results.push(validated);
      }
    }

    return results;
  },

  /**
   * Get character information (type-safe)
   */
  async getCharacterInfo(title: string): Promise<FandomCharacterDataValidated | null> {
    logger.info(`[ValidatedFandomClient] Fetching character info for: "${title}"`);

    const rawResponse: unknown = await fandomService.getCharacterInfo(title);

    if (!rawResponse) {
      return null;
    }

    return validateCharacterData(rawResponse, `getCharacterInfo: ${title}`);
  },

  /**
   * Validate manga data externally
   */
  validateMangaData(data: unknown): { success: boolean; data: FandomMangaDataValidated | null; error: string | null } {
    const parseResult = FandomMangaDataSchema.safeParse(data);

    if (!parseResult.success) {
      handleError(parseResult.error, 'Manga data validation failed');
      return {
        success: false,
        data: null,
        error: parseResult.error.message,
      };
    }

    return {
      success: true,
      data: parseResult.data,
      error: null,
    };
  },

  /**
   * Validate search results externally
   */
  validateSearchResults(data: unknown[]): { success: boolean; data: FandomSearchResultValidated[]; invalidCount: number } {
    const validatedResults: FandomSearchResultValidated[] = [];
    let invalidCount = 0;

    for (const item of data) {
      const validated = validateSearchResult(item);
      if (validated) {
        validatedResults.push(validated);
      } else {
        invalidCount++;
      }
    }

    return {
      success: invalidCount === 0,
      data: validatedResults,
      invalidCount,
    };
  },

  /**
   * Validate volume list externally
   */
  validateVolumeList(data: unknown[]): { success: boolean; data: FandomVolumeValidated[]; invalidCount: number } {
    const validatedResults: FandomVolumeValidated[] = [];
    let invalidCount = 0;

    for (const item of data) {
      const validated = validateVolume(item);
      if (validated) {
        validatedResults.push(validated);
      } else {
        invalidCount++;
      }
    }

    return {
      success: invalidCount === 0,
      data: validatedResults,
      invalidCount,
    };
  },

  /**
   * Validate chapter list externally
   */
  validateChapterList(data: unknown[]): { success: boolean; data: FandomChapterValidated[]; invalidCount: number } {
    const validatedResults: FandomChapterValidated[] = [];
    let invalidCount = 0;

    for (const item of data) {
      const validated = validateChapter(item);
      if (validated) {
        validatedResults.push(validated);
      } else {
        invalidCount++;
      }
    }

    return {
      success: invalidCount === 0,
      data: validatedResults,
      invalidCount,
    };
  },

  /**
   * Validate raw data with custom schema (advanced)
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

// Re-export the service for convenience
export { fandomService };
