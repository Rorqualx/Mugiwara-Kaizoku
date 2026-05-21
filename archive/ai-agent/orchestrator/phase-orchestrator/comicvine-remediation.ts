/**
 * ComicVine Remediation — Fixes Wrong Match / Wrong Publisher
 *
 * Validates the Phase 1 ComicVine match and re-searches if:
 *   - Publisher is non-English (Shueisha, Ki-Oon, etc.)
 *   - Chapter yield is suspiciously low + issue count mismatch
 *
 * Re-search strategies:
 *   1. Title + "manga" for disambiguation
 *   2. Title + English publisher names (VIZ, Yen Press)
 *   3. Strict English-only publisher filter (no non-English fallback)
 */

import type { ComicVineVolume } from '@/server/services/comicvine/service';
import { comicvineService } from '@/server/services/comicvine/service';
import { detectNonEnglishVariant } from '@/server/services/search/providers/comicvine-language-filter';
import { parseComicVineDescriptions } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/comicvine-description-parser';
import type {
  ChapterDataItem,
  SourceDataCollection,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { diceCoefficient, normalizeTitle } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/utils';
import { logger } from '@/utils/logger';

import { evaluateTextContent } from './ai-page-evaluator';
import { validateComicVineData } from './validation';

const log = logger.child('ComicVineRemediation');

// ============================================================================
// Types
// ============================================================================

interface ComicVineSearchResult {
  chapters: ChapterDataItem[];
  publisher: string | undefined;
  volumeId: number;
  volumeName: string;
  issueCount: number;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Validate and remediate ComicVine data when the initial match is wrong.
 *
 * Checks publisher, chapter yield, and issue count. If validation fails,
 * re-searches with stricter English-only filtering.
 */
export async function remediateComicVine(data: SourceDataCollection): Promise<void> {
  const validation = validateComicVineData(data);
  if (validation.isAcceptable) return;

  log.info('Starting ComicVine remediation', {
    reason: validation.reason,
    currentChapters: data.sources.comicvine.length,
  });

  const queries = buildSearchQueries(data.title);
  const bestResult = await findBestMatch(queries, data);

  if (bestResult && bestResult.chapters.length > data.sources.comicvine.length) {
    applyResult(data, bestResult);
    return;
  }

  // Last attempt: AI evaluation of volume descriptions
  const aiResult = await evaluateComicVineDescriptions(data);
  if (aiResult && aiResult.length > data.sources.comicvine.length) {
    /* eslint-disable no-param-reassign -- Intentional in-place mutation */
    data.sources.comicvine = aiResult;
    /* eslint-enable no-param-reassign */
    log.info('ComicVine AI evaluation improved data', { chapters: aiResult.length });
    return;
  }

  log.info('ComicVine remediation: no better match found', {
    currentChapters: data.sources.comicvine.length,
  });
}

// ============================================================================
// Search Strategies
// ============================================================================

/** Build search query variations for re-search */
function buildSearchQueries(title: string): string[] {
  return [
    `${title} manga`,
    `${title} VIZ`,
    `${title} Yen Press`,
    title,
  ];
}

/** Try each query and return the best English match */
async function findBestMatch(
  queries: string[],
  data: SourceDataCollection,
): Promise<ComicVineSearchResult | null> {
  let best: ComicVineSearchResult | null = null;
  const currentVolumeId = data.rawData.comicvineVolumeId;

  /* eslint-disable no-await-in-loop -- Sequential search with early return on success */
  for (const query of queries) {
    const result = await searchAndParse(query, data.title, currentVolumeId);
    if (!result) continue;

    const isBetter = result.chapters.length > (best?.chapters.length ?? data.sources.comicvine.length);
    if (!isBetter) continue;

    best = result;

    // Accept immediately if English publisher with more data
    if (isEnglishPublisher(result.volumeName, result.publisher)) {
      log.info('Found better English match', {
        query, volumeName: result.volumeName,
        publisher: result.publisher, chapters: result.chapters.length,
      });
      break;
    }
  }
  /* eslint-enable no-await-in-loop */

  return best;
}

// ============================================================================
// Search & Parse
// ============================================================================

/**
 * Search ComicVine, select best English volume, fetch issues, parse descriptions.
 */
async function searchAndParse(
  query: string,
  originalTitle: string,
  skipVolumeId: number | undefined,
): Promise<ComicVineSearchResult | null> {
  try {
    const initialized = await comicvineService.initialize();
    if (!initialized) return null;

    const volumes = await comicvineService.searchBasicVolumes(query, 0, 20);
    if (volumes.length === 0) return null;

    const bestMatch = selectBestEnglishVolume(volumes, originalTitle);
    if (!bestMatch) return null;

    // Skip if same volume already tried in Phase 1
    if (skipVolumeId !== undefined && bestMatch.id === skipVolumeId) return null;

    return await fetchAndParseIssues(bestMatch);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('ComicVine re-search failed', { query, error: msg });
    return null;
  }
}

/** Fetch all issues for a volume and parse chapter descriptions */
async function fetchAndParseIssues(volume: ComicVineVolume): Promise<ComicVineSearchResult | null> {
  const issues = await comicvineService.getAllVolumeIssues(volume.id);
  if (issues.length === 0) return null;

  const enrichedData = buildMiniEnrichedData(issues);
  const parsed = parseComicVineDescriptions(enrichedData);

  return {
    chapters: parsed.chapters,
    publisher: volume.publisher?.name,
    volumeId: volume.id,
    volumeName: volume.name ?? '',
    issueCount: issues.length,
  };
}

// ============================================================================
// Volume Selection
// ============================================================================

/** Select best English volume — strict, no non-English fallback */
function selectBestEnglishVolume(
  volumes: ComicVineVolume[],
  title: string,
): ComicVineVolume | null {
  const normalizedQuery = normalizeTitle(title);

  const scored = volumes.map(vol => {
    const volName = vol.name ?? '';
    const titleScore = diceCoefficient(normalizedQuery, normalizeTitle(volName));
    const english = isEnglishPublisher(volName, vol.publisher?.name);
    return { vol, score: titleScore + (english ? 0.3 : 0), english };
  });

  scored.sort((a, b) => b.score - a.score);

  // Strict English-only: remediation should fix publisher, not repeat the mistake
  const topEnglish = scored.find(s => s.english && s.score >= 0.3);
  return topEnglish?.vol ?? null;
}

// ============================================================================
// AI Evaluation
// ============================================================================

/**
 * Evaluate ComicVine volume descriptions via AI model.
 * Concatenates all volume descriptions and asks the model to extract chapters.
 * If the model detects wrong data, it suggests a re-search query.
 */
async function evaluateComicVineDescriptions(
  data: SourceDataCollection,
): Promise<ChapterDataItem[] | null> {
  const descriptions = data.rawData.comicvineVolumeDescriptions;
  if (!descriptions || descriptions.length === 0) return null;

  try {
    const text = descriptions
      .map(d => `Volume ${d.volumeNumber}:\n${d.descriptionText}`)
      .join('\n\n');

    if (text.length < 50) return null;

    const evalResult = await evaluateTextContent(text, data.title, data.expectedChapterCount, 'comicvine');

    if (evalResult.isCorrectPage && evalResult.extractedChapters.length > 0) {
      return evalResult.extractedChapters;
    }

    // Wrong data — try re-searching with the suggested query
    if (!evalResult.isCorrectPage && evalResult.suggestedQuery) {
      const reSearchResult = await searchAndParse(evalResult.suggestedQuery, data.title, data.rawData.comicvineVolumeId);
      return reSearchResult?.chapters ?? null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('ComicVine AI description evaluation failed', { error: msg });
  }

  return null;
}

// ============================================================================
// Helpers
// ============================================================================

/** Check if publisher/title indicates an English edition */
function isEnglishPublisher(volumeName: string, publisher: string | undefined): boolean {
  const { isNonEnglish } = detectNonEnglishVariant(volumeName, publisher);
  return !isNonEnglish;
}

/** Build minimal enrichedData structure for comicvine-description-parser */
function buildMiniEnrichedData(
  issues: Array<{ issue_number?: string; description?: string; name?: string; id: number }>,
): unknown {
  const volumes = issues
    .filter(issue => issue.issue_number)
    .map(issue => mapIssueToVolume(issue))
    .filter((v): v is Record<string, unknown> => v !== null)
    .sort((a, b) => Number(a['number'] ?? 0) - Number(b['number'] ?? 0));

  return { manga: { volumes } };
}

/** Map a single issue to volume entry for description parsing */
function mapIssueToVolume(
  issue: { issue_number?: string; description?: string; name?: string; id: number },
): Record<string, unknown> | null {
  const volNum = parseInt(issue.issue_number ?? '0', 10);
  if (isNaN(volNum) || volNum <= 0) return null;

  const vol: Record<string, unknown> = {
    volumeNumber: String(volNum),
    number: volNum,
    id: String(issue.id),
  };
  if (issue.name) vol['title'] = issue.name;
  if (issue.description) vol['description'] = issue.description;
  return vol;
}

/** Update ComicVine source data in-place */
function applyResult(data: SourceDataCollection, result: ComicVineSearchResult): void {
  /* eslint-disable no-param-reassign -- Intentional in-place mutation of SourceDataCollection */
  data.sources.comicvine = result.chapters;
  if (result.publisher) data.rawData.comicvinePublisher = result.publisher;
  data.rawData.comicvineVolumeId = result.volumeId;
  data.rawData.comicvineVolumeName = result.volumeName;
  data.rawData.comicvineIssueCount = result.issueCount;
  /* eslint-enable no-param-reassign */
  log.info('Updated ComicVine source data', {
    chapters: result.chapters.length,
    publisher: result.publisher,
    volumeName: result.volumeName,
  });
}
