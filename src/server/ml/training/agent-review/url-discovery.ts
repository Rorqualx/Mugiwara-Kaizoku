/**
 * URL Discovery
 *
 * Discovers related chapter and volume page URLs from labeled pages.
 * These discovered URLs can be automatically bootstrapped and queued for review.
 */

import {
  detectPageType,
  isChapterPageUrl,
  isVolumePageUrl,
} from './page-type-detector';

import type { DiscoveredUrl, PageType } from './types';

// ============================================================================
// Types
// ============================================================================

interface TokenWithLink {
  index: number;
  text: string;
  linkHref?: string | null;
  label?: string;
}

interface DiscoveryContext {
  pageUrl: string;
  pageType: PageType;
  tokens: TokenWithLink[];
}

// ============================================================================
// URL Normalization
// ============================================================================

/**
 * Normalize a URL to absolute form
 */
function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    // Handle relative URLs
    if (href.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.origin}${href}`;
    }

    // Handle already absolute URLs
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }

    // Handle relative paths
    const base = new URL(baseUrl);
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/**
 * Check if URL is from same domain as base
 */
function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const urlHost = new URL(url).hostname;
    const baseHost = new URL(baseUrl).hostname;
    return urlHost === baseHost;
  } catch {
    return false;
  }
}

// ============================================================================
// URL Pattern Detection
// ============================================================================

/**
 * Check if link text suggests a chapter link
 */
function isChapterLinkText(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  return (
    /^chapter\s*\d+/i.test(lowerText) ||
    /^ch\.?\s*\d+/i.test(lowerText) ||
    /^episode\s*\d+/i.test(lowerText) ||
    /^ep\.?\s*\d+/i.test(lowerText)
  );
}

/**
 * Check if link text suggests a volume link
 */
function isVolumeLinkText(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  return (
    /^volume\s*\d+/i.test(lowerText) ||
    /^vol\.?\s*\d+/i.test(lowerText) ||
    /^tankōbon\s*\d+/i.test(lowerText) ||
    /^tankobon\s*\d+/i.test(lowerText)
  );
}

/**
 * Calculate priority score for a discovered URL
 */
function calculatePriority(pageType: PageType, linkText: string): number {
  let priority = 50;

  // Higher priority for individual pages
  if (pageType === 'INDIVIDUAL_CHAPTER' || pageType === 'INDIVIDUAL_VOLUME') {
    priority += 20;
  }

  // Higher priority if link text is explicit
  if (isChapterLinkText(linkText) || isVolumeLinkText(linkText)) {
    priority += 10;
  }

  // Lower priority for overview pages
  if (pageType === 'CHAPTER_OVERVIEW' || pageType === 'VOLUME_OVERVIEW') {
    priority -= 10;
  }

  return Math.max(0, Math.min(100, priority));
}

// ============================================================================
// Main Discovery Function
// ============================================================================

/**
 * Discover related chapter and volume URLs from a page's tokens
 */
export function discoverRelatedUrls(context: DiscoveryContext): DiscoveredUrl[] {
  const { pageUrl, tokens } = context;
  const discovered: DiscoveredUrl[] = [];
  const seenUrls = new Set<string>();

  for (const token of tokens) {
    // Skip tokens without links
    if (!token.linkHref) {
      continue;
    }

    // Normalize URL
    const normalizedUrl = normalizeUrl(token.linkHref, pageUrl);
    if (!normalizedUrl) {
      continue;
    }

    // Skip if already seen
    if (seenUrls.has(normalizedUrl)) {
      continue;
    }

    // Skip external domains
    if (!isSameDomain(normalizedUrl, pageUrl)) {
      continue;
    }

    // Skip if same as current page
    if (normalizedUrl === pageUrl) {
      continue;
    }

    // Detect page type of linked URL
    const linkedPageType = detectPageType(normalizedUrl);

    // Only interested in chapter and volume pages
    const isChapterPage = isChapterPageUrl(normalizedUrl);
    const isVolumePage = isVolumePageUrl(normalizedUrl);

    if (!isChapterPage && !isVolumePage) {
      continue;
    }

    // Calculate priority
    const priority = calculatePriority(linkedPageType, token.text);

    // Determine if should bootstrap
    const shouldBootstrap =
      linkedPageType === 'INDIVIDUAL_CHAPTER' || linkedPageType === 'INDIVIDUAL_VOLUME';

    seenUrls.add(normalizedUrl);
    discovered.push({
      url: normalizedUrl,
      pageType: linkedPageType,
      linkText: token.text,
      tokenIndex: token.index,
      shouldBootstrap,
      priority,
    });
  }

  // Sort by priority (highest first)
  return discovered.sort((a, b) => b.priority - a.priority);
}

/**
 * Filter discovered URLs to only those that should be bootstrapped
 */
export function getUrlsToBootstrap(discovered: DiscoveredUrl[]): DiscoveredUrl[] {
  return discovered.filter((url) => url.shouldBootstrap);
}

/**
 * Group discovered URLs by page type
 */
export function groupByPageType(
  discovered: DiscoveredUrl[]
): Record<PageType, DiscoveredUrl[]> {
  const grouped: Partial<Record<PageType, DiscoveredUrl[]>> = {};

  for (const url of discovered) {
    const existing = grouped[url.pageType] ?? [];
    existing.push(url);
    grouped[url.pageType] = existing;
  }

  return grouped as Record<PageType, DiscoveredUrl[]>;
}
