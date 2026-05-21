/**
 * Wikipedia Static Analysis Router
 *
 * Exposes Wikipedia static page analysis to the frontend for pre-parsing URL analysis.
 * This enables the import wizard to:
 * - Automatically analyze Wikipedia URLs as they're entered
 * - Get parser recommendations before full parsing
 * - Detect if a list page exists and should be used instead
 *
 * @module metadata/wikipedia/wikipedia-static-analysis
 */

import { z } from 'zod';

import { analyzeWikipediaStructure } from '@/server/services/wikipedia/adaptive/static-analyzer';
import type {
  WikipediaParserType,
  WikipediaStructureAnalysis,
  WikitableAnalysis,
} from '@/server/services/wikipedia/adaptive/types';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

// ============================================================================
// Schemas
// ============================================================================

const analyzeWikipediaUrlInputSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

// ============================================================================
// Response Types
// ============================================================================

/**
 * Serialized parsing hints for frontend consumption.
 */
export interface WikipediaParsingHints {
  pageType: string;
  structureType: string;
  recommendedParser: string;
  relevantSections: string[];
  tableTypes: string[];
  hasVolumeData: boolean;
  hasChapterData: boolean;
  listPageUrl: string | null;
}

/**
 * Summary of Wikipedia page structure for frontend display.
 */
export interface WikipediaAnalysisSummary {
  tableCount: number;
  volumeTableCount: number;
  chapterTableCount: number;
  hasMediaSection: boolean;
  hasPublicationSection: boolean;
  hasInfobox: boolean;
  linksToListPage: boolean;
}

/**
 * Wikipedia static analysis response for frontend consumption.
 */
export interface WikipediaAnalysisResponse {
  analyzedAt: string;
  analysisTimeMs: number;
  pageType: string;
  structureType: string;
  recommendedParser: string;
  confidence: number;
  recommendationReason: string;
  summary: WikipediaAnalysisSummary;
  parsingHints: WikipediaParsingHints;
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
 * Determines table types found in the analysis.
 */
function getTableTypes(tables: WikitableAnalysis): string[] {
  const types: string[] = [];
  if (tables.volumeTables > 0) types.push('volume');
  if (tables.chapterTables > 0) types.push('chapter');
  if (tables.combinedTables > 0) types.push('combined');
  return types;
}

/**
 * Transforms WikipediaStructureAnalysis to frontend-consumable response.
 */
function transformAnalysisResult(
  result: WikipediaStructureAnalysis
): WikipediaAnalysisResponse {
  const { tables, sections, infobox, links } = result;

  // Determine if there's volume/chapter data
  const hasVolumeData =
    tables.volumeTables > 0 ||
    tables.combinedTables > 0 ||
    infobox.hasVolumeCount ||
    sections.hasVolumesSection;

  const hasChapterData =
    tables.chapterTables > 0 ||
    tables.combinedTables > 0 ||
    infobox.hasChapterCount ||
    sections.hasChaptersSection;

  return {
    analyzedAt: new Date().toISOString(),
    analysisTimeMs: result.analysisTimeMs,
    pageType: result.pageType,
    structureType: result.structureType,
    recommendedParser: result.recommendedParser,
    confidence: result.confidence,
    recommendationReason: result.recommendationReason,
    summary: {
      tableCount: tables.totalCount,
      volumeTableCount: tables.volumeTables,
      chapterTableCount: tables.chapterTables,
      hasMediaSection: sections.hasMediaSection,
      hasPublicationSection: sections.hasPublicationSection,
      hasInfobox: infobox.hasInfobox,
      linksToListPage: links.linksToListPage,
    },
    parsingHints: {
      pageType: result.pageType,
      structureType: result.structureType,
      recommendedParser: result.recommendedParser,
      relevantSections: sections.relevantSectionIds,
      tableTypes: getTableTypes(tables),
      hasVolumeData,
      hasChapterData,
      listPageUrl: links.listPageUrl,
    },
  };
}

// ============================================================================
// Router
// ============================================================================

/**
 * Wikipedia Static Analysis Router
 *
 * Provides a single endpoint for analyzing Wikipedia page structure.
 */
export const wikipediaStaticAnalysisRouter = router({
  /**
   * Analyze a Wikipedia URL and return structure analysis.
   *
   * This is a lightweight operation that:
   * 1. Fetches the HTML content
   * 2. Runs static analysis (no data extraction)
   * 3. Returns parser recommendations and hints
   *
   * Use this before full parsing to inform parser selection and
   * detect if a dedicated list page should be used instead.
   */
  analyzeWikipediaUrl: publicProcedure
    .input(analyzeWikipediaUrlInputSchema)
    .mutation(async ({ input }): Promise<WikipediaAnalysisResponse> => {
      const { url } = input;

      logger.info('[WikipediaStaticAnalysis] Analyzing URL', { url });

      try {
        // Fetch HTML content
        const html = await fetchHtml(url);

        // Run static analysis
        const analysisResult = analyzeWikipediaStructure(html, url);

        logger.info('[WikipediaStaticAnalysis] Analysis complete', {
          url,
          analysisTimeMs: analysisResult.analysisTimeMs,
          pageType: analysisResult.pageType,
          structureType: analysisResult.structureType,
          recommendedParser: analysisResult.recommendedParser,
          confidence: analysisResult.confidence,
          linksToListPage: analysisResult.links.linksToListPage,
          listPageUrl: analysisResult.links.listPageUrl,
        });

        // Transform to response format
        return transformAnalysisResult(analysisResult);
      } catch (error) {
        logger.error('[WikipediaStaticAnalysis] Analysis failed', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });

        // Re-throw with context
        throw new Error(
          `Failed to analyze Wikipedia URL: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }),
});

// Re-export types for consumers
export type { WikipediaParserType };
