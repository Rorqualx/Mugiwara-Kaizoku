/**
 * Metadata Static Analysis Router
 *
 * Exposes static page analysis to the frontend for pre-parsing URL analysis.
 * This enables the import wizard to:
 * - Automatically analyze Fandom URLs as they're entered
 * - Get parser recommendations before full parsing
 * - Pass parsing hints to improve extraction accuracy
 *
 * @module metadata-static-analysis
 */

import { z } from 'zod';

import type {
  ParserRecommendation,
  ParserType,
  ParsingHints,
  StaticAnalysisResult,
} from '@/server/services/fandom/adaptive/static-analyzer';
import { analyzePageStructure } from '@/server/services/fandom/adaptive/static-analyzer';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

// ============================================================================
// Schemas
// ============================================================================

const analyzeUrlInputSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

// ============================================================================
// Response Types
// ============================================================================

/**
 * Simplified parsing hints for frontend consumption.
 * RegExp fields are serialized as strings.
 */
export interface SerializedParsingHints {
  chapterConvention: string | null;
  volumeSelectors: string[];
  chapterSelectors: string[];
  chapterUrlPattern: string | null;
  checkCollapsible: boolean;
  checkNestedLists: boolean;
  hasJpEnTabs: boolean;
  skipSelectors: string[];
}

/**
 * Static analysis response for frontend consumption.
 */
export interface StaticAnalysisResponse {
  analyzedAt: string;
  analysisTimeMs: number;
  recommendedParser: ParserRecommendation;
  summary: {
    tableCount: number;
    chapterLinkCount: number;
    volumeLinkCount: number;
    namingConvention: string | null;
    structureType: string;
    headerPattern: string;
    listPattern: string;
  };
  parsingHints: SerializedParsingHints;
}

// ============================================================================
// Helper Functions
// ============================================================================

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; MuggiwaraBot/1.0)';

/**
 * Fetches HTML content from a URL with timeout.
 */
async function fetchHtml(url: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Serializes ParsingHints for JSON transport (converts RegExp to string).
 */
function serializeParsingHints(hints: ParsingHints): SerializedParsingHints {
  return {
    chapterConvention: hints.chapterConvention?.name ?? null,
    volumeSelectors: hints.volumeSelectors,
    chapterSelectors: hints.chapterSelectors,
    chapterUrlPattern: hints.chapterUrlPattern?.source ?? null,
    checkCollapsible: hints.checkCollapsible,
    checkNestedLists: hints.checkNestedLists,
    hasJpEnTabs: hints.hasJpEnTabs,
    skipSelectors: hints.skipSelectors,
  };
}

/**
 * Transforms StaticAnalysisResult to frontend-consumable response.
 */
function transformAnalysisResult(result: StaticAnalysisResult): StaticAnalysisResponse {
  return {
    analyzedAt: result.analyzedAt.toISOString(),
    analysisTimeMs: result.analysisTimeMs,
    recommendedParser: result.recommendedParser,
    summary: {
      tableCount: result.tables.totalCount,
      chapterLinkCount: result.links.chapterLinks,
      volumeLinkCount: result.links.volumeLinks,
      namingConvention: result.chapterNaming.convention?.name ?? null,
      structureType: result.tables.dominantStructure,
      headerPattern: result.headers.hierarchyPattern,
      listPattern: result.lists.dominantPattern,
    },
    parsingHints: serializeParsingHints(result.parsingHints),
  };
}

// ============================================================================
// Router
// ============================================================================

/**
 * Static Analysis Router
 *
 * Provides a single endpoint for analyzing Fandom page structure.
 */
export const metadataStaticAnalysisRouter = router({
  /**
   * Analyze a Fandom URL and return structure analysis.
   *
   * This is a lightweight operation that:
   * 1. Fetches the HTML content
   * 2. Runs static analysis (no parsing)
   * 3. Returns parser recommendations and hints
   *
   * Use this before full parsing to inform the parser selection.
   */
  analyzeUrl: publicProcedure
    .input(analyzeUrlInputSchema)
    .mutation(async ({ input }): Promise<StaticAnalysisResponse> => {
      const { url } = input;

      logger.info('[StaticAnalysis] Analyzing URL', { url });

      try {
        // Fetch HTML content
        const html = await fetchHtml(url);

        // Run static analysis
        const analysisResult = analyzePageStructure(html);

        logger.info('[StaticAnalysis] Analysis complete', {
          url,
          analysisTimeMs: analysisResult.analysisTimeMs,
          recommendedParser: analysisResult.recommendedParser.primary,
          confidence: analysisResult.recommendedParser.confidence,
        });

        // Transform to response format
        return transformAnalysisResult(analysisResult);
      } catch (error) {
        logger.error('[StaticAnalysis] Analysis failed', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });

        // Re-throw with context
        throw new Error(
          `Failed to analyze URL: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
});

// Re-export types for consumers
export type { ParserRecommendation, ParserType };
