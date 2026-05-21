/**
 * Agentic Action Parser
 *
 * Parse model JSON output into a typed AgenticAction.
 */

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgenticAction, AgenticActionType } from './loop-types';

const log = logger.child('AgenticActionParser');

const VALID_ACTIONS: Set<string> = new Set(['search', 'scrape', 'validate_cover', 'merge', 'done']);

/** Parse search action from parsed JSON */
function parseSearchAction(parsed: Record<string, unknown>, reasoning: string): AsyncResult<AgenticAction, Error> {
  const tool = parsed['tool'];
  if (tool !== 'wiki_page_search' && tool !== 'wiki_url_search') {
    return createErrorResult(new Error(`Invalid search tool: ${String(tool)}`));
  }
  const params = parsed['params'];
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Search action requires params object'));
  }
  return createSuccessResult({
    action: 'search' as const,
    tool,
    params: params as Record<string, string>,
    reasoning,
  });
}

/** Parse scrape action from parsed JSON */
function parseScrapeAction(parsed: Record<string, unknown>, reasoning: string): AsyncResult<AgenticAction, Error> {
  const params = parsed['params'] as Record<string, unknown> | undefined;
  const url = params?.['url'];
  if (typeof url !== 'string') {
    return createErrorResult(new Error('Scrape action requires params.url string'));
  }
  return createSuccessResult({
    action: 'scrape' as const,
    tool: 'wiki_scrape' as const,
    params: { url },
    reasoning,
  });
}

/** Parse validate_cover action from parsed JSON */
function parseValidateCoverAction(parsed: Record<string, unknown>, reasoning: string): AsyncResult<AgenticAction, Error> {
  const params = parsed['params'] as Record<string, unknown> | undefined;
  const urls = params?.['urls'];
  if (!Array.isArray(urls) || urls.length === 0) {
    return createErrorResult(new Error('validate_cover requires params.urls array'));
  }
  const context = typeof params?.['context'] === 'string' ? params['context'] : '';
  return createSuccessResult({
    action: 'validate_cover' as const,
    params: { urls: urls.filter((u): u is string => typeof u === 'string'), context },
    reasoning,
  });
}

/** Parse merge action from parsed JSON */
function parseMergeAction(parsed: Record<string, unknown>, reasoning: string): AsyncResult<AgenticAction, Error> {
  return createSuccessResult({
    action: 'merge' as const,
    titleOverrides: asStringRecord(parsed['titleOverrides']),
    volumeOverrides: asNumberRecord(parsed['volumeOverrides']),
    coverSelections: asStringRecord(parsed['coverSelections']),
    reasoning,
  });
}

/** Safely cast to Record<string, string> */
function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') result[k] = v;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Safely cast to Record<string, number> */
function asNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number') result[k] = v;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Route action type to its parser */
function parseByActionType(
  actionType: AgenticActionType,
  parsed: Record<string, unknown>,
  reasoning: string,
): AsyncResult<AgenticAction, Error> {
  switch (actionType) {
    case 'search':
      return parseSearchAction(parsed, reasoning);
    case 'scrape':
      return parseScrapeAction(parsed, reasoning);
    case 'validate_cover':
      return parseValidateCoverAction(parsed, reasoning);
    case 'merge':
      return parseMergeAction(parsed, reasoning);
    case 'done':
      return createSuccessResult({ action: 'done', reasoning });
    default:
      return createErrorResult(new Error(`Unhandled action type: ${actionType}`));
  }
}

/** Parse a model response string into an AgenticAction */
export function parseAgenticAction(response: string): AsyncResult<AgenticAction, Error> {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return createErrorResult(new Error('No JSON found in model response'));
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const action = parsed['action'];

    if (typeof action !== 'string' || !VALID_ACTIONS.has(action)) {
      return createErrorResult(new Error(`Invalid action: ${String(action)}`));
    }

    const reasoning = typeof parsed['reasoning'] === 'string' ? parsed['reasoning'] : '';
    return parseByActionType(action as AgenticActionType, parsed, reasoning);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn('Failed to parse agentic action', { error: err.message });
    return createErrorResult(err);
  }
}
