/**
 * URL Content Scoring for Fandom Wiki Discovery
 *
 * Provides both pattern-based and extraction-based scoring to determine
 * which URLs contain the best chapter/volume data for parsing.
 *
 * @module url-discoverer/scoring
 */

import { load } from 'cheerio';

import { parsePageAdaptive } from '@/server/services/metadata/utils/fandom-table-parser';
import { logger } from '@/utils/logger';

import { isNumberedRowStructure, parseNumberedRowStructure } from '../numbered-row-parser';
import { convertNumberedRowToStandard } from '../orchestrator/result-converters';

import type { UrlContentScore } from '../types';

// ============================================================================
// HTML Fetching
// ============================================================================

/**
 * Fetches HTML content from a URL with timeout.
 */
export async function fetchHtmlContent(
  url: string,
  timeoutMs: number,
  userAgent: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': userAgent },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// ============================================================================
// Pattern-Based Scoring
// ============================================================================

/** Score additional structural signals: ordered lists, title attributes, category groups */
function scoreStructuralBonuses(
  $: ReturnType<typeof load>,
): Record<string, number> {
  const bonuses: Record<string, number> = {};

  // Ordered lists with chapter patterns (8.2% of wikis use <ol> for chapters)
  const orderedListsWithChapters = $('ol').filter((_, list) => {
    const listText = $(list).text();
    return /\d+\.\s+\S/.test(listText) || $(list).find('a').length >= 3;
  }).length;
  if (orderedListsWithChapters > 0) {
    bonuses['orderedListBonus'] = Math.min(orderedListsWithChapters * 50, 150);
  }

  // Title attribute links (22.4% of wikis use <a title="Chapter N">)
  const titleAttrLinks = $('a[title*="Chapter"], a[title*="chapter"]').length;
  if (titleAttrLinks >= 3) {
    bonuses['titleAttrBonus'] = Math.min(titleAttrLinks, 75);
  }

  // Category pages with mw-category-group sections (structured categories)
  const categoryGroups = $('.mw-category-group').length;
  if (categoryGroups > 0) {
    bonuses['categoryGroupBonus'] = Math.min(categoryGroups * 15, 60);
  }

  return bonuses;
}

/**
 * Scores a page's content for chapter/volume data quality using pattern matching.
 * Higher scores indicate better content for extraction.
 *
 * Scoring philosophy:
 * - Pages with BOTH chapter and volume info are preferred (they can be fully parsed)
 * - Category pages are penalized (they're harder to parse)
 * - Wiki-specific patterns in URLs get bonus (manually curated)
 * - Structured content (tables, lists) gets bonus
 */
export function scorePageContent(html: string, url: string): UrlContentScore {
  const $ = load(html);
  const breakdown: Record<string, number> = {};

  // Count chapter-related patterns
  const bodyText = $('body').text();

  // Chapter indicators: "Chapter N", "Episode N", "Ch. N", etc.
  const chapterPatterns = [
    /Chapter\s+\d+/gi,
    /Episode\s+\d+/gi,
    /Ch\.\s*\d+/gi,
    /Ep\.\s*\d+/gi,
    /第\s*\d+\s*話/g, // Japanese chapter
  ];
  let chapterIndicators = 0;
  for (const pattern of chapterPatterns) {
    const matches = bodyText.match(pattern);
    chapterIndicators += matches?.length ?? 0;
  }
  breakdown['chapterPatterns'] = Math.min(chapterIndicators, 150); // Cap at 150

  // Volume indicators: "Volume N", "Vol. N", etc.
  const volumePatterns = [
    /Volume\s+\d+/gi,
    /Vol\.\s*\d+/gi,
    /第\s*\d+\s*巻/g, // Japanese volume
  ];
  let volumeIndicators = 0;
  for (const pattern of volumePatterns) {
    const matches = bodyText.match(pattern);
    volumeIndicators += matches?.length ?? 0;
  }
  breakdown['volumePatterns'] = Math.min(volumeIndicators, 100); // Cap at 100

  // Numbered list patterns: "1. Title", "001. Title"
  const numberedListMatches = bodyText.match(/^\d{1,3}\.\s+\S/gm);
  const numberedListCount = numberedListMatches?.length ?? 0;
  breakdown['numberedLists'] = Math.min(numberedListCount, 100);

  // Chapter/volume links
  const chapterLinks = $('a[href*="/wiki/Chapter_"], a[href*="/wiki/Episode_"]').length;
  const volumeLinks = $('a[href*="/wiki/Volume_"]').length;
  breakdown['chapterLinks'] = Math.min(chapterLinks, 150);
  breakdown['volumeLinks'] = Math.min(volumeLinks, 50);

  // Tables with chapter-related content - strong signal for parseable content
  const tablesWithChapters = $('table').filter((_, table) => {
    const tableText = $(table).text();
    return /chapter|episode|vol\.|volume/i.test(tableText);
  }).length;
  breakdown['chapterTables'] = tablesWithChapters * 30;

  // Lists with chapter content
  const listsWithChapters = $('ul, ol').filter((_, list) => {
    const listText = $(list).text();
    return /chapter\s+\d+|episode\s+\d+|\d+\.\s+\S/i.test(listText);
  }).length;
  breakdown['chapterLists'] = Math.min(listsWithChapters * 10, 100);

  // Bonus for "Chapters list:" pattern (Attack on Titan style)
  const chaptersListCount = (bodyText.match(/Chapters\s*list:/gi) ?? []).length;
  breakdown['chaptersListPattern'] = chaptersListCount * 15;

  // Additional structural bonuses (ordered lists, title attributes, category groups)
  const structuralBonuses = scoreStructuralBonuses($);
  Object.assign(breakdown, structuralBonuses);

  // BALANCED CONTENT BONUS: Pages with BOTH chapters and volumes are preferred
  const hasSubstantialChapters = chapterIndicators >= 10 || chapterLinks >= 10;
  const hasSubstantialVolumes = volumeIndicators >= 5 || volumeLinks >= 3;
  if (hasSubstantialChapters && hasSubstantialVolumes) {
    breakdown['balancedContentBonus'] = 150; // Major bonus for having both
  }

  // CATEGORY PAGE PENALTY: Category pages are harder to parse
  const isCategoryPage = url.includes('/wiki/Category:');
  if (isCategoryPage) {
    breakdown['categoryPenalty'] = -100;
  }

  // Bonus for category pages with members (partial recovery)
  const categoryMembers = $('.category-page__member, .category-page__members a').length;
  if (categoryMembers > 0 && isCategoryPage) {
    breakdown['categoryMembers'] = Math.min(categoryMembers, 50);
  }

  // URL PATTERN BONUS: Wiki-specific patterns are manually curated and reliable
  const wikiSpecificPatterns = [
    'Chapters_and_Volumes',
    'Volumes_and_Chapters',
    'List_of_Chapters',
    'List_of_Volumes',
    'Manga_Guide',
  ];
  const urlHasReliablePattern = wikiSpecificPatterns.some((p) => url.includes(p));
  if (urlHasReliablePattern) {
    breakdown['reliableUrlPattern'] = 100;
  }

  // Calculate total score
  const score = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return {
    url,
    score,
    chapterIndicators,
    volumeIndicators,
    chapterVolumeLinks: chapterLinks + volumeLinks,
    hasChapterTables: tablesWithChapters > 0,
    hasNumberedLists: numberedListCount > 10,
    breakdown,
  };
}

// ============================================================================
// Extraction-Based Scoring
// ============================================================================

/**
 * Score based on actual data extraction (not just pattern matching).
 * Provides more accurate quality assessment by parsing pages and counting real data.
 */
export interface ExtractionScore {
  url: string;
  chapterCount: number;
  volumeCount: number;
  hasChapterTitles: boolean;
  hasReleaseDates: boolean;
  hasCoverImages: boolean;
  /** Overall completeness score - higher is better */
  completenessScore: number;
}

/**
 * Calculates completeness score based on parsed data.
 * Weights: chapters (2pts), volumes (10pts), titled chapters (+1), covers (+5)
 */
function calculateCompleteness(parsed: { chapters: unknown[]; volumes: unknown[] }, url?: string): number {
  let score = 0;
  const chapters = parsed.chapters as Array<{ title?: string; releaseDate?: string }>;
  const volumes = parsed.volumes as Array<{ coverImage?: string; releaseDate?: string }>;

  score += chapters.length * 2;                               // 2 pts per chapter
  score += volumes.length * 10;                               // 10 pts per volume
  score += chapters.filter((c) => c.title).length;            // 1 pt per titled chapter
  score += volumes.filter((v) => v.coverImage).length * 5;    // 5 pts per cover
  score += volumes.filter((v) => v.releaseDate).length * 3;   // 3 pts per release date

  // Penalize Category pages — they enumerate chapter page names as category members
  // but produce generic/missing titles. Prefer structured data pages.
  if (url?.includes('/wiki/Category:')) {
    score = Math.floor(score * 0.5);
  }

  // Penalize pages with suspiciously low chapter/volume density.
  // Normal manga has 7-12 chapters per volume. Below 5 suggests missing chapters.
  if (volumes.length >= 5 && chapters.length >= 20) {
    const density = chapters.length / volumes.length;
    if (density < 5) {
      score -= 100;
    }
  }

  return score;
}

/**
 * Configuration required for extraction scoring
 */
export interface ExtractionScoringConfig {
  probeTimeoutMs: number;
  userAgent: string;
}

/**
 * Scores URLs by actually extracting data from them.
 * More accurate than pattern-based scoring but requires fetching and parsing pages.
 *
 * @param urls - URLs to score (typically top 3 from pattern scoring)
 * @param config - Configuration options
 * @param baseUrl - Base wiki URL for relative link resolution
 * @returns Extraction scores sorted by completeness (best first)
 */
export async function scoreByExtraction(
  urls: string[],
  config: ExtractionScoringConfig,
  baseUrl: string
): Promise<ExtractionScore[]> {
  const scores: ExtractionScore[] = [];

  // Limit to top 3 for performance
  for (const url of urls.slice(0, 3)) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Sequential for rate limiting
      const html = await fetchHtmlContent(url, config.probeTimeoutMs * 2, config.userAgent);
      if (!html) continue;

      // Parse the page to extract actual data
      let parsed = parsePageAdaptive(html, undefined, undefined, baseUrl);

      // Fallback: try numbered-row parser if table parser found nothing (Bleach-style)
      if (parsed.chapters.length === 0 && parsed.volumes.length === 0 && isNumberedRowStructure(html)) {
        const nrResult = parseNumberedRowStructure(html, baseUrl);
        if (nrResult.success && (nrResult.chapters.length > 0 || nrResult.volumes.length > 0)) {
          parsed = convertNumberedRowToStandard(nrResult);
        }
      }

      const chapters = parsed.chapters as Array<{ title?: string; releaseDate?: string }>;
      const volumes = parsed.volumes as Array<{ coverImage?: string; releaseDate?: string }>;

      scores.push({
        url,
        chapterCount: chapters.length,
        volumeCount: volumes.length,
        hasChapterTitles: chapters.some((c) => c.title),
        hasReleaseDates: chapters.some((c) => c.releaseDate) || volumes.some((v) => v.releaseDate),
        hasCoverImages: volumes.some((v) => v.coverImage),
        completenessScore: calculateCompleteness(parsed, url),
      });

      logger.debug('[scoreByExtraction] Scored URL', {
        url,
        chapterCount: chapters.length,
        volumeCount: volumes.length,
        completenessScore: scores[scores.length - 1]?.completenessScore,
      });
    } catch (error) {
      logger.debug('[scoreByExtraction] Failed to extract from URL', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return scores.sort((a, b) => b.completenessScore - a.completenessScore);
}
