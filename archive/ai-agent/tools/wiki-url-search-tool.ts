/**
 * Wiki URL Search Tool
 *
 * AI-directed Fandom wiki URL discovery for remediation.
 * Wraps fandomSearchService.searchAllWikis() so the AI agent
 * can suggest alternative search queries when the default
 * title-based discovery fails.
 */

import { fandomSearchService } from '@/server/services/fandom/fandomSearchService';
import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgentTool } from '../agent-core/types';

const log = logger.child('WikiUrlSearchTool');

interface WikiUrlSearchParams {
  query: string;
}

function validateParams(params: unknown): AsyncResult<WikiUrlSearchParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const { query } = params as Partial<WikiUrlSearchParams>;
  if (!query || typeof query !== 'string') {
    return createErrorResult(new Error('Query parameter is required and must be a string'));
  }

  return createSuccessResult({ query });
}

async function executeSearch(params: WikiUrlSearchParams): Promise<AsyncResult<unknown, Error>> {
  log.info('Searching for wiki URLs', { query: params.query });

  try {
    const searchResult = await fandomSearchService.searchAllWikis(params.query);

    if (!isSuccess(searchResult) || searchResult.data.results.length === 0) {
      return createSuccessResult({
        results: [],
        message: `No wikis found for query: ${params.query}`,
      });
    }

    const results = searchResult.data.results.slice(0, 5).map(r => ({
      url: r.url,
      title: r.title,
      confidence: r.score ?? 0,
    }));

    log.info('Wiki URL search completed', { query: params.query, resultCount: results.length });
    return createSuccessResult({ results });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Wiki URL search failed', { error: err, query: params.query });
    return createErrorResult(err);
  }
}

export const wikiUrlSearchTool: AgentTool = {
  name: 'wiki_url_search',
  description: 'Search for Fandom wiki URLs by query. Use when the default wiki discovery failed and you want to try alternative search terms.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (manga title, alternative name, or series name)',
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
    return executeSearch(validationResult.data);
  },
};
