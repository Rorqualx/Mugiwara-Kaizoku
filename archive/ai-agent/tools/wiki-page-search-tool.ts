/**
 * Wiki Page Search Tool
 *
 * Searches for pages WITHIN a specific Fandom wiki using the MediaWiki API.
 * Allows the AI agent to discover internal wiki pages like "Chapters",
 * "Chapter_List", "Volumes", etc. — pages that aren't found by the
 * global wiki search (which only finds wiki base URLs).
 *
 * Example: Search bleach.fandom.com for "Chapters" → finds /wiki/Chapters page
 */

import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgentTool } from '../agent-core/types';

const log = logger.child('WikiPageSearchTool');

interface WikiPageSearchParams {
  wikiBaseUrl: string;
  query: string;
}

interface WikiSearchResult {
  title: string;
  url: string;
  snippet: string;
  size: number;
}

function validateParams(params: unknown): AsyncResult<WikiPageSearchParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const p = params as Partial<WikiPageSearchParams>;
  if (!p.wikiBaseUrl || typeof p.wikiBaseUrl !== 'string') {
    return createErrorResult(new Error('wikiBaseUrl is required (e.g., "https://bleach.fandom.com")'));
  }
  if (!p.query || typeof p.query !== 'string') {
    return createErrorResult(new Error('query is required (e.g., "Chapters")'));
  }

  // Normalize base URL — strip trailing slash and /wiki/* paths
  const baseUrl = p.wikiBaseUrl.replace(/\/wiki\/.*$/, '').replace(/\/$/, '');
  return createSuccessResult({ wikiBaseUrl: baseUrl, query: p.query });
}

/** Search within a Fandom wiki using the MediaWiki search API */
async function executePageSearch(params: WikiPageSearchParams): Promise<AsyncResult<unknown, Error>> {
  const { wikiBaseUrl, query } = params;
  log.info('Searching wiki pages', { wikiBaseUrl, query });

  try {
    const apiUrl = `${wikiBaseUrl}/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=0&srlimit=10&srprop=size|snippet&format=json&origin=*`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      return createErrorResult(new Error(`Wiki API returned ${response.status}: ${response.statusText}`));
    }

    const data = await response.json() as { query?: { search?: Array<{ title: string; snippet?: string; size?: number }> } };
    const searchResults = data.query?.search ?? [];

    const results: WikiSearchResult[] = searchResults.map(r => ({
      title: r.title,
      url: `${wikiBaseUrl}/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
      snippet: stripHtmlTags(r.snippet ?? ''),
      size: r.size ?? 0,
    }));

    log.info('Wiki page search completed', { wikiBaseUrl, query, resultCount: results.length });
    return createSuccessResult({ results, wikiBaseUrl, query });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Wiki page search failed', { error: err, wikiBaseUrl, query });
    return createErrorResult(err);
  }
}

/** Strip HTML tags from snippet text */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export const wikiPageSearchTool: AgentTool = {
  name: 'wiki_page_search',
  description: 'Search for pages WITHIN a specific Fandom wiki. Use this to find chapter list pages, volume pages, or other internal wiki pages. Example: search bleach.fandom.com for "Chapters" to find the /wiki/Chapters page.',
  parameters: {
    type: 'object',
    properties: {
      wikiBaseUrl: {
        type: 'string',
        description: 'Fandom wiki base URL (e.g., "https://bleach.fandom.com")',
      },
      query: {
        type: 'string',
        description: 'Search query for pages within the wiki (e.g., "Chapters", "Chapter List", "List of chapters")',
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
    return executePageSearch(validationResult.data);
  },
};
