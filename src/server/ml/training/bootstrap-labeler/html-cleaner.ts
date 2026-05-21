/**
 * Server-Side HTML Cleaner for Tokenization
 *
 * Standardizes HTML to ensure consistency between client-side selection
 * and server-side tokenization. This includes:
 * - Removing non-content elements (scripts, ads, navigation)
 * - Normalizing whitespace
 * - Removing empty elements
 * - Flattening nested formatting
 * - Unicode normalization
 *
 * Uses cheerio for server-compatible DOM manipulation.
 */

import * as cheerio from 'cheerio';

import { detectSourceType as detectSharedSourceType } from '@/server/shared/source-knowledge/source-detection';
import { logger } from '@/utils/logger';

import type { AnyNode, Text as DomText } from 'domhandler';


// ============================================================================
// Types
// ============================================================================

interface CleaningResult {
  html: string;
  removedCount: number;
  normalizedCount: number;
  sourceType: SourceType;
}

interface NormalizationStats {
  emptyRemoved: number;
  nestedFlattened: number;
  whitespaceNormalized: number;
  commentsRemoved: number;
}


type SourceType = 'fandom' | 'wikipedia' | 'comicvine' | 'generic';

interface CleaningProfile {
  removeSelectors: string[];
  contentSelector: string;
}

// ============================================================================
// Cleaning Profiles (mirror client-side providers)
// ============================================================================

const FANDOM_PROFILE: CleaningProfile = {
  contentSelector: '.mw-parser-output, .page-content, #content',
  removeSelectors: [
    // Cookie consent
    '#onetrust-consent-sdk',
    '#onetrust-banner-sdk',
    '.onetrust-pc-dark-filter',
    '#ot-sdk-btn-floating',

    // Scripts
    'script',
    'noscript:empty',

    // Tracking
    'img[src*="beacon"]',
    'img[src*="pixel"]',
    'img[width="1"][height="1"]',

    // Preload links
    'link[rel="preconnect"]',
    'link[rel="dns-prefetch"]',
    'link[rel="preload"][as="script"]',

    // Navigation (these shift content indices)
    '.global-navigation',
    '.fandom-sticky-header',
    '.global-footer',
    '.page-footer',
    '.notifications-placeholder',
    '.site-notice',

    // Sidebar navigation that causes false positives
    '.page-side-tools',
    'nav.page-side-tool',
    '.page-explore__content a',
    '.wds-list-item a[href*="/wiki/Characters"]',
    '.wds-list-item a[href*="/wiki/Volumes"]',
    '.wds-list-item a[href*="/wiki/Chapters"]',

    // Chapter guide navigation (contains Volume X links that shouldn't be labeled)
    // NOTE: Don't remove generic .pi-collapse - it's used for collapsible infobox sections
    // that contain legitimate metadata like Release Date, Characters, etc.
    '.pi-navigation:not(.pi-data)',  // Navigation sections, but preserve data rows
    '[data-source="navigation"]',
    // Chapter Guide sections in infoboxes
    '.pi-smart-group[data-source="guide"]',
    '.pi-smart-group:has(.pi-header:contains("Chapter Guide"))',
    'section.pi-item:has(h2:contains("Chapter Guide"))',
    // Navigation section in main content (Fandom chapter pages)
    '#Navigation',
    'span#Navigation',
    'h2:has(#Navigation)',
    '#Navigation ~ table',
    '#Navigation ~ .navbox',
    '.navbox',
    '.navbox-inner',
    'table.navbox',
    // Tables containing "Chapters and Volumes" navigation
    'table:has(th:contains("Chapters and Volumes"))',
    'table:has(caption:contains("Chapters"))',
    // NOTE: Don't remove "Chapters_and_Volumes" links - they're useful for CHAPTERS_LIST_URL labeling
    // "List of Chapters and Volumes" navigation links in navboxes only
    '.navbox a[href*="List_of_Chapters"]',
    // Category links that cause GENRE/TAGS noise
    'a[href*="Category:Manga_Chapters"]',
    'a[href*="Category:Anime_Episodes"]',
    'a[href*="Category:Volumes"]',  // "Volumes" breadcrumb causes GENRE noise

    // References/Footnotes sections (contain citations, not content)
    '.references',
    '.mw-references-wrap',
    '#References',
    '#References ~ *',
    'h2:has(#References) ~ .mw-references-wrap',
    '.reference',  // Individual citation markers
    'ol.references',
    '.reflist',

    // Footnotes section
    '#Footnotes',
    '#Footnotes ~ *',

    // Ads
    '.bottom-ads-container',
    '.top-ads-container',
    '.ad-slot-placeholder',
    'div[class*="ad-slot"]',

    // Video
    '.jwplayer',
    'div[class*="jw-wrapper"]',

    // Search/modals
    '.search-modal',
    '[class*="overlay"]',
  ],
};

const WIKIPEDIA_PROFILE: CleaningProfile = {
  contentSelector: '#mw-content-text, #content, .mw-body-content',
  removeSelectors: [
    'script',
    'noscript:empty',
    '.navbox',
    '.vertical-navbox',
    '.authority-control',
    '.sistersitebox',
    '.noprint',
    '#catlinks',
    '#jump-to-nav',
    '.mw-editsection',
    'link[rel="preconnect"]',
    'link[rel="dns-prefetch"]',

    // Page header/navigation (search, login, etc.)
    'header',
    '#mw-head',
    '#mw-panel',
    '#mw-navigation',
    '.vector-header',
    '.vector-menu',
    '#p-search',
    '#searchInput',
    '#p-personal',
    '#p-logo',
    '#siteNotice',
    '#mw-head-base',
    '#mw-page-base',
    '.mw-portlet',

    // Vector 2022 skin elements
    '.vector-header-container',
    '.vector-column-start',
    '.vector-column-end',
    '.vector-sticky-header',
    '.vector-page-toolbar',
    '.vector-toc',
    '.vector-body-before-content',
    '.cdx-text-input',
    '.cdx-search-input',
    '[role="search"]',
    '[aria-label="Search Wikipedia"]',

    // Footer
    '#footer',
    '#mw-footer',
    '.mw-footer',

    // References/Footnotes sections (contain citations, not content)
    '.references',
    '.mw-references-wrap',
    '#References',
    '#References ~ *',
    'h2:has(#References) ~ .mw-references-wrap',
    '.reference',
    'ol.references',
    '.reflist',
    '#Footnotes',
    '#Footnotes ~ *',

    // External links section (navigation, not content)
    '#External_links',
    '#External_links ~ *',
  ],
};

const COMICVINE_PROFILE: CleaningProfile = {
  contentSelector: '.wiki-content, .object-content, #wiki-content-block',
  removeSelectors: [
    // Scripts (including JS templates that contain UI text like "Cancel Update")
    'script',
    'script[type="text/template"]',
    'noscript:empty',

    // Forum Navigation - causes TAGS noise like "Gen. Discussion", "Bug Reporting"
    '.site-nav',
    '.forum-bar',
    '.forum-nav',
    '.forum-categories',
    '.forum-section',
    'nav.site-nav',
    'ul.forum-bar',

    // Masthead/header navigation
    '.masthead-subnav',
    '.masthead-nav',

    // Wiki Object Navigation - causes TAGS noise like "Concepts", "Characters", "Teams"
    '.object-nav',
    '.wiki-object-nav',
    '.object-nav-item',
    '.pod-nav',
    'nav.object-nav',
    // Navigation links to wiki sections
    'a[href*="/concepts/"]',
    'a[href*="/characters/"]',
    'a[href*="/locations/"]',
    'a[href*="/teams/"]',
    'a[href*="/story_arcs/"]',
    'a[href*="/objects/"]',

    // Form elements - dropdowns cause TAGS noise like "Concepts", "Issues", "Movies"
    'select',
    'option',
    '.js-month-select',
    '.js-year-select',

    // Wiki HUD (editing controls overlay)
    '.wiki-hud',
    '.wiki-hud-header',
    '.wiki-hud-nav',

    // Editor dropdowns - causes "Font-size" STATUS noise
    '.dropdown',
    'button.dropdown-toggle',

    // Modal dialogs - causes "Cancel Update" TITLE noise
    '.modal',
    '.modal-footer',
    '.modal-body',
    '.wysiwyg-modal-body',
    '[data-wysiwyg]',

    // User/social elements
    '.user-bar',
    '.social-share',
    '.follow-button',

    // Ads & tracking
    'img[src*="beacon"]',
    'img[src*="pixel"]',
    'link[rel="preconnect"]',

    // Footer
    '.site-footer',
    'footer',
  ],
};

const GENERIC_PROFILE: CleaningProfile = {
  contentSelector: 'main, article, #content, .content',
  removeSelectors: [
    'script',
    'noscript:empty',
    'link[rel="preconnect"]',
    'link[rel="dns-prefetch"]',
    'link[rel="preload"][as="script"]',
    'img[width="1"][height="1"]',
    'img[src*="beacon"]',
    'img[src*="pixel"]',
    'nav',
    'footer',
    '[class*="cookie"]',
    '[class*="consent"]',
    '[class*="ad-slot"]',
    '[class*="advertisement"]',
  ],
};

// ============================================================================
// Source Detection
// ============================================================================

/**
 * Map shared SourceType to local cleaning SourceType.
 * The shared layer uses 'unknown' while cleaning profiles use 'generic'.
 */
function detectSourceType(url: string): SourceType {
  const shared = detectSharedSourceType(url);
  switch (shared) {
    case 'fandom':
      return 'fandom';
    case 'wikipedia':
      return 'wikipedia';
    case 'comicvine':
      return 'comicvine';
    default:
      return 'generic';
  }
}

function getProfile(sourceType: SourceType): CleaningProfile {
  switch (sourceType) {
    case 'fandom':
      return FANDOM_PROFILE;
    case 'wikipedia':
      return WIKIPEDIA_PROFILE;
    case 'comicvine':
      return COMICVINE_PROFILE;
    default:
      return GENERIC_PROFILE;
  }
}

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Remove HTML comments that may differ between renders
 */
function removeComments($: cheerio.CheerioAPI): number {
  let count = 0;
  $('*').contents().each(function () {
    if (this.type === 'comment') {
      $(this).remove();
      count++;
    }
  });
  return count;
}

/** Check if an inline element should be removed (empty, no meaningful attrs) */
function isEmptyRemovableElement(
  $: cheerio.CheerioAPI,
  el: AnyNode
): boolean {
  const $el = $(el);
  const text = $el.text().trim();
  const hasChildren = $el.children().length > 0;
  if (text || hasChildren) return false;

  const hasHref = $el.attr('href');
  const hasId = $el.attr('id');
  return !hasHref && !hasId;
}

/**
 * Remove empty inline elements that don't affect content
 */
function removeEmptyInlineElements($: cheerio.CheerioAPI): number {
  const inlineTags = ['span', 'b', 'i', 'strong', 'em', 'u', 'a', 'font'];
  let count = 0;

  for (const tag of inlineTags) {
    $(tag).each((_, el) => {
      if (isEmptyRemovableElement($, el)) {
        $(el).remove();
        count++;
      }
    });
  }

  return count;
}

/**
 * Flatten nested identical formatting elements
 */
function flattenNestedFormatting($: cheerio.CheerioAPI): number {
  const formattingTags = ['b', 'i', 'strong', 'em', 'u'];
  let count = 0;

  for (const tag of formattingTags) {
    $(`${tag} ${tag}`).each(function () {
      const inner = $(this);
      const outer = inner.parent(tag);
      if (outer.length > 0) {
        inner.contents().unwrap();
        count++;
      }
    });
  }

  return count;
}

/** Normalize a single text node's whitespace */
function normalizeTextNodeWhitespace(node: DomText): boolean {
  if (!node.data) return false;
  const original = node.data;
  const normalized = original.replace(/[\s\t\n\r]+/g, ' ');
  if (normalized !== original) {
    // eslint-disable-next-line no-param-reassign -- DOM text node mutation is intentional
    node.data = normalized;
    return true;
  }
  return false;
}

/**
 * Normalize whitespace in text nodes
 */
function normalizeWhitespace($: cheerio.CheerioAPI): number {
  let count = 0;
  $('body').find('*').contents().each(function () {
    if (this.type === 'text' && normalizeTextNodeWhitespace(this as DomText)) {
      count++;
    }
  });
  return count;
}

/** Normalize Unicode in a single text node */
function normalizeTextNodeUnicode(node: DomText): boolean {
  if (!node.data) return false;
  const original = node.data;
  const normalized = original.normalize('NFC');
  if (normalized !== original) {
    // eslint-disable-next-line no-param-reassign -- DOM text node mutation is intentional
    node.data = normalized;
    return true;
  }
  return false;
}

/**
 * Normalize Unicode text to NFC form
 */
function normalizeUnicode($: cheerio.CheerioAPI): number {
  let count = 0;
  $('body').find('*').contents().each(function () {
    if (this.type === 'text' && normalizeTextNodeUnicode(this as DomText)) {
      count++;
    }
  });
  return count;
}

/** Entity replacements for normalization */
const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&mdash;': '\u2014', // —
  '&ndash;': '\u2013', // –
  '&lsquo;': '\u2018', // '
  '&rsquo;': '\u2019', // '
  '&ldquo;': '\u201C', // "
  '&rdquo;': '\u201D', // "
  '&hellip;': '\u2026', // …
  '&amp;': '&',
};

/** Replace entities in text */
function replaceEntitiesInText(text: string): { result: string; modified: boolean } {
  let result = text;
  let modified = false;
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    if (result.includes(entity)) {
      result = result.split(entity).join(char);
      modified = true;
    }
  }
  return { result, modified };
}

/**
 * Normalize common HTML entities
 */
function normalizeEntities($: cheerio.CheerioAPI): number {
  let count = 0;
  $('body').find('*').contents().each(function () {
    if (this.type === 'text' && (this as DomText).data) {
      const node = this as DomText;
      const { result, modified } = replaceEntitiesInText(node.data);
      if (modified) {
        node.data = result;
        count++;
      }
    }
  });
  return count;
}

/**
 * Remove volatile data-* attributes
 */
function removeVolatileDataAttributes($: cheerio.CheerioAPI): void {
  $('[data-tracking]').removeAttr('data-tracking');
  $('[data-ad-unit]').removeAttr('data-ad-unit');
  $('[data-load-time]').removeAttr('data-load-time');
  $('[data-timestamp]').removeAttr('data-timestamp');
}

/**
 * Normalize relative URLs to absolute using the base URL.
 * This ensures consistent URL representation across different page fetches.
 */
function normalizeUrls($: cheerio.CheerioAPI, baseUrl: string): number {
  let count = 0;

  // Validate base URL
  try {
    new URL(baseUrl);
  } catch {
    // Invalid base URL, skip normalization
    return 0;
  }

  // Normalize href attributes
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#')) {
      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        $(el).attr('href', absoluteUrl);
        count++;
      } catch {
        // Invalid URL, skip
      }
    }
  });

  // Normalize src attributes (images, scripts, etc.)
  $('[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:')) {
      try {
        const absoluteUrl = new URL(src, baseUrl).href;
        $(el).attr('src', absoluteUrl);
        count++;
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return count;
}

/**
 * Apply all normalization steps
 */
function normalizeHtml($: cheerio.CheerioAPI): NormalizationStats {
  const stats: NormalizationStats = {
    emptyRemoved: 0,
    nestedFlattened: 0,
    whitespaceNormalized: 0,
    commentsRemoved: 0,
  };

  stats.commentsRemoved = removeComments($);
  stats.emptyRemoved = removeEmptyInlineElements($);
  stats.nestedFlattened = flattenNestedFormatting($);
  stats.whitespaceNormalized = normalizeWhitespace($);

  normalizeUnicode($);
  normalizeEntities($);
  removeVolatileDataAttributes($);

  return stats;
}

/** Remove elements matching selectors from profile */
function removeProfileElements($: cheerio.CheerioAPI, profile: CleaningProfile): number {
  let removedCount = 0;
  for (const selector of profile.removeSelectors) {
    try {
      const elements = $(selector);
      removedCount += elements.length;
      elements.remove();
    } catch {
      // Selector may be invalid, skip
    }
  }
  return removedCount;
}

// ============================================================================
// Main Cleaning Function
// ============================================================================

/**
 * Clean and normalize HTML for server-side tokenization.
 *
 * This ensures XPath consistency with client-side cleaned HTML that users
 * see during annotation, and standardizes text for accurate token matching.
 */
export function cleanHtmlForTokenization(html: string, url: string): CleaningResult {
  const sourceType = detectSourceType(url);
  const profile = getProfile(sourceType);
  const $ = cheerio.load(html);

  // Step 1: Remove elements that match selectors
  const removedCount = removeProfileElements($, profile);

  // Step 2: Apply normalizations
  const normStats = normalizeHtml($);

  // Step 3: Normalize URLs to absolute paths
  const urlsNormalized = normalizeUrls($, url);

  const normalizedCount =
    normStats.emptyRemoved +
    normStats.nestedFlattened +
    normStats.whitespaceNormalized +
    normStats.commentsRemoved +
    urlsNormalized;

  logger.debug('Server HTML cleaning complete', {
    url,
    sourceType,
    removedCount,
    normalizedCount,
    urlsNormalized,
    ...normStats,
  });

  return {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Fallback for edge cases where cheerio returns empty
    html: $.html() ?? html,
    removedCount,
    normalizedCount,
    sourceType,
  };
}

/**
 * Check if HTML should be cleaned before tokenization.
 *
 * Returns true for sources where cleaning is known to cause XPath shifts.
 */
export function shouldCleanForTokenization(url: string): boolean {
  const sourceType = detectSourceType(url);
  // Always clean for fandom - they have many removable elements
  // Wikipedia is cleaner, but still benefits
  // ComicVine has forum navigation that causes TAGS noise
  return sourceType === 'fandom' || sourceType === 'wikipedia' || sourceType === 'comicvine';
}
