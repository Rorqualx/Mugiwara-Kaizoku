/**
 * Wiki Scrape Tool
 *
 * AI-directed URL scraping for remediation.
 * Wraps the adaptive parser with a direct URL input,
 * allowing the AI agent to scrape specific wiki pages
 * when discovery-based approaches fail.
 */

import { adaptiveParse } from '@/server/services/fandom/adaptive';
import { directChapterExtract } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wiki-discovery';
import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgentTool } from '../agent-core/types';

const log = logger.child('WikiScrapeTool');

/** Maximum raw HTML size returned (10KB) */
const MAX_RAW_HTML_SIZE = 10240;

interface WikiScrapeParams {
  url: string;
  returnRawHtml?: boolean;
}

function validateParams(params: unknown): AsyncResult<WikiScrapeParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const { url, returnRawHtml } = params as Partial<WikiScrapeParams>;
  if (!url || typeof url !== 'string') {
    return createErrorResult(new Error('URL parameter is required and must be a string'));
  }

  return createSuccessResult({
    url,
    returnRawHtml: returnRawHtml === true,
  });
}

/** Build response object from adaptive parse result */
function buildScrapeResponse(
  result: { success: boolean; data?: { chapterList?: unknown[]; volumeList?: unknown[] } | null; confidence: number; structureType?: string; rawHtml?: string },
  returnRawHtml: boolean,
): Record<string, unknown> {
  const parsed = result.success && result.data ? {
    chapterList: result.data.chapterList ?? [],
    volumeList: result.data.volumeList ?? [],
  } : null;

  const response: Record<string, unknown> = {
    parsed,
    parseSuccess: result.success,
    confidence: result.confidence,
    structureType: result.structureType,
  };

  if (returnRawHtml && result.rawHtml) {
    response['rawHtmlSnippet'] = result.rawHtml.slice(0, MAX_RAW_HTML_SIZE);
  }

  return response;
}

/** Try direct chapter extraction when adaptive parser fails */
async function tryDirectFallback(
  url: string,
  returnRawHtml: boolean,
): Promise<Record<string, unknown> | null> {
  const directChapters = await directChapterExtract(url);
  if (directChapters.length === 0) return null;

  log.info('Adaptive parser failed, direct extraction succeeded', {
    url, chapters: directChapters.length,
  });
  const fallbackResult = {
    success: true,
    data: { chapterList: directChapters, volumeList: [] },
    confidence: 0.7,
    structureType: 'direct_extraction',
  };
  return buildScrapeResponse(fallbackResult, returnRawHtml);
}

async function executeScrape(params: WikiScrapeParams): Promise<AsyncResult<unknown, Error>> {
  log.info('Scraping wiki URL', { url: params.url });
  const returnRawHtml = params.returnRawHtml ?? false;

  try {
    const result = await adaptiveParse(params.url, {
      fallbackToLegacy: true,
      useCache: true,
    });

    // If adaptive parser fails, try direct chapter extraction as fallback
    if (!result.success || !result.data?.chapterList?.length) {
      const fallback = await tryDirectFallback(params.url, returnRawHtml);
      if (fallback) return createSuccessResult(fallback);
    }

    const response = buildScrapeResponse(result, returnRawHtml);
    log.info('Wiki scrape completed', {
      url: params.url,
      parseSuccess: result.success,
      chapters: result.data?.chapterList?.length ?? 0,
      volumes: result.data?.volumeList?.length ?? 0,
    });

    return createSuccessResult(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Wiki scrape failed', { error: err, url: params.url });
    return createErrorResult(err);
  }
}

export const wikiScrapeTool: AgentTool = {
  name: 'wiki_scrape',
  description: 'Scrape a wiki URL using the adaptive parser. Returns parsed chapter/volume data. Use when you have a specific URL to try.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Wiki URL to scrape (Fandom or similar wiki)',
      },
      returnRawHtml: {
        type: 'boolean',
        description: 'Return a snippet of raw HTML (max 10KB) for analysis',
      },
    },
    additionalProperties: false,
  } as const,
  async execute(params: unknown): Promise<AsyncResult<unknown, Error>> {
    const validationResult = validateParams(params);
    if (isError(validationResult)) return validationResult;
    if (!isSuccess(validationResult)) {
      return createErrorResult(new Error(`Unexpected validation state: ${validationResult.status}`));
    }
    return executeScrape(validationResult.data);
  },
};
