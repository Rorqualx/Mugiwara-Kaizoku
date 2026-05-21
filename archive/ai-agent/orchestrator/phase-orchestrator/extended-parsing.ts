/**
 * Extended Parsing — Right URL, Wrong Parsing Recovery
 *
 * When the adaptive parser has the correct URL but produces inadequate data
 * (e.g., 50 chapters when 500 expected), this module:
 *
 * 1. Re-fetches the raw HTML from the known-good URL
 * 2. Runs ALL deterministic parsers exhaustively (not just the detected structure)
 * 3. Picks the parser that produces the most chapters
 * 4. Only if ALL parsers fail to meet threshold → sends raw HTML to the model
 *
 * This avoids wasting model calls on URL discovery when the URL is correct.
 */

import type {
  ChapterDataItem,
  SourceDataCollection,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { logger } from '@/utils/logger';

import { evaluatePageContent } from './ai-page-evaluator';
import { validateSourceData } from './validation';

const log = logger.child('ExtendedParsing');

/** Min coverage improvement required to consider extended parsing worthwhile */
const MIN_IMPROVEMENT_CHAPTERS = 5;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Detect inadequate parsing and retry with extended strategies on the same URL.
 * Only called when parser returned SOME data but coverage is below threshold.
 *
 * Called after deterministic remediation, before HTML triage.
 */
export async function runExtendedParsing(data: SourceDataCollection): Promise<void> {
  const expected = data.expectedChapterCount;

  // Fandom: has URL, has some data, but not acceptable
  if (isInadequateParsing('fandom', data, expected)) {
    await extendParsingForSource('fandom', data);
  }

  // Wikipedia: has some data but not acceptable
  if (isInadequateParsing('wikipedia', data, expected)) {
    await extendParsingForSource('wikipedia', data);
  }
}

/** Check if a source has the "right URL, wrong parsing" pattern */
function isInadequateParsing(
  source: 'fandom' | 'wikipedia',
  data: SourceDataCollection,
  expected: number,
): boolean {
  const chapters = data.sources[source];
  // Must have SOME data (parser found the page) but not enough
  if (chapters.length === 0) return false;
  // Must not already be acceptable
  if (validateSourceData(source, chapters, expected).isAcceptable) return false;
  // For fandom, must have a known URL
  if (source === 'fandom' && !data.rawData.fandomUrl) return false;
  return true;
}

// ============================================================================
// Per-Source Extended Parsing
// ============================================================================

/** Try extended deterministic parsing, then AI raw HTML extraction as last resort */
async function extendParsingForSource(
  source: 'fandom' | 'wikipedia',
  data: SourceDataCollection,
): Promise<void> {
  const url = getSourceUrl(source, data);
  if (!url) return;

  const currentCount = data.sources[source].length;
  log.info(`Extended parsing for ${source}`, { url, currentChapters: currentCount, expected: data.expectedChapterCount });

  // Step 1: Try all deterministic parsers exhaustively on the same URL
  const deterministicResult = await tryAllParsers(url, source);
  if (deterministicResult && deterministicResult.length > currentCount + MIN_IMPROVEMENT_CHAPTERS) {
    log.info(`Extended deterministic parsing improved ${source}`, {
      before: currentCount, after: deterministicResult.length,
    });
    updateSourceData(source, data, deterministicResult, url);
    return;
  }

  // Step 2: All deterministic parsers failed — verify page via screenshot, then AI extract
  log.info(`All deterministic parsers inadequate for ${source}, verifying page via screenshot`);

  const isConfirmed = await verifyPageWithScreenshot(url, data.title, data.expectedChapterCount);
  if (!isConfirmed) {
    log.info(`Screenshot verification: page does not appear to have chapter data`, { url, source });
    return;
  }

  // Step 3: Page confirmed to have chapter data — model extracts from raw HTML
  log.info(`Page confirmed via screenshot, extracting with AI`, { url, source });
  const aiResult = await evaluatePageContent(url, data.title, data.expectedChapterCount, source);

  if (aiResult.isCorrectPage && aiResult.extractedChapters.length > currentCount + MIN_IMPROVEMENT_CHAPTERS) {
    log.info(`AI extraction improved ${source}`, {
      before: currentCount, after: aiResult.extractedChapters.length,
    });
    updateSourceData(source, data, aiResult.extractedChapters, url);
  }
}

/** Get the known URL for a source */
function getSourceUrl(source: 'fandom' | 'wikipedia', data: SourceDataCollection): string | null {
  if (source === 'fandom') return data.rawData.fandomUrl ?? null;

  // For wikipedia, reconstruct URL from first chapter's context or use search
  // Wikipedia chapters don't store their source URL, so we can't extend here
  // without a known URL. Return null — wikipedia extended parsing needs HTML triage instead.
  return null;
}

// ============================================================================
// Exhaustive Deterministic Parsing
// ============================================================================

/**
 * Try ALL available parsers on the same URL, not just the auto-detected structure.
 * Returns the parser result with the most chapters, or null if all fail.
 */
async function tryAllParsers(url: string, source: string): Promise<ChapterDataItem[] | null> {
  try {
    const wikiDiscovery = await import(
      '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wiki-discovery'
    );

    // Attempt 1: Re-run adaptive parser (may pick different structure on retry)
    const adaptiveResult = await wikiDiscovery.fetchFandomChapterData(url);
    let bestChapters = adaptiveResult.chapterList;

    // Attempt 2: Direct regex extraction (catches simple numbered lists)
    const directResult = await wikiDiscovery.directChapterExtract(url);
    if (directResult.length > bestChapters.length) {
      bestChapters = directResult;
    }

    // Attempt 3: Try adaptive parser with the full URL (bypasses domain-based discovery)
    const fullUrlResult = await tryAdaptiveWithFullUrl(url);
    if (fullUrlResult.length > bestChapters.length) {
      bestChapters = fullUrlResult;
    }

    log.info(`Extended deterministic parsing for ${source}`, {
      url,
      adaptive: adaptiveResult.chapterList.length,
      direct: directResult.length,
      fullUrl: fullUrlResult.length,
      best: bestChapters.length,
    });

    return bestChapters.length > 0 ? bestChapters : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Extended parsing failed for ${source}`, { url, error: msg });
    return null;
  }
}

/** Try adaptive parser with full URL instead of domain (different code path) */
async function tryAdaptiveWithFullUrl(url: string): Promise<ChapterDataItem[]> {
  try {
    const { adaptiveParse } = await import('@/server/services/fandom/adaptive');
    const result = await adaptiveParse(url, {
      fallbackToLegacy: true,
      useCache: false, // Skip cache to force re-parse
    });

    if (!result.success || !result.data) return [];

    const chapterList = result.data.chapterList ?? [];
    const chapters: ChapterDataItem[] = [];
    for (const ch of chapterList) {
      const num = typeof ch.number === 'number' ? ch.number
        : typeof ch.chapterNumber === 'string' ? parseFloat(ch.chapterNumber) : NaN;
      if (isNaN(num) || num <= 0) continue;
      const item: ChapterDataItem = { number: num };
      if (ch.title) item.title = ch.title;
      if (typeof ch.volumeNumber === 'number') item.volume = ch.volumeNumber;
      chapters.push(item);
    }
    return chapters;
  } catch {
    return [];
  }
}

// ============================================================================
// Screenshot Verification via FlareSolverr
// ============================================================================

/**
 * Request a FlareSolverr screenshot of the page and ask the model
 * to verify that it contains chapter data (tables, lists of chapters).
 *
 * Returns true if the model confirms chapter data is visible on the page.
 * Falls back to true (optimistic) if FlareSolverr is unavailable.
 */
async function verifyPageWithScreenshot(
  url: string,
  title: string,
  expectedChapterCount: number,
): Promise<boolean> {
  try {
    const screenshot = await fetchScreenshot(url);
    if (!screenshot) {
      log.info('FlareSolverr unavailable for screenshot, proceeding optimistically');
      return true;
    }

    return evaluateScreenshotWithModel(screenshot, title, expectedChapterCount);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('Screenshot verification failed, proceeding optimistically', { url, error: msg });
    return true;
  }
}

/** Fetch a page screenshot via FlareSolverr */
async function fetchScreenshot(url: string): Promise<string | null> {
  try {
    const { flareSolverr } = await import('@/server/services/flaresolverr/singleton');
    const healthy = await flareSolverr.isHealthy();
    if (!healthy) return null;

    // Use fetchWithScreenshot which exposes the screenshot field
    return await fetchWithScreenshot(flareSolverr, url);
  } catch {
    return null;
  }
}

/** Fetch via FlareSolverr with screenshot enabled, return base64 PNG or null */
async function fetchWithScreenshot(
  client: { fetch: (url: string, opts: Record<string, unknown>) => Promise<Record<string, unknown>> },
  url: string,
): Promise<string | null> {
  // Cast to bypass the public fetch() type which omits screenshot
  const result = await client.fetch(url, {
    returnScreenshot: true,
    disableMedia: false,
  }) as Record<string, unknown>;

  const screenshot = result['screenshot'];
  return typeof screenshot === 'string' ? screenshot : null;
}

/**
 * Evaluate whether the screenshot shows chapter data.
 *
 * Vision support depends on the model. When Qwen3.5-9B vision is confirmed,
 * the screenshot base64 will be sent as multimodal input for the model to
 * visually verify the page structure.
 *
 * For now: logs the screenshot size and returns true (optimistic).
 * The infrastructure is ready — just needs the vision model call.
 */
function evaluateScreenshotWithModel(
  screenshotBase64: string,
  _title: string,
  _expectedChapterCount: number,
): boolean {
  // TODO: When model supports vision, send screenshot as multimodal input:
  // prompt: "Does this page have a chapter list for {title}? (~{expected} chapters)"
  // response: { hasChapterData: true/false, reasoning: "..." }
  log.info('Screenshot captured for verification', {
    screenshotSizeKB: Math.round(screenshotBase64.length / 1024),
  });

  // Optimistic: if we got a screenshot, the page loaded successfully.
  // The AI raw HTML extraction will do the actual content verification.
  return true;
}

// ============================================================================
// Helpers
// ============================================================================

/** Update source data in-place with better parsing result */
function updateSourceData(
  source: 'fandom' | 'wikipedia',
  data: SourceDataCollection,
  chapters: ChapterDataItem[],
  url: string,
): void {
  /* eslint-disable no-param-reassign -- Intentional in-place mutation */
  data.sources[source] = chapters;
  if (source === 'fandom') {
    data.rawData.fandomUrl = url;
    data.rawData.fandomParseSuccess = true;
  } else {
    data.rawData.wikipediaParseSuccess = true;
  }
  /* eslint-enable no-param-reassign */
}
