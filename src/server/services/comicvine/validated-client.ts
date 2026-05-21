/**
 * Type-Safe ComicVine Client with Zod Validation
 *
 * This module wraps the existing ComicVine service with Zod schema validation,
 * providing runtime type safety for all ComicVine API responses.
 *
 * @module server/services/comicvine/validated-client
 */

import { TRPCError } from '@trpc/server';

import {
  ComicVineVolumeSchema,
  ComicVineIssueSchema,
  ComicVineSearchResultSchema,
  ComicVineVolumeResponseSchema,
  ComicVineIssueListResponseSchema,
  ComicVineSearchResponseSchema,
  type ComicVineVolumeValidated,
  type ComicVineIssueValidated,
  type ComicVineSearchResultValidated,
} from '@/lib/schemas/comicvine';
import { logger } from '@/utils/logger';

import { comicvineService } from './service';

// ============================================================================
// Helper Functions
// ============================================================================

function validateVolume(
  rawResponse: unknown,
  context: string
): ComicVineVolumeValidated | null {
  const parseResult = ComicVineVolumeSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    logger.error('[ValidatedComicVineClient] Volume validation failed', {
      context,
      errors: parseResult.error.errors,
      rawResponse: JSON.stringify(rawResponse).substring(0, 500),
    });
    return null;
  }

  return parseResult.data;
}

function validateIssue(
  rawResponse: unknown,
  context: string
): ComicVineIssueValidated | null {
  const parseResult = ComicVineIssueSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    logger.error('[ValidatedComicVineClient] Issue validation failed', {
      context,
      errors: parseResult.error.errors,
      rawResponse: JSON.stringify(rawResponse).substring(0, 500),
    });
    return null;
  }

  return parseResult.data;
}

function validateSearchResult(item: unknown): ComicVineSearchResultValidated | null {
  const parseResult = ComicVineSearchResultSchema.safeParse(item);
  return parseResult.success ? parseResult.data : null;
}

function handleError(error: unknown, context: string): void {
  logger.error(`[ValidatedComicVineClient] ${context}`, {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
}

// ============================================================================
// Validated ComicVine Client
// ============================================================================

export const validatedComicVineClient = {
  /**
   * Get detailed volume information (type-safe)
   */
  async getVolumeDetails(volumeId: number): Promise<ComicVineVolumeValidated> {
    logger.info(`[ValidatedComicVineClient] Fetching volume details for ID: ${volumeId}`);

    const rawResponse: unknown = await comicvineService.getCompleteVolumeInfo(volumeId);

    if (!rawResponse) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No ComicVine volume found for ID: ${volumeId}`,
      });
    }

    const validated = validateVolume(rawResponse, `getVolumeDetails: ${volumeId}`);

    if (!validated) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Invalid response from ComicVine API',
      });
    }

    return validated;
  },

  /**
   * Get basic volume information (type-safe)
   */
  async getBasicVolumeInfo(volumeId: number): Promise<ComicVineVolumeValidated | null> {
    logger.info(`[ValidatedComicVineClient] Fetching basic volume info for ID: ${volumeId}`);

    const rawResponse: unknown = await comicvineService.getBasicVolumeInfo(volumeId);

    if (!rawResponse) {
      return null;
    }

    return validateVolume(rawResponse, `getBasicVolumeInfo: ${volumeId}`);
  },

  /**
   * Search for volumes (type-safe)
   */
  async searchVolumes(query: string, limit = 10): Promise<ComicVineSearchResultValidated[]> {
    logger.info(`[ValidatedComicVineClient] Searching for: "${query}"`);

    const rawResponse: unknown = await comicvineService.searchBasicVolumes(query, 0, limit);

    if (!Array.isArray(rawResponse)) {
      return [];
    }

    const results: ComicVineSearchResultValidated[] = [];

    for (const item of rawResponse) {
      const validated = validateSearchResult(item);
      if (validated) {
        results.push(validated);
      }
    }

    return results;
  },

  /**
   * Get issues for a volume (type-safe)
   */
  async getVolumeIssues(volumeId: number, page = 0, limit = 100): Promise<ComicVineIssueValidated[]> {
    logger.info(`[ValidatedComicVineClient] Fetching issues for volume ID: ${volumeId}`);

    const rawResponse: unknown = await comicvineService.getVolumeIssues(volumeId, page, limit);

    if (!Array.isArray(rawResponse)) {
      return [];
    }

    const results: ComicVineIssueValidated[] = [];

    for (const item of rawResponse) {
      const validated = validateIssue(item, `getVolumeIssues: ${volumeId}`);
      if (validated) {
        results.push(validated);
      }
    }

    return results;
  },

  /**
   * Get all issues for a volume with pagination (type-safe)
   */
  async getAllVolumeIssues(volumeId: number): Promise<ComicVineIssueValidated[]> {
    logger.info(`[ValidatedComicVineClient] Fetching all issues for volume ID: ${volumeId}`);

    const rawResponse: unknown = await comicvineService.getAllVolumeIssues(volumeId);

    if (!Array.isArray(rawResponse)) {
      return [];
    }

    const results: ComicVineIssueValidated[] = [];

    for (const item of rawResponse) {
      const validated = validateIssue(item, `getAllVolumeIssues: ${volumeId}`);
      if (validated) {
        results.push(validated);
      }
    }

    return results;
  },

  /**
   * Get issue information (type-safe)
   */
  async getIssueInfo(issueId: number): Promise<ComicVineIssueValidated | null> {
    logger.info(`[ValidatedComicVineClient] Fetching issue info for ID: ${issueId}`);

    const rawResponse: unknown = await comicvineService.getIssueInfo(issueId);

    if (!rawResponse) {
      return null;
    }

    return validateIssue(rawResponse, `getIssueInfo: ${issueId}`);
  },

  /**
   * Validate API response with custom schema (advanced)
   */
  validateVolumeResponse(data: unknown): { success: boolean; data: ComicVineVolumeValidated | null; error: string | null } {
    const parseResult = ComicVineVolumeResponseSchema.safeParse(data);

    if (!parseResult.success) {
      handleError(parseResult.error, 'Volume response validation failed');
      return {
        success: false,
        data: null,
        error: parseResult.error.message,
      };
    }

    const volumeParseResult = ComicVineVolumeSchema.safeParse(parseResult.data.results);
    if (!volumeParseResult.success) {
      return {
        success: false,
        data: null,
        error: volumeParseResult.error.message,
      };
    }

    return {
      success: true,
      data: volumeParseResult.data,
      error: null,
    };
  },

  /**
   * Validate search response (advanced)
   */
  validateSearchResponse(data: unknown): { success: boolean; data: ComicVineSearchResultValidated[]; error: string | null } {
    const parseResult = ComicVineSearchResponseSchema.safeParse(data);

    if (!parseResult.success) {
      handleError(parseResult.error, 'Search response validation failed');
      return {
        success: false,
        data: [],
        error: parseResult.error.message,
      };
    }

    const validatedResults: ComicVineSearchResultValidated[] = [];
    for (const result of parseResult.data.results) {
      const validated = validateSearchResult(result);
      if (validated) {
        validatedResults.push(validated);
      }
    }

    return {
      success: true,
      data: validatedResults,
      error: null,
    };
  },

  /**
   * Validate issue list response (advanced)
   */
  validateIssueListResponse(data: unknown): { success: boolean; data: ComicVineIssueValidated[]; error: string | null } {
    const parseResult = ComicVineIssueListResponseSchema.safeParse(data);

    if (!parseResult.success) {
      handleError(parseResult.error, 'Issue list response validation failed');
      return {
        success: false,
        data: [],
        error: parseResult.error.message,
      };
    }

    const validatedResults: ComicVineIssueValidated[] = [];
    for (const result of parseResult.data.results) {
      const validated = validateIssue(result, 'validateIssueListResponse');
      if (validated) {
        validatedResults.push(validated);
      }
    }

    return {
      success: true,
      data: validatedResults,
      error: null,
    };
  },
};

// Re-export the service for convenience
export { comicvineService };
