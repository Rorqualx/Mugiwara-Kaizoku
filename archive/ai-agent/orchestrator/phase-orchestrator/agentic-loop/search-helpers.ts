/**
 * Search Helpers — Scoring, Ranking, and Data Merge
 *
 * Shared utilities for ranking wiki search results and merging scraped data
 * into the source data collection.
 */

import type { SourceDataCollection } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';

// ============================================================================
// Search Result Scoring & Ranking
// ============================================================================

/** Rank search results to prefer chapter list pages over individual chapters */
export function rankSearchResults(results: unknown[]): unknown[] {
  return [...results]
    .filter(r => r && typeof r === 'object')
    .sort((a, b) => scoreSearchResult(b) - scoreSearchResult(a));
}

/** Score a search result — higher = more likely to be a chapter list page */
export function scoreSearchResult(result: unknown): number {
  const r = result as Record<string, unknown>;
  const title = (typeof r['title'] === 'string' ? r['title'] : '').toLowerCase();
  const size = typeof r['size'] === 'number' ? r['size'] : 0;
  let score = 0;

  // Exact chapter list titles
  if (/^chapters?$/i.test(title)) score += 100;
  if (/^volumes?$/i.test(title)) score += 90;
  if (title.includes('chapter list') || title.includes('chapters and volumes')) score += 80;
  if (title.includes('volume list') || title.includes('volumes and chapters')) score += 70;
  if (title.includes('list of')) score += 70;

  // Partial matches
  if (title.includes('chapters')) score += 50;
  if (title.includes('episode list') || title.includes('episodes')) score += 40;
  if (title.includes('story arcs') || title.includes('arc list')) score += 60;

  // Penalize individual item pages
  if (/^chapter\s+\d+$/i.test(title)) score -= 50;
  if (/^(volume|episode|arc)\s+\d+$/i.test(title)) score -= 40;
  if (/^(character|location|weapon|technique)/i.test(title)) score -= 30;

  // Size bonus — large pages are likely chapter lists
  if (size > 50000) score += 30;
  else if (size > 20000) score += 15;

  return score;
}

/** Short summary of result titles for logging */
export function summarizeResultTitles(results: unknown[], limit = 5): string {
  return results.slice(0, limit).map(r => {
    if (!r || typeof r !== 'object') return '?';
    const title = (r as Record<string, unknown>)['title'];
    return typeof title === 'string' ? `"${title}"` : '?';
  }).join(', ');
}

// ============================================================================
// Data Merge Helpers
// ============================================================================

/** Merge scrape result into source data. Returns new chapter count. */
export function mergeScrapeIntoData(scrapeData: unknown, data: SourceDataCollection): number {
  if (!scrapeData || typeof scrapeData !== 'object') return 0;
  const obj = scrapeData as Record<string, unknown>;

  if (obj['parseSuccess'] !== true) return 0;
  const parsed = obj['parsed'] as Record<string, unknown> | null;
  if (!parsed) return 0;

  const chapterList = parsed['chapterList'];
  if (!Array.isArray(chapterList)) return 0;

  const chapters = extractChapterItems(chapterList);
  if (chapters.length <= data.sources.fandom.length) return 0;

  const added = chapters.length - data.sources.fandom.length;
  /* eslint-disable no-param-reassign -- Intentional mutation of shared data */
  data.sources.fandom = chapters;
  data.rawData.fandomParseSuccess = true;
  /* eslint-enable no-param-reassign */
  return added;
}

/** Extract typed chapter items from raw list */
function extractChapterItems(
  chapterList: unknown[],
): Array<{ number: number; title?: string; volume?: number; cover?: string }> {
  const chapters: Array<{ number: number; title?: string; volume?: number; cover?: string }> = [];
  for (const ch of chapterList) {
    if (!ch || typeof ch !== 'object') continue;
    const rec = ch as Record<string, unknown>;
    const num = typeof rec['chapterNumber'] === 'number' ? rec['chapterNumber']
      : typeof rec['number'] === 'number' ? rec['number'] : null;
    if (num === null) continue;

    const item: { number: number; title?: string; volume?: number; cover?: string } = { number: num };
    if (typeof rec['title'] === 'string') item.title = rec['title'];
    if (typeof rec['volume'] === 'number') item.volume = rec['volume'];
    if (typeof rec['volumeNumber'] === 'number') item.volume = rec['volumeNumber'];
    if (typeof rec['cover'] === 'string') item.cover = rec['cover'];
    if (typeof rec['coverUrl'] === 'string') item.cover = rec['coverUrl'];
    chapters.push(item);
  }
  return chapters;
}

// ============================================================================
// Model Response Parsing
// ============================================================================

/** Parse a search suggestion from model response */
export function parseSearchSuggestion(
  response: string,
): { tool: string; params: Record<string, string> } | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const tool = parsed['tool'];
    if (typeof tool !== 'string') return null;
    if (tool !== 'wiki_page_search' && tool !== 'wiki_url_search') return null;

    const params = parsed['params'];
    if (!params || typeof params !== 'object') return null;

    return { tool, params: params as Record<string, string> };
  } catch {
    return null;
  }
}
