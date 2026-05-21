/**
 * ComicVine Pagination Helper
 *
 * Detects and handles pagination on ComicVine HTML pages.
 * Supports multiple pagination patterns used by ComicVine.
 *
 * @module pagination-helper
 */

import { logger } from '@/utils/logger';

import type { PaginationInfo } from './types';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';


/**
 * Common selectors for pagination elements on ComicVine
 */
const PAGINATION_SELECTORS = [
  '.paginate',
  '.pagination',
  'ul.pagination',
  '.pager',
  'nav[aria-label*="page"]',
] as const;

/**
 * Common selectors for "Next" page links
 */
const NEXT_PAGE_SELECTORS = [
  'a.next',
  'a[rel="next"]',
  '.paginate a.arrow:last-child',
  '.pagination li:last-child a',
] as const;

/**
 * Builds a full URL from a potentially relative href
 */
function buildFullUrl(href: string, baseUrl: URL): string {
  if (href.startsWith('http')) return href;
  return `${baseUrl.origin}${href.startsWith('/') ? href : `/${href}`}`;
}

/**
 * Checks if a link represents a "Next" page
 */
function isNextPageLink($link: Cheerio<Element>): boolean {
  const text = $link.text().trim().toLowerCase();
  return (
    text.includes('next') ||
    text === '»' ||
    text === '›' ||
    $link.hasClass('next') ||
    $link.attr('rel') === 'next'
  );
}

/**
 * Processes a single pagination link element
 */
function processPaginationLink(
  $: CheerioAPI,
  el: Element,
  baseUrl: URL,
  state: { pageUrls: string[]; totalPages: number; currentPage: number; nextPageUrl: string | null }
): void {
  const $link = $(el);
  const href = $link.attr('href');
  const text = $link.text().trim();

  if (!href) return;

  const fullUrl = buildFullUrl(href, baseUrl);
  const pageNum = parseInt(text, 10);

  // Track page number links
  if (!isNaN(pageNum) && pageNum > 0) {
    if (!state.pageUrls.includes(fullUrl)) {
      state.pageUrls.push(fullUrl);
    }
    if (pageNum > state.totalPages) {
      state.totalPages = pageNum;
    }
  }

  // Track active/current page
  if ($link.hasClass('active') || $link.parent().hasClass('active')) {
    const activeNum = parseInt(text, 10);
    if (!isNaN(activeNum)) {
      state.currentPage = activeNum;
    }
  }

  // Track next page link
  if (isNextPageLink($link)) {
    state.nextPageUrl = fullUrl;
  }
}

/**
 * Extracts pagination from a pagination container element
 */
function extractFromPaginationContainer(
  $: CheerioAPI,
  $pagination: Cheerio<Element>,
  baseUrl: URL
): { pageUrls: string[]; totalPages: number; currentPage: number; nextPageUrl: string | null } {
  const state = { pageUrls: [] as string[], totalPages: 1, currentPage: 1, nextPageUrl: null as string | null };

  $pagination.find('a').each((_, el) => {
    processPaginationLink($, el, baseUrl, state);
  });

  return state;
}

/**
 * Tries to find next page link using direct selectors
 */
function findNextPageDirect($: CheerioAPI, baseUrl: URL): string | null {
  for (const selector of NEXT_PAGE_SELECTORS) {
    const $next = $(selector).first();
    if ($next.length > 0) {
      const href = $next.attr('href');
      if (href) {
        logger.debug('[Pagination] Found next link', { selector });
        return buildFullUrl(href, baseUrl);
      }
    }
  }
  return null;
}

/**
 * Extracts total pages from item count text
 */
function extractTotalFromCount($: CheerioAPI): number {
  const issueCountText = $('.issue-count, .results-count').text();
  const countMatch = issueCountText.match(/of\s+(\d+)/i);
  if (countMatch?.[1]) {
    const totalItems = parseInt(countMatch[1], 10);
    const itemsPerPage = 100; // ComicVine default
    return Math.ceil(totalItems / itemsPerPage);
  }
  return 1;
}

/**
 * Extracts pagination info from ComicVine HTML page
 */
export function extractPaginationInfo(
  $: CheerioAPI,
  currentUrl: string
): PaginationInfo | null {
  const baseUrl = new URL(currentUrl);
  let state = { pageUrls: [] as string[], totalPages: 1, currentPage: 1, nextPageUrl: null as string | null };

  // Try each pagination selector
  for (const selector of PAGINATION_SELECTORS) {
    const $pagination = $(selector).first();
    if ($pagination.length === 0) continue;

    logger.debug('[Pagination] Found pagination element', { selector });
    state = extractFromPaginationContainer($, $pagination, baseUrl);
    if (state.pageUrls.length > 0 || state.nextPageUrl) break;
  }

  // Try direct next link if not found
  if (!state.nextPageUrl) {
    state.nextPageUrl = findNextPageDirect($, baseUrl);
  }

  // Check for total from count text
  const countTotal = extractTotalFromCount($);
  if (countTotal > state.totalPages) {
    state.totalPages = countTotal;
  }

  // Check URL for current page
  const urlPageParam = baseUrl.searchParams.get('page');
  if (urlPageParam) {
    state.currentPage = parseInt(urlPageParam, 10) || 1;
  }

  // No pagination detected
  if (state.pageUrls.length === 0 && !state.nextPageUrl && state.totalPages === 1) {
    logger.debug('[Pagination] No pagination found on page');
    return null;
  }

  return {
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    nextPageUrl: state.nextPageUrl,
    pageUrls: state.pageUrls,
  };
}

/**
 * Generates all page URLs for a paginated series
 */
export function generatePageUrls(baseUrl: string, totalPages: number): string[] {
  const urls: string[] = [];
  const url = new URL(baseUrl);

  for (let page = 1; page <= totalPages; page++) {
    url.searchParams.set('page', String(page));
    urls.push(url.toString());
  }

  return urls;
}

/**
 * Normalizes a URL for comparison
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Checks if a URL has already been visited
 */
export function isUrlVisited(url: string, visited: Set<string>): boolean {
  return visited.has(normalizeUrl(url));
}
