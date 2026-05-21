/**
 * List Page Extractor
 *
 * Main entry point for extracting chapter-volume relationships from list pages.
 * Orchestrates volume detection, chapter detection, and relation building.
 * Supports provider-specific overrides for Wikipedia, Fandom, etc.
 */

import type { LinearizedToken, LinearizationResult } from '@/server/ml/features/dom-linearizer';
import { logger } from '@/utils/logger';

import { detectChapters } from './chapter-detector';
import { getListPageOverrides } from './provider-overrides';
import { buildRelations, calculateRelationStats, validateRelations } from './relation-builder';
import { detectVolumes } from './volume-detector';

import type { TableAnalysis } from '../table-analyzer';
import type { TokenSpan } from '../types';
import type { ListPageExtractionResult } from './types';

/** Source type alias from LinearizationResult */
type SourceType = LinearizationResult['sourceType'];

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract list page data from tokens and table analyses
 *
 * @param tokens - Linearized tokens from the page
 * @param spans - Existing BIO label spans (for context)
 * @param tableAnalyses - Table structure analyses
 * @param sourceType - Source type for provider-specific overrides (optional, defaults to 'unknown')
 * @returns Structured extraction result with volumes, chapters, and relations
 */
export function extractListPageData(
  tokens: LinearizedToken[],
  spans: TokenSpan[],
  tableAnalyses: TableAnalysis[],
  sourceType: SourceType = 'unknown'
): ListPageExtractionResult {
  const overrides = getListPageOverrides(sourceType);

  logger.debug('Starting list page extraction', {
    tokenCount: tokens.length,
    spanCount: spans.length,
    tableCount: tableAnalyses.length,
    sourceType,
    hasOverrides: overrides !== undefined,
  });

  // Phase 1: Detect volumes (from section headers and tables)
  const { volumes, sections } = detectVolumes(tokens, tableAnalyses, overrides);

  logger.debug('Volumes detected', {
    volumeCount: volumes.length,
    sectionCount: sections.length,
  });

  // Phase 2: Detect chapters with volume relationships
  const chapters = detectChapters(tokens, tableAnalyses, volumes, sections, overrides);

  logger.debug('Chapters detected', {
    chapterCount: chapters.length,
    withVolume: chapters.filter((c) => c.belongsToVolume !== undefined).length,
  });

  // Phase 3: Build explicit relation tuples
  const relations = buildRelations(chapters, volumes);

  // Phase 4: Validate relations
  const validation = validateRelations(relations, volumes);
  if (!validation.valid) {
    logger.warn('List page validation issues', { issues: validation.issues });
  }

  // Calculate statistics
  const relationStats = calculateRelationStats(relations, chapters.length);

  const result: ListPageExtractionResult = {
    volumes,
    chapters,
    relations,
    stats: {
      tableCount: tableAnalyses.length,
      volumeCount: volumes.length,
      chapterCount: chapters.length,
      assignedChapterCount: relationStats.assignedChapters,
      unassignedChapterCount: relationStats.unassignedChapters,
    },
  };

  logger.info('List page extraction complete', {
    volumes: result.stats.volumeCount,
    chapters: result.stats.chapterCount,
    relations: relations.length,
    assignmentRate: chapters.length > 0
      ? (relationStats.assignedChapters / chapters.length * 100).toFixed(1) + '%'
      : 'N/A',
  });

  return result;
}

// ============================================================================
// Page Type Detection
// ============================================================================

/**
 * Check if a page is likely a "Chapters and Volumes" list page
 */
export function isListPage(url: string, tokens: LinearizedToken[]): boolean {
  // Check URL patterns
  const urlPatterns = [
    /\/chapters[_-]?and[_-]?volumes/i,
    /\/chapter[_-]?list/i,
    /\/volume[_-]?list/i,
    /\/episode[_-]?list/i,
  ];

  if (urlPatterns.some((pattern) => pattern.test(url))) {
    return true;
  }

  // Check for presence of chapter/volume tables
  let hasChapterTable = false;
  let hasVolumeTable = false;

  for (const token of tokens) {
    if (token.isTableHeader) {
      const headerLower = token.text.toLowerCase();
      if (/chapter|episode|ch\./i.test(headerLower)) hasChapterTable = true;
      if (/volume|vol\./i.test(headerLower)) hasVolumeTable = true;
    }
  }

  // List pages typically have both chapter and volume references
  return hasChapterTable && hasVolumeTable;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ChapterExtraction,
  ChapterVolumeRelation,
  ListPageExtractionResult,
  ListPageTrainingRecord,
  ListPageWriteResult,
  RelationSourceType,
  VolumeExtraction,
} from './types';

export { detectVolumes, detectVolumeSections } from './volume-detector';
export { detectChapters } from './chapter-detector';
export { buildRelations, validateRelations, calculateRelationStats } from './relation-builder';
export { writeListPageToDatabase, getListPageWithRelations, updateValidationStatus, getListPageStats } from './db-writer';
