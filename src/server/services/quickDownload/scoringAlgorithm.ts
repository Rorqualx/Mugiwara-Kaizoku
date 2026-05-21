/**
 * Quick Download Scoring Algorithm — Facade
 *
 * Thin wrapper that preserves the original public API while delegating
 * all scoring logic to the Specification-based DownloadDecisionEngine.
 */

import { DownloadDecisionEngine } from '@/server/services/quickDownload/scoring/engine';
import type { DownloadDecision } from '@/server/services/quickDownload/scoring/types';
import type { ProwlarrSearchResult } from '@/types/prowlarr';
import type {
  QuickDownloadCriteria,
  ScoredSearchResult,
} from '@/types/quickDownload.types';
import { DEFAULT_QUICK_DOWNLOAD_CRITERIA } from '@/types/quickDownload.types';
import logger from '@/utils/serverLogger';

/** Sentinel score for rejected releases (existing code checks `score > 0`) */
const REJECTED_SCORE = -10000;

/** Shared engine instance (stateless — safe to reuse) */
const engine = new DownloadDecisionEngine();

/** Map a DownloadDecision to the legacy ScoredSearchResult shape */
function toScoredResult(decision: DownloadDecision): ScoredSearchResult {
  return {
    result: decision.result,
    score: decision.accepted ? decision.score : REJECTED_SCORE,
    scoreBreakdown: decision.scoreBreakdown,
  };
}

/**
 * Score a single Prowlarr search result.
 *
 * @param result - Prowlarr search result to score
 * @param criteria - Selection criteria and preferences
 * @returns Scored result with breakdown
 */
export function scoreSearchResult(
  result: ProwlarrSearchResult,
  criteria: QuickDownloadCriteria = DEFAULT_QUICK_DOWNLOAD_CRITERIA,
): ScoredSearchResult {
  const decision = engine.evaluate(result, criteria);

  logger.debug(`[QuickDownload] Total score for ${result.title}: ${decision.score}`, {
    breakdown: decision.scoreBreakdown,
    result: {
      title: result.title,
      format: result.format,
      size: (result.size / (1024 * 1024)).toFixed(2) + ' MB',
      indexer: result.indexerName,
      seeders: result.seeders,
    },
  });

  return toScoredResult(decision);
}

/**
 * Score multiple search results and sort by score (highest first).
 */
export function scoreAndSortResults(
  results: ProwlarrSearchResult[],
  criteria: QuickDownloadCriteria = DEFAULT_QUICK_DOWNLOAD_CRITERIA,
): ScoredSearchResult[] {
  logger.info(`[QuickDownload] Scoring ${results.length} search results`);

  const decisions = engine.evaluateAndSort(results, criteria);
  const scored = decisions.map(toScoredResult);

  // Log top 3 results
  const top3 = scored.slice(0, 3);
  logger.info(`[QuickDownload] Top 3 results:`, {
    results: top3.map((s, index) => ({
      rank: index + 1,
      title: s.result.title,
      score: s.score,
      format: s.result.format,
      indexer: s.result.indexerName,
      seeders: s.result.seeders,
    })),
  });

  return scored;
}

/**
 * Select best result from scored results.
 */
export function selectBestResult(
  scoredResults: ScoredSearchResult[],
): ScoredSearchResult | null {
  if (scoredResults.length === 0) {
    logger.warn(`[QuickDownload] No results to select from`);
    return null;
  }

  for (const scored of scoredResults) {
    if (scored.score <= 0) {
      continue;
    }

    const rec = scored.result as Record<string, unknown>;
    const downloadUrl = rec['downloadUrl'] ?? rec['link'] ?? rec['guid'];

    if (downloadUrl !== null && downloadUrl !== undefined && typeof downloadUrl === 'string') {
      logger.info(`[QuickDownload] Selected best result:`, {
        title: scored.result.title,
        score: scored.score,
        format: scored.result.format,
        indexer: scored.result.indexerName,
        downloadUrl: downloadUrl.substring(0, 50) + '...',
      });
      return scored;
    }

    logger.warn(
      `[QuickDownload] Skipping result without downloadUrl: ${scored.result.title}`,
    );
  }

  logger.warn(
    `[QuickDownload] No valid results found (all scores <= 0 or missing downloadUrl)`,
  );
  return null;
}

/**
 * All-in-one: Score, sort, and select best result.
 */
export function autoSelectBestResult(
  results: ProwlarrSearchResult[],
  criteria: QuickDownloadCriteria = DEFAULT_QUICK_DOWNLOAD_CRITERIA,
): ScoredSearchResult | null {
  const scoredAndSorted = scoreAndSortResults(results, criteria);
  return selectBestResult(scoredAndSorted);
}
