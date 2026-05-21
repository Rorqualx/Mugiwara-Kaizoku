/**
 * Annotation Router - Helper Functions
 */

import { ABBREVIATIONS_UNIFIED } from '@/lib/text-processing';
import { prisma } from '@/server/db';
import { loadTrainingData as loadTrainingDataFromCSV } from '@/server/services/auto-labeling';

import type { AnnotationSourceType, AnnotationStatus } from '@prisma/client';

/**
 * Get set of URLs that already exist in the database.
 */
export async function getExistingUrls(urls: string[]): Promise<Set<string>> {
  const existing = await prisma.annotatedPage.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });

  return new Set(existing.map(p => p.url));
}

export function buildStatusMap(
  statusCounts: Array<{ status: AnnotationStatus; _count: { id: number } }>
): Record<AnnotationStatus, number> {
  const statusMap: Record<AnnotationStatus, number> = {
    BOOTSTRAP: 0,
    AGENT_REVIEWED: 0,
    IN_PROGRESS: 0,
    REVIEWED: 0,
    GOLD: 0,
    REJECTED: 0,
  };
  for (const item of statusCounts) {
    statusMap[item.status] = item._count.id;
  }
  return statusMap;
}

export function buildSourceMap(
  sourceCounts: Array<{ sourceType: AnnotationSourceType; _count: { id: number } }>
): Record<AnnotationSourceType, number> {
  const sourceMap: Record<AnnotationSourceType, number> = {
    FANDOM: 0,
    WIKIPEDIA: 0,
    ANILIST: 0,
    COMICVINE: 0,
  };
  for (const item of sourceCounts) {
    sourceMap[item.sourceType] = item._count.id;
  }
  return sourceMap;
}

export function calculateTotalTokens(tokenStats: Array<{ tokens: unknown }>): number {
  let totalTokens = 0;
  for (const page of tokenStats) {
    if (Array.isArray(page.tokens)) {
      totalTokens += page.tokens.length;
    }
  }
  return totalTokens;
}

export function aggregateEntityCounts(
  entityStats: Array<{ entityCounts: unknown }>
): Record<string, number> {
  const entityCounts: Record<string, number> = {};
  for (const page of entityStats) {
    if (!page.entityCounts || typeof page.entityCounts !== 'object') continue;
    const counts = page.entityCounts as Record<string, number>;
    for (const [entity, count] of Object.entries(counts)) {
      entityCounts[entity] = (entityCounts[entity] ?? 0) + count;
    }
  }
  return entityCounts;
}

/** Training data entry for page list enrichment */
export interface TrainingDataEntry {
  comicVineId: string | null;
  fandomUrl: string | null;
  wikipediaUrl: string | null;
  fandomDiscoveredUrls: Array<{ type: string; url: string; categoryName?: string | undefined }>;
  wikipediaDiscoveredUrls: Array<{ type: string; url: string; categoryName?: string | undefined }>;
  comicVineDiscoveredUrls: Array<{ type: string; url: string; categoryName?: string | undefined }>;
}

/**
 * Load training data and build a lookup map by normalized title.
 * Returns empty map if training data file doesn't exist.
 */
export function loadTrainingDataMap(): Map<string, TrainingDataEntry> {
  try {
    const trainingData = loadTrainingDataFromCSV();
    return new Map(
      trainingData.map(entry => [
        entry.title.toLowerCase(),
        {
          comicVineId: entry.comicVineId,
          fandomUrl: entry.fandomUrl,
          wikipediaUrl: entry.wikipediaUrl,
          fandomDiscoveredUrls: entry.fandomDiscoveredUrls.map(u => ({
            type: String(u.type),
            url: u.url,
            categoryName: u.categoryName,
          })),
          wikipediaDiscoveredUrls: entry.wikipediaDiscoveredUrls.map(u => ({
            type: String(u.type),
            url: u.url,
            categoryName: u.categoryName,
          })),
          comicVineDiscoveredUrls: entry.comicVineDiscoveredUrls.map(u => ({
            type: String(u.type),
            url: u.url,
            categoryName: u.categoryName,
          })),
        },
      ])
    );
  } catch {
    // Training data file might not exist - continue without it
    return new Map();
  }
}

export function calculateEntityCountsFromLabels(labels: string[]): Record<string, number> {
  const entityCounts: Record<string, number> = {};
  for (const label of labels) {
    if (label !== 'O' && label.startsWith('B-')) {
      const entity = label.substring(2);
      entityCounts[entity] = (entityCounts[entity] ?? 0) + 1;
    }
  }
  return entityCounts;
}

/** Parse BIO label to extract entity type */
export function parseEntityTypeFromLabel(label: string): string | null {
  if (label === 'O') return null;
  const parts = label.split('-');
  return parts.length > 1 ? (parts[1] ?? null) : label;
}

/** Token data structure for export processing */
export interface ExportTokenData {
  text: string;
  label: string;
  entityType: string | null;
  contextBefore: string;
  contextAfter: string;
  tokenIndex: number;
}

/** Process a single token for export */
// eslint-disable-next-line max-params -- Token export requires token, label, index, all tokens for context
export function processTokenForExport(
  token: { text: string; normalizedText?: string },
  label: string,
  tokenIndex: number,
  tokens: Array<{ text: string; normalizedText?: string }>,
  includeContext: boolean,
  contextSentences: number
): ExportTokenData {
  const entityType = parseEntityTypeFromLabel(label);
  let contextBefore = '';
  let contextAfter = '';

  if (includeContext) {
    const context = extractSentenceContext(tokens, tokenIndex, contextSentences);
    contextBefore = context.before;
    contextAfter = context.after;
  }

  return {
    text: token.text,
    label,
    entityType,
    contextBefore,
    contextAfter,
    tokenIndex,
  };
}

export function detectSourceType(url: string): AnnotationSourceType | null {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('fandom.com') || urlLower.includes('.wikia.com')) return 'FANDOM';
  if (urlLower.includes('wikipedia.org')) return 'WIKIPEDIA';
  if (urlLower.includes('anilist.co')) return 'ANILIST';
  if (urlLower.includes('comicvine.gamespot.com')) return 'COMICVINE';
  return null;
}

// Dynamic import to avoid loading jsdom (which requires canvas) at startup
export async function getBootstrapLabels(): Promise<typeof import('@/server/ml/training/bootstrap-labeler').bootstrapLabels> {
  const module = await import('@/server/ml/training/bootstrap-labeler');
  return module.bootstrapLabels;
}

// Dynamic import for suggestion generation (Phase 4)
export async function getSuggestionGenerator(): Promise<typeof import('@/server/ml/training/bootstrap-labeler').generateSuggestions> {
  const module = await import('@/server/ml/training/bootstrap-labeler');
  return module.generateSuggestions;
}

// ============================================================================
// Menu Expansion - Force Hidden Navigation Menus Visible
// ============================================================================

/**
 * CSS to inject that forces CONTENT-RELATED navigation menus to be visible.
 * Only targets wiki content areas (TOC, article nav) - NOT global site navigation.
 * This ensures navigation links hidden in menus are captured for annotation.
 */
const MENU_EXPANSION_CSS = `
<style id="annotation-menu-expansion">
  /* ============================================================
   * FANDOM: Expand collapsible content sections ONLY
   * Excludes: global-navigation, wds-dropdown (site header menus)
   * ============================================================ */

  /* Fandom wiki page local navigation (table of contents, article sections) */
  .page-content .collapsible-content,
  .page-content [class*="collapsed"],
  .mw-parser-output .collapsible-content,
  .mw-parser-output .mw-collapsible-content,
  .article-content .collapsible-content,
  #content .collapsible-content,
  #mw-content-text .collapsible-content,
  #mw-content-text .mw-collapsible-content {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    height: auto !important;
    max-height: none !important;
  }

  /* Fandom: Local wiki navigation within articles */
  .portable-infobox .pi-collapse,
  .portable-infobox [data-expandable],
  .navbox-content,
  .navbox .navbox-list,
  .toc ul,
  .toc li {
    display: block !important;
    visibility: visible !important;
  }

  /* ============================================================
   * WIKIPEDIA: Expand collapsible content sections
   * ============================================================ */

  /* Wikipedia collapsible content */
  .NavContent,
  .mw-collapsible-content,
  .navbox-list,
  .navbox-even,
  .navbox-odd,
  #toc ul,
  .toclist {
    display: block !important;
    visibility: visible !important;
  }

  /* Wikipedia: Sidebar navigation boxes */
  .sidebar-content,
  .sidebar-list,
  .infobox .collapsible-content {
    display: block !important;
    visibility: visible !important;
  }

  /* ============================================================
   * CONTENT AREA ONLY: Generic collapsible patterns
   * Scoped to main content area to avoid global nav
   * ============================================================ */

  #content [aria-expanded="false"] + *,
  #mw-content-text [aria-expanded="false"] + *,
  .page-content [aria-expanded="false"] + *,
  .article-content [aria-expanded="false"] + *,
  main [aria-expanded="false"] + * {
    display: block !important;
    visibility: visible !important;
  }

  /* ============================================================
   * HIDE: Only ads - keep all navigation visible
   * ============================================================ */

  /* Hide ads */
  .bottom-ads-container,
  .top-ads-container,
  .ad-slot,
  [id*="google_ads"],
  .featured-video,
  .mcf-wrapper {
    display: none !important;
  }
</style>
`;

/**
 * JavaScript to inject that expands collapsible content sections.
 * ONLY targets content-area collapsibles, NOT global site navigation.
 */
const MENU_EXPANSION_SCRIPT = `
<script id="annotation-menu-expansion-script">
(function() {
  // === EXPAND CONTENT-AREA COLLAPSIBLES ===
  var contentAreas = ['#content', '#mw-content-text', '.page-content', '.article-content', 'main', '.mw-parser-output'];

  contentAreas.forEach(function(areaSelector) {
    var area = document.querySelector(areaSelector);
    if (!area) return;

    // Expand aria-expanded elements within content area
    var expandables = area.querySelectorAll('[aria-expanded="false"]');
    expandables.forEach(function(el) {
      // Skip if it's part of global navigation
      if (el.closest('.global-navigation') || el.closest('.wds-global-navigation') ||
          el.closest('.wds-community-header') || el.closest('.fandom-sticky-header')) {
        return;
      }
      el.setAttribute('aria-expanded', 'true');
    });

    // Add expanded class to collapsible containers
    var collapsibles = area.querySelectorAll('.mw-collapsible, .collapsible, [data-expandable]');
    collapsibles.forEach(function(el) {
      el.classList.remove('mw-collapsed', 'collapsed');
      el.classList.add('mw-expanded', 'expanded');
    });

    // Click "show" buttons in navboxes
    var showButtons = area.querySelectorAll('.navbox .mw-collapsible-toggle, .navbox [class*="toggle"]');
    showButtons.forEach(function(el) {
      if (el.textContent && el.textContent.toLowerCase().includes('show')) {
        try { el.click(); } catch(e) { /* ignore */ }
      }
    });
  });
})();
</script>
`;

/**
 * Expand hidden navigation menus in HTML content.
 *
 * Injects CSS and JavaScript that:
 * 1. Forces dropdown menus to display: block
 * 2. Adds hover/open classes to menu triggers
 * 3. Sets aria-expanded="true" on expandable elements
 * 4. Dispatches events to trigger JS-based menus
 *
 * This ensures navigation links that are normally hidden in menus
 * are visible for annotation, allowing the model to learn URL patterns.
 *
 * @param html - Raw HTML content from the page
 * @returns HTML with menu expansion styles/scripts injected
 */
export function expandNavigationMenus(html: string): string {
  let result = html;

  // Inject CSS in <head> (or at start if no head)
  const headMatch = result.match(/<head[^>]*>/i);
  if (headMatch) {
    result = result.replace(headMatch[0], headMatch[0] + MENU_EXPANSION_CSS);
  } else {
    result = MENU_EXPANSION_CSS + result;
  }

  // Inject script before </body> (or at end if no body close tag)
  const bodyCloseMatch = result.match(/<\/body>/i);
  if (bodyCloseMatch) {
    result = result.replace(bodyCloseMatch[0], MENU_EXPANSION_SCRIPT + bodyCloseMatch[0]);
  } else {
    result = result + MENU_EXPANSION_SCRIPT;
  }

  return result;
}

/** JS-heavy sources that benefit from FlareSolverr rendering */
const JS_HEAVY_SOURCES = ['FANDOM', 'COMICVINE'];

/** Wait time in seconds for JS to render (Fandom pages need extra time for lazy loading) */
const FANDOM_WAIT_SECONDS = 10;
const COMICVINE_WAIT_SECONDS = 5;

/** Try to fetch using FlareSolverr for JS-heavy pages (with session pooling) */
async function tryFlareSolverrFetch(
  url: string,
  sourceType: string
): Promise<{ html: string; usedFlareSolverr: boolean } | null> {
  const { protectedFetch, isFlareSolverrAvailable } = await import('@/server/services/shared/protectedFetch');
  const { logger } = await import('@/utils/logger');
  const { acquireSession, releaseSession } = await import('./session-pool');

  const flareSolverrAvailable = await isFlareSolverrAvailable();
  if (!flareSolverrAvailable) {
    logger.warn('FlareSolverr unavailable, will use simple fetch', { url, sourceType });
    return null;
  }

  // Extract domain for session pooling
  const domain = sourceType.toLowerCase();
  const sessionName = await acquireSession(domain);

  if (!sessionName) {
    logger.warn('Could not acquire session from pool', { url, sourceType });
    return null;
  }

  try {
    const waitInSeconds = sourceType === 'FANDOM' ? FANDOM_WAIT_SECONDS : COMICVINE_WAIT_SECONDS;

    logger.info('Using pooled FlareSolverr session', { url, sourceType, sessionName, waitInSeconds });
    const result = await protectedFetch(url, {
      timeout: 90000,
      sessionName,
      waitInSeconds,
    });

    if (!result.success || !result.html) {
      logger.warn('FlareSolverr fetch failed', { url, error: result.error });
      return null;
    }

    logger.info('FlareSolverr fetch successful', { url, htmlLength: result.html.length });
    return { html: result.html, usedFlareSolverr: true };
  } finally {
    releaseSession(sessionName);
  }
}

/** Simple fetch fallback for static pages */
async function simpleFetch(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MangaMetadataBot/1.0)' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Fetch HTML using FlareSolverr for JS-heavy pages (Fandom, ComicVine)
 * Falls back to simple fetch for static pages (Wikipedia, AniList)
 *
 * Automatically expands hidden navigation menus to ensure navigation links
 * (chapters, volumes, galleries) are visible for annotation.
 */
export async function fetchHtmlWithFlareSolverr(
  url: string,
  sourceType: string
): Promise<{ html: string; usedFlareSolverr: boolean }> {
  const shouldUseFlareSolverr = JS_HEAVY_SOURCES.includes(sourceType);

  let result: { html: string; usedFlareSolverr: boolean };

  if (shouldUseFlareSolverr) {
    const flareSolverrResult = await tryFlareSolverrFetch(url, sourceType);
    if (flareSolverrResult) {
      result = flareSolverrResult;
    } else {
      const html = await simpleFetch(url);
      result = { html, usedFlareSolverr: false };
    }
  } else {
    const html = await simpleFetch(url);
    result = { html, usedFlareSolverr: false };
  }

  // Expand hidden navigation menus to capture links for volumes/chapters/galleries
  result.html = expandNavigationMenus(result.html);

  return result;
}

/**
 * Check if a token ends a sentence (not an abbreviation or ellipsis)
 *
 * Uses ABBREVIATIONS_UNIFIED from @/lib/text-processing for consistency
 * with client-side sentence boundary detection.
 */
function isSentenceEnd(tokenText: string, nextTokenText?: string): boolean {
  const trimmed = tokenText.trim();

  // Must end with sentence-ending punctuation
  if (!/[.!?]$/.test(trimmed)) return false;

  // Ellipsis is not a sentence end (2+ dots)
  if (/\.{2,}$/.test(trimmed)) return false;

  // Single character followed by period (e.g., "A.") - likely initial
  if (/^[A-Z]\.$/.test(trimmed)) return false;

  // Check if it's a known abbreviation (using unified list)
  const withoutPunctuation = trimmed.replace(/[.!?]+$/, '').toLowerCase();
  if (ABBREVIATIONS_UNIFIED.has(withoutPunctuation)) {
    // Abbreviation followed by number is not sentence end (e.g., "Vol. 1")
    if (nextTokenText && /^\d/.test(nextTokenText.trim())) {
      return false;
    }
    // Abbreviation followed by lowercase is not sentence end
    if (nextTokenText && /^[a-z]/.test(nextTokenText.trim())) {
      return false;
    }
  }

  // Ends with ! or ? is always sentence end
  if (/[!?]$/.test(trimmed)) return true;

  // Period followed by capital letter indicates sentence end
  if (nextTokenText) {
    const nextTrimmed = nextTokenText.trim();
    if (/^[A-Z]/.test(nextTrimmed) || /^["'\u201c\u2018]?[A-Z]/.test(nextTrimmed)) {
      return true;
    }
  }

  // Default: assume period ends sentence
  return true;
}

/**
 * Extract sentence context around a token for training data export.
 *
 * Finds N sentences before and N sentences after the target token.
 * Sentences are detected by punctuation (. ! ?) with smart handling
 * of abbreviations (Vol., Dr., etc.) and ellipsis (...).
 *
 * @param tokens - Array of tokens with text property
 * @param tokenIndex - Index of the target token
 * @param sentenceCount - Number of sentences to include before/after (default 1)
 * @returns Object with before and after context strings
 */
// eslint-disable-next-line complexity -- Sentence boundary detection with bi-directional token traversal and punctuation analysis
export function extractSentenceContext(
  tokens: Array<{ text: string }>,
  tokenIndex: number,
  sentenceCount: number = 1
): { before: string; after: string } {
  // Extract "before" context - N sentences before the current token
  let sentencesFound = 0;
  let beforeTokens: string[] = [];

  for (let i = tokenIndex - 1; i >= 0 && sentencesFound < sentenceCount; i--) {
    const tokenText = tokens[i]?.text ?? '';
    const nextTokenText = tokens[i + 1]?.text;
    beforeTokens.unshift(tokenText);

    if (isSentenceEnd(tokenText, nextTokenText)) {
      sentencesFound++;
      if (sentencesFound >= sentenceCount) break;
    }
  }

  // Trim to sentence boundary if we found enough sentences
  if (sentencesFound < sentenceCount && beforeTokens.length > 0) {
    let sentenceStart = 0;
    for (let i = 0; i < beforeTokens.length - 1; i++) {
      const nextToken = beforeTokens[i + 1];
      if (isSentenceEnd(beforeTokens[i] ?? '', nextToken)) {
        sentenceStart = i + 1;
      }
    }
    beforeTokens = beforeTokens.slice(sentenceStart);
  }
  const beforeContext = beforeTokens.join(' ');

  // Extract "after" context - N sentences after the current token
  sentencesFound = 0;
  const afterTokens: string[] = [];

  for (let i = tokenIndex + 1; i < tokens.length && sentencesFound < sentenceCount; i++) {
    const tokenText = tokens[i]?.text ?? '';
    const nextTokenText = tokens[i + 1]?.text;
    afterTokens.push(tokenText);

    if (isSentenceEnd(tokenText, nextTokenText)) {
      sentencesFound++;
      if (sentencesFound >= sentenceCount) break;
    }
  }

  const afterContext = afterTokens.join(' ');

  return {
    before: beforeContext.trim(),
    after: afterContext.trim(),
  };
}
