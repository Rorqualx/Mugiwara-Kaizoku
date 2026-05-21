/**
 * Fandom Tool
 *
 * Wraps adaptive parser orchestrator for AI agent tool calling.
 * Provides Fandom wiki discovery and parsing for manga metadata.
 */

import { adaptiveParse } from '@/server/services/fandom/adaptive';
import type { AdaptiveParserOptions, AdaptiveParseResult } from '@/server/services/fandom/adaptive';
import { fandomSearchService } from '@/server/services/fandom/fandomSearchService';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgentTool } from '../agent-core/types';

const log = logger.child('FandomTool');

/**
 * Parameters for the Fandom enrichment tool
 */
interface FandomToolParams {
  /** Manga title to search for (optional if url provided) */
  title?: string;
  /** Direct Fandom wiki URL (optional if title provided) */
  url?: string;
  /** Optional adaptive parser configuration */
  options?: Partial<AdaptiveParserOptions>;
}

/**
 * Validate tool parameters
 */
function validateParams(params: unknown): AsyncResult<FandomToolParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const { title, url, options } = params as Partial<FandomToolParams>;

  if (!title && !url) {
    return createErrorResult(new Error('Either title or url parameter is required'));
  }

  if (title && typeof title !== 'string') {
    return createErrorResult(new Error('Title parameter must be a string'));
  }

  if (url && typeof url !== 'string') {
    return createErrorResult(new Error('URL parameter must be a string'));
  }

  if (options && typeof options !== 'object') {
    return createErrorResult(new Error('Options parameter must be an object'));
  }

  const result: FandomToolParams = {};
  if (title !== undefined) result.title = title;
  if (url !== undefined) result.url = url;
  if (options !== undefined) result.options = options;
  return createSuccessResult(result);
}

/**
 * Search for Fandom wiki URL by title
 */
async function discoverWikiUrl(title: string): Promise<AsyncResult<string, Error>> {
  log.info('Searching for Fandom wiki', { title });

  try {
    const searchResult = await fandomSearchService.searchAllWikis(title);

    if (!isSuccess(searchResult)) {
      // Could be idle, loading, or error
      if (isError(searchResult)) {
        return createErrorResult(new Error(`Search failed: ${searchResult.error.message}`));
      }
      return createErrorResult(new Error(`Search result in unexpected state: ${searchResult.status}`));
    }

    const { results } = searchResult.data;
    if (results.length === 0) {
      return createErrorResult(new Error(`No Fandom wiki found for title: ${title}`));
    }

    // Use the first result (highest score)
    const bestResult = results[0];
    if (!bestResult) {
      return createErrorResult(new Error('Unexpected empty results array'));
    }
    const wikiUrl = bestResult.url;

    log.info('Fandom wiki discovered', { title, wikiUrl, resultCount: results.length });
    return createSuccessResult(wikiUrl);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Fandom wiki discovery failed', { error: err, title });
    return createErrorResult(err);
  }
}

/**
 * Execute adaptive parse on a wiki URL
 */
async function executeAdaptiveParse(
  url: string,
  options?: Partial<AdaptiveParserOptions>
): Promise<AsyncResult<AdaptiveParseResult, Error>> {
  log.info('Executing adaptive parse', { url, hasOptions: !!options });

  try {
    const result = await adaptiveParse(url, options);

    log.info('Adaptive parse completed', {
      url,
      success: result.success,
      structureType: result.structureType,
      confidence: result.confidence,
      usedCache: result.usedCache,
      usedLegacyFallback: result.usedLegacyFallback,
      durationMs: result.durationMs,
      chapterCount: result.data?.chapterList?.length ?? 0,
      volumeCount: result.data?.volumeList?.length ?? 0,
    });

    return createSuccessResult(result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Adaptive parse failed', { error: err, url });
    return createErrorResult(err);
  }
}

/**
 * Execute enrichment and format result
 */
async function executeEnrichment(params: FandomToolParams): Promise<AsyncResult<unknown, Error>> {
  const { title, url, options } = params;

  let targetUrl = url;

  // If title provided but no URL, discover wiki URL
  if (title && !targetUrl) {
    const discoveryResult = await discoverWikiUrl(title);
    if (isError(discoveryResult)) {
      return createErrorResult(discoveryResult.error);
    }
    if (!isSuccess(discoveryResult)) {
      return createErrorResult(new Error(`Discovery result in unexpected state: ${discoveryResult.status}`));
    }
    targetUrl = discoveryResult.data;
  }

  if (!targetUrl) {
    return createErrorResult(new Error('No URL available for parsing'));
  }

  // Execute adaptive parse
  const parseResult = await executeAdaptiveParse(targetUrl, options);
  if (isError(parseResult)) {
    return createErrorResult(parseResult.error);
  }
  if (!isSuccess(parseResult)) {
    return createErrorResult(new Error(`Parse result in unexpected state: ${parseResult.status}`));
  }

  const result = parseResult.data;

  // Return a simplified version for the agent
  const simplifiedResult = {
    success: result.success,
    data: result.data,
    structureType: result.structureType,
    confidence: result.confidence,
    usedCache: result.usedCache,
    usedLegacyFallback: result.usedLegacyFallback,
    parsedUrl: result.parsedUrl,
    domain: result.domain,
    durationMs: result.durationMs,
    error: result.error,
  };

  return createSuccessResult(simplifiedResult);
}

/**
 * Fandom enrichment tool
 */
export const fandomTool: AgentTool = {
  name: 'fandom_enrichment',
  description: 'Fetch manga metadata from Fandom wikis using adaptive parser. Discovers wiki URL from title or accepts direct URL. Returns parsed manga data with chapter/volume lists.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Manga title to search for (optional if url provided)',
      },
      url: {
        type: 'string',
        description: 'Direct Fandom wiki URL (optional if title provided)',
      },
      options: {
        type: 'object',
        description: 'Optional adaptive parser configuration',
        additionalProperties: true,
      },
    },
    additionalProperties: false,
  } as const,
  async execute(params: unknown): Promise<AsyncResult<unknown, Error>> {
    // Validate parameters
    const validationResult = validateParams(params);
    if (isError(validationResult)) {
      log.error('Parameter validation failed', { error: validationResult.error });
      return validationResult;
    }
    if (!isSuccess(validationResult)) {
      return createErrorResult(new Error(`Validation result in unexpected state: ${validationResult.status}`));
    }

    // Execute enrichment
    return executeEnrichment(validationResult.data);
  },
};