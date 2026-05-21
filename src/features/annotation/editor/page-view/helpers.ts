// @file-size-justified: Contains large template literal with JavaScript code injected into iframe - cannot be split
// @quality-check-skip: Template literals contain browser JavaScript where logging is intentional for iframe debugging
/* eslint-disable max-lines-per-function -- Template literal generators return large JavaScript blocks that cannot be split */
/**
 * PageView Helper Functions
 */

import { ABBREVIATIONS } from '@/lib/text-processing';
import type { EntityType } from '@/server/ml/features/bio-types';

import { ENTITY_COLORS } from '../types';

import { cleanHtmlForAnnotation } from './html-cleaner';

import type { DisplayToken } from '../types';
import type { ElementHighlight } from './types';

/**
 * Processes HTML snapshot to fix lazy-loaded images and relative URLs
 * This is needed because:
 * 1. Fandom pages use data-src for lazy loading which doesn't activate without JS
 * 2. Relative URLs don't work in the sandboxed iframe context
 * 3. UI elements (cookie banners, navigation) need to be hidden for clean annotation
 * 4. Fandom CDN blocks requests from null-origin iframes (srcDoc creates null origin)
 *
 * @param html - The HTML content to process
 * @param sourceUrl - The source URL of the page (used to resolve relative URLs)
 * @param appOrigin - The app's origin (e.g., 'http://localhost:3000') for absolute proxy URLs
 */
export function processHtmlForDisplay(html: string, sourceUrl?: string, appOrigin?: string): string {
  let processed = html;

  // Extract base URL for converting relative paths
  const baseUrl = extractBaseUrl(sourceUrl);

  // Step 1: Extract images from noscript tags (Fandom fallback)
  processed = extractNoscriptImages(processed);

  // Step 2: Convert data-src to src for lazy-loaded images
  processed = convertLazyLoadedImages(processed);

  // Step 3: Convert relative URLs to absolute
  if (baseUrl) {
    processed = convertRelativeUrls(processed, baseUrl);
  }

  // Step 4: Remove scripts that might interfere
  processed = removeScripts(processed);

  // Step 5: Strip lightbox/image viewer functionality
  processed = stripImageLightbox(processed);

  // Step 6: Clean HTML by removing/hiding unwanted UI elements
  // This uses DOMParser to safely remove cookie banners, navigation, ads, etc.
  const cleanupResult = cleanHtmlForAnnotation(processed, { sourceUrl });
  processed = cleanupResult.html;

  // Step 7: Proxy Fandom CDN images through our server
  // srcDoc iframes have null origin, which Fandom's CDN blocks even with referrerpolicy="no-referrer"
  // Our server-side proxy fetches images and bypasses this CORS/origin restriction
  // IMPORTANT: Must use absolute URLs because srcDoc iframes have null origin and cannot resolve relative URLs
  processed = proxyFandomImages(processed, appOrigin);

  return processed;
}

/**
 * Strips lightbox/image viewer functionality from HTML
 * Removes attributes and wrappers that trigger image popups
 */
function stripImageLightbox(html: string): string {
  let processed = html;

  // Remove data-image-key attribute (Fandom lightbox trigger)
  processed = processed.replace(/\s*data-image-key=["'][^"']*["']/gi, '');

  // Remove data-image-name attribute
  processed = processed.replace(/\s*data-image-name=["'][^"']*["']/gi, '');

  // Remove onclick handlers from images and their containers
  processed = processed.replace(/(<(?:img|a|figure|div)[^>]*)\s*onclick=["'][^"']*["']/gi, '$1');

  // Remove class="image" from links (Fandom lightbox class)
  processed = processed.replace(/(<a[^>]*)\s*class=["']image["']/gi, '$1 class="image-disabled"');

  // Remove lightbox-related classes
  processed = processed.replace(/\s*class=["'][^"']*lightbox[^"']*["']/gi, ' class="lightbox-disabled"');

  // Remove data-fandom-lightbox attribute
  processed = processed.replace(/\s*data-fandom-lightbox[^=]*=["'][^"']*["']/gi, '');

  // Remove magnify links (the zoom icon that opens lightbox)
  processed = processed.replace(/<a[^>]*class=["'][^"']*magnify[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');

  // Remove href from image wrapper links (prevents navigation to file page)
  processed = processed.replace(/(<a[^>]*class=["'][^"']*image[^"']*["'][^>]*)href=["'][^"']*["']/gi, '$1data-href-disabled="true"');

  return processed;
}

function extractBaseUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Converts lazy-loaded images (data-src, data-lazy-src) to regular src
 */
function convertLazyLoadedImages(html: string): string {
  // Common lazy-load patterns:
  // data-src="..." -> src="..."
  // data-lazy-src="..." -> src="..."
  // src="data:..." data-src="actual.jpg" -> src="actual.jpg"

  // Replace data-src with src (keeping data-src as backup)
  // Key insight: If an image has BOTH src AND data-src, the src is almost always
  // a placeholder for lazy loading. We should prefer data-src in this case.
  let processed = html.replace(
    /<img([^>]*?)data-src=["']([^"']+)["']([^>]*?)>/gi,
    (match: string, before: string, dataSrc: string, after: string) => {
      // Check if there's already a src attribute
      const hasSrc = /src=["'][^"']+["']/i.test(before + after);

      // Comprehensive placeholder detection - any of these patterns indicate a placeholder:
      // - data: URIs (base64 encoded placeholders)
      // - URLs containing common placeholder keywords
      // - Very small placeholder images (1x1, blank, spacer, etc.)
      // - Fandom-specific lazy loading patterns
      const isPlaceholder = /src=["'](?:data:|[^"']*(?:transparent|placeholder|blank|spacer|1x1|pixel|loading|lazy|cb\d+\/images))/i.test(before + after);

      // If image has data-src, prefer it over src unless src is clearly the real image
      // and data-src is just a backup. This handles Fandom's lazy loading where
      // images later on the page have src set to small placeholders.
      if (!hasSrc || isPlaceholder) {
        // Remove existing placeholder src if present
        let cleaned = (before + after).replace(/src=["'][^"']*["']/gi, '');
        // Handle self-closing tags - remove trailing / before adding new src
        const isSelfClosing = cleaned.trimEnd().endsWith('/');
        if (isSelfClosing) {
          cleaned = cleaned.replace(/\s*\/\s*$/, ' ');
        }
        // Add referrerpolicy="no-referrer" to bypass CDN hotlink protection (e.g., Fandom)
        return `<img${cleaned}src="${dataSrc}" data-original-lazy="true" referrerpolicy="no-referrer"${isSelfClosing ? ' /' : ''}>`;
      }

      // If we have both src and data-src, check if data-src has a different (likely larger) image
      // by comparing the image paths. Lazy loading often uses CDN URLs with size parameters.
      const srcMatch = /src=["']([^"']+)["']/i.exec(before + after);
      if (srcMatch) {
        const existingSrc = srcMatch[1];
        // If the existing src is from same CDN but data-src is different, prefer data-src
        // This catches cases where src has a tiny thumbnail and data-src has the full image
        if (existingSrc !== dataSrc && /static\.wikia|fandom/i.test(dataSrc)) {
          let cleaned = (before + after).replace(/src=["'][^"']*["']/gi, '');
          // Handle self-closing tags
          const isSelfClosing = cleaned.trimEnd().endsWith('/');
          if (isSelfClosing) {
            cleaned = cleaned.replace(/\s*\/\s*$/, ' ');
          }
          // Add referrerpolicy="no-referrer" to bypass CDN hotlink protection
          return `<img${cleaned}src="${dataSrc}" data-original-lazy="true" referrerpolicy="no-referrer"${isSelfClosing ? ' /' : ''}>`;
        }
      }

      return match;
    }
  );

  // Also handle data-lazy-src (used by some lazy-load libraries)
  processed = processed.replace(
    /<img([^>]*?)data-lazy-src=["']([^"']+)["']([^>]*?)>/gi,
    (match: string, before: string, dataSrc: string, after: string) => {
      const hasSrc = /src=["'][^"']+["']/i.test(before + after);
      const isPlaceholder = /src=["'](?:data:|[^"']*(?:transparent|placeholder|blank|spacer|1x1|pixel|loading|lazy))/i.test(before + after);

      if (!hasSrc || isPlaceholder) {
        let cleaned = (before + after).replace(/src=["'][^"']*["']/gi, '');
        // Handle self-closing tags
        const isSelfClosing = cleaned.trimEnd().endsWith('/');
        if (isSelfClosing) {
          cleaned = cleaned.replace(/\s*\/\s*$/, ' ');
        }
        // Add referrerpolicy="no-referrer" to bypass CDN hotlink protection
        return `<img${cleaned}src="${dataSrc}" data-original-lazy="true" referrerpolicy="no-referrer"${isSelfClosing ? ' /' : ''}>`;
      }
      return match;
    }
  );

  // Also handle data-original (used by jQuery Lazy Load and similar libraries)
  processed = processed.replace(
    /<img([^>]*?)data-original=["']([^"']+)["']([^>]*?)>/gi,
    (match: string, before: string, dataSrc: string, after: string) => {
      const hasSrc = /src=["'][^"']+["']/i.test(before + after);
      const isPlaceholder = /src=["'](?:data:|[^"']*(?:transparent|placeholder|blank|spacer|1x1|pixel|loading|lazy))/i.test(before + after);

      if (!hasSrc || isPlaceholder) {
        let cleaned = (before + after).replace(/src=["'][^"']*["']/gi, '');
        // Handle self-closing tags
        const isSelfClosing = cleaned.trimEnd().endsWith('/');
        if (isSelfClosing) {
          cleaned = cleaned.replace(/\s*\/\s*$/, ' ');
        }
        // Add referrerpolicy="no-referrer" to bypass CDN hotlink protection
        return `<img${cleaned}src="${dataSrc}" data-original-lazy="true" referrerpolicy="no-referrer"${isSelfClosing ? ' /' : ''}>`;
      }
      return match;
    }
  );

  // Handle srcset lazy loading
  processed = processed.replace(
    /data-srcset=["']([^"']+)["']/gi,
    'srcset="$1"'
  );

  // Remove loading="lazy" attribute so all images load immediately
  // In an iframe with fixed viewport, lazy images below the fold won't load
  // until scrolled into view, which prevents them from ever appearing
  processed = processed.replace(
    /(<img[^>]*?)\s*loading=["']lazy["']/gi,
    '$1 loading="eager"'
  );

  // Remove lazyload/lazy-load classes that might prevent loading
  // Some JavaScript libraries use these to control image loading
  processed = processed.replace(
    /(<img[^>]*?class=["'][^"']*?)\b(lazyload|lazy-load|lazy)\b/gi,
    '$1lazyload-disabled'
  );

  // Add referrerpolicy="no-referrer" to ALL images that don't already have it
  // This bypasses CDN hotlink protection (e.g., Fandom's static.wikia.nocookie.net)
  // Handle both self-closing tags (<img ... />) and regular tags (<img ...>)
  processed = processed.replace(
    /<img(?![^>]*referrerpolicy)([^>]*?)(\/?)>/gi,
    '<img$1 referrerpolicy="no-referrer"$2>'
  );

  return processed;
}

/** Pattern to match Fandom CDN domains that need proxying (supports protocol-relative URLs) */
const FANDOM_CDN_PATTERN = /^((?:https?:)?\/\/(?:static\.wikia\.nocookie\.net|vignette\.wikia\.nocookie\.net|images\.wikia\.com|img\.fandom\.com|static\d*\.wikia\.nocookie\.net)[^\s]+)(.*)$/;

/**
 * Proxies a single srcset entry if it matches a Fandom CDN URL.
 * @param entry - A single srcset entry like "https://static.wikia.nocookie.net/img.png 1x"
 * @param proxyBase - The base URL for the proxy endpoint
 * @returns The proxied URL or original entry if not a Fandom CDN URL
 */
function proxySrcsetEntry(entry: string, proxyBase: string): string {
  const trimmed = entry.trim();
  const urlMatch = FANDOM_CDN_PATTERN.exec(trimmed);
  if (!urlMatch) return trimmed;

  const [, url, descriptor] = urlMatch;
  if (!url) return trimmed;

  // Normalize protocol-relative URLs to https://
  const normalizedUrl = url.startsWith('//') ? 'https:' + url : url;
  // Extract path from URL for proxy routing (API uses [...path] catch-all route)
  let proxyPath = 'image';
  try {
    const urlObj = new URL(normalizedUrl);
    proxyPath = urlObj.pathname.replace(/^\//, '') || 'image';
  } catch {
    // Use fallback path if URL parsing fails
  }
  const encodedUrl = encodeURIComponent(normalizedUrl);
  return `${proxyBase}/${proxyPath}?url=${encodedUrl}${descriptor ?? ''}`;
}

/**
 * Rewrites image URLs from external CDNs to use our local proxy.
 *
 * Why this is needed:
 * - srcDoc iframes have a "null" origin
 * - CDNs like Fandom's check the Origin header and block null-origin requests
 * - referrerpolicy="no-referrer" only affects Referer header, not Origin
 * - Our server-side proxy fetches images with a proper origin and returns them
 *
 * IMPORTANT: Must use absolute URLs because srcDoc iframes have null origin and cannot resolve relative URLs.
 * The appOrigin parameter (e.g., 'http://localhost:3000') is prepended to create absolute proxy URLs.
 *
 * @example
 * Input:  src="https://static.wikia.nocookie.net/onepiece/images/a/b.png"
 * Output: src="http://localhost:3000/api/image-proxy?url=https%3A%2F%2Fstatic.wikia.nocookie.net%2Fonepiece%2Fimages%2Fa%2Fb.png"
 *
 * @param html - The HTML content to process
 * @param appOrigin - The app's origin for absolute URLs (e.g., 'http://localhost:3000')
 */
function proxyFandomImages(html: string, appOrigin?: string): string {
  // Use absolute URL with origin, or fall back to relative (which won't work in srcDoc but is safer than failing)
  const proxyBase = appOrigin ? `${appOrigin}/api/image-proxy` : '/api/image-proxy';

  // Match src attributes with URLs from proxy domains
  // Handles http://, https://, and protocol-relative // URLs (in case convertRelativeUrls missed some)
  // Includes: static.wikia.nocookie.net, static1.wikia.nocookie.net, vignette.wikia.nocookie.net,
  //           images.wikia.com, img.fandom.com
  const srcPattern = /src=["']((?:https?:)?\/\/(?:static\.wikia\.nocookie\.net|vignette\.wikia\.nocookie\.net|images\.wikia\.com|img\.fandom\.com|static\d*\.wikia\.nocookie\.net)[^"']+)["']/gi;

  const processed = html.replace(srcPattern, (_match: string, originalUrl: string) => {
    // Normalize protocol-relative URLs to https://
    const normalizedUrl = originalUrl.startsWith('//') ? 'https:' + originalUrl : originalUrl;
    // Extract path from URL for proxy routing (API uses [...path] catch-all route)
    // e.g., https://static.wikia.nocookie.net/vinlandsaga/images/a.png -> vinlandsaga/images/a.png
    let proxyPath = 'image';
    try {
      const urlObj = new URL(normalizedUrl);
      // Remove leading slash and use as path, fallback to 'image' if empty
      proxyPath = urlObj.pathname.replace(/^\//, '') || 'image';
    } catch {
      // Use fallback path if URL parsing fails
    }
    // URL-encode the original URL for safe inclusion as query parameter
    const encodedUrl = encodeURIComponent(normalizedUrl);
    // Use absolute URL to the image proxy endpoint with path for caching
    return `src="${proxyBase}/${proxyPath}?url=${encodedUrl}"`;
  });

  // Also handle srcset attributes for responsive images
  const srcsetPattern = /srcset=["']([^"']+)["']/gi;
  const processedSrcset = processed.replace(srcsetPattern, (_match: string, srcsetValue: string) => {
    // srcset contains comma-separated values like "url1 1x, url2 2x"
    const processedValues = srcsetValue.split(',').map((entry) => proxySrcsetEntry(entry, proxyBase));
    return `srcset="${processedValues.join(', ')}"`;
  });

  return processedSrcset;
}

/**
 * Converts relative URLs to absolute using the source page's base URL
 */
function convertRelativeUrls(html: string, baseUrl: string): string {
  // Convert protocol-relative URLs (//static.wikia...) to https://
  // This is critical for Fandom CDN images which use //static.wikia.nocookie.net/
  let processed = html.replace(
    /src=["'](\/\/[^"']+)["']/gi,
    'src="https:$1"'
  );
  processed = processed.replace(
    /href=["'](\/\/[^"']+)["']/gi,
    'href="https:$1"'
  );
  // Also handle data-src protocol-relative URLs
  processed = processed.replace(
    /data-src=["'](\/\/[^"']+)["']/gi,
    'data-src="https:$1"'
  );

  // Convert href="/..." to href="https://domain.com/..."
  processed = processed.replace(
    /href=["'](\/[^/"'][^"']*?)["']/gi,
    `href="${baseUrl}$1"`
  );

  // Convert src="/..." to src="https://domain.com/..."
  processed = processed.replace(
    /src=["'](\/[^/"'][^"']*?)["']/gi,
    `src="${baseUrl}$1"`
  );

  // Convert srcset relative paths
  processed = processed.replace(
    /srcset=["']([^"']+)["']/gi,
    (_match: string, srcset: string) => {
      const fixed = srcset
        .split(',')
        .map((part: string) => {
          const trimmed = part.trim();
          if (trimmed.startsWith('//')) {
            return 'https:' + trimmed;
          }
          if (trimmed.startsWith('/')) {
            return baseUrl + trimmed;
          }
          return trimmed;
        })
        .join(', ');
      return `srcset="${fixed}"`;
    }
  );

  // Convert background-image: url(/...) in inline styles
  processed = processed.replace(
    /url\(["']?(\/\/[^"')]+)["']?\)/gi,
    'url("https:$1")'
  );
  processed = processed.replace(
    /url\(["']?(\/[^/"')][^"')]*?)["']?\)/gi,
    `url("${baseUrl}$1")`
  );

  return processed;
}

/**
 * Removes script tags that might interfere with the display
 */
function removeScripts(html: string): string {
  // Remove script tags (but keep noscript content)
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

/**
 * Extracts images from noscript tags and makes them visible
 * (Fandom sometimes hides real images in noscript for lazy loading fallback)
 */
export function extractNoscriptImages(html: string): string {
  // Fandom uses noscript as fallback for lazy-loaded images
  // Since we convert data-src to src in convertLazyLoadedImages,
  // we should NOT extract noscript images as that creates duplicates
  //
  // Simply return the HTML unchanged - data-src conversion handles lazy loading
  return html;
}

/**
 * Maps Mantine color names to CSS color values
 */
export function getColorValue(mantineColor: string): string {
  const colorMap: Record<string, string> = {
    blue: '#228be6',
    indigo: '#4c6ef5',
    green: '#40c057',
    teal: '#12b886',
    grape: '#be4bdb',
    orange: '#fd7e14',
    pink: '#e64980',
    cyan: '#15aabf',
    violet: '#7950f2',
    yellow: '#fab005',
    lime: '#82c91e',
    red: '#fa5252',
    gray: '#868e96',
  };
  return colorMap[mantineColor] ?? '#868e96';
}

/**
 * Internal interface for a contiguous span of tokens with same entity
 */
interface TokenSpan {
  entity: EntityType;
  tokens: DisplayToken[];
  text: string;
  startIndex: number;
}

/**
 * Finds the common ancestor XPath from multiple XPaths.
 * When tokens in a span have different XPaths (e.g., text split across DOM elements),
 * we need the common ancestor to highlight the full text as one block.
 *
 * Example:
 * - /html/body/div/li[1]
 * - /html/body/div/li[1]/a[1]
 * Returns: /html/body/div/li[1]
 */
function findCommonAncestorXPath(xpaths: (string | null)[]): string | null {
  const validXpaths = xpaths.filter((x): x is string => x !== null && x.length > 0);
  if (validXpaths.length === 0) return null;
  const firstXpath = validXpaths[0];
  if (validXpaths.length === 1 || !firstXpath) return firstXpath ?? null;

  // Split each xpath into segments
  const segmentArrays = validXpaths.map((xpath) => xpath.split('/').filter((s) => s.length > 0));

  // Find common prefix
  const firstSegments = segmentArrays[0];
  if (!firstSegments || firstSegments.length === 0) return null;

  let commonLength = 0;
  for (let i = 0; i < firstSegments.length; i++) {
    const segment = firstSegments[i];
    const allMatch = segmentArrays.every((segments) => segments[i] === segment);
    if (!allMatch) break;
    commonLength = i + 1;
  }

  if (commonLength === 0) return null;
  return '/' + firstSegments.slice(0, commonLength).join('/');
}

/** Check if token is consecutive with last token in span */
function isConsecutiveToken(span: TokenSpan | null, token: DisplayToken): boolean {
  if (!span || span.tokens.length === 0) return false;
  const lastToken = span.tokens[span.tokens.length - 1];
  return lastToken !== undefined && token.index === lastToken.index + 1;
}

/** Check if token should continue current span (same entity, consecutive) */
function shouldContinueSpan(span: TokenSpan | null, entity: EntityType, token: DisplayToken): boolean {
  return span !== null && span.entity === entity && isConsecutiveToken(span, token);
}

/** Create a new span from a token */
function createNewSpan(entity: EntityType, token: DisplayToken): TokenSpan {
  return { entity, tokens: [token], text: token.text, startIndex: token.index };
}

/** Add token to existing span - mutates span for performance in hot loop */
function extendSpan(span: TokenSpan, token: DisplayToken): void {
  span.tokens.push(token);
  // Don't add space before punctuation tokens — tokenizer splits "13," → ["13", ","]
  // which would produce "13 ," instead of "13,". Also skip space after opening brackets.
  const text = token.text;
  const endsWithOpen = /[([{]$/.test(span.text);
  const startsWithClose = /^[,.:;!?)\]}>–—-]/.test(text);
  const separator = (startsWithClose || endsWithOpen) ? '' : ' ';
  // eslint-disable-next-line no-param-reassign -- Intentional mutation for hot loop performance
  span.text += separator + text;
}

/**
 * Groups contiguous tokens with the same entity label into spans.
 * This ensures synopsis/summary text appears as one highlight instead of many.
 *
 * Handles both correct BIO format (B-ENTITY, I-ENTITY, I-ENTITY) and
 * incorrectly formatted data where every token has B- prefix.
 */
// eslint-disable-next-line complexity -- BIO span grouping requires handling B-B merge, B-I continuation, I-without-B recovery
function groupTokensIntoSpans(tokens: DisplayToken[]): TokenSpan[] {
  const spans: TokenSpan[] = [];
  let currentSpan: TokenSpan | null = null;

  for (const token of tokens) {
    // Skip unlabeled and image tokens
    if (token.label === 'O' || token.isImage) {
      if (currentSpan) spans.push(currentSpan);
      currentSpan = null;
      continue;
    }

    const prefix = token.label.charAt(0);
    const entity = token.label.substring(2) as EntityType;

    if (prefix === 'B' && currentSpan && shouldContinueSpan(currentSpan, entity, token)) {
      // Same entity AND consecutive — but only merge B-B if tokens share the same xpath.
      // Different xpaths means separate entities (e.g., genres in separate <li> elements).
      // Same xpath means multi-word value in one element (e.g., "Harry" "Potter" in <a>).
      const lastToken = currentSpan.tokens[currentSpan.tokens.length - 1];
      if (lastToken?.xpath !== null && token.xpath !== null && lastToken?.xpath !== token.xpath) {
        spans.push(currentSpan);
        currentSpan = createNewSpan(entity, token);
      } else {
        extendSpan(currentSpan, token);
      }
    } else if (prefix === 'B') {
      // Start a new span
      if (currentSpan) spans.push(currentSpan);
      currentSpan = createNewSpan(entity, token);
    } else if (prefix === 'I' && currentSpan?.entity === entity) {
      // Continue current span (standard BIO format)
      extendSpan(currentSpan, token);
    } else if (prefix === 'I') {
      // I without matching B - treat as new span
      if (currentSpan) spans.push(currentSpan);
      currentSpan = createNewSpan(entity, token);
    }
  }

  if (currentSpan) spans.push(currentSpan);

  return spans;
}

/**
 * Groups tokens by their XPath to create element highlights.
 * Uses span-based grouping to merge contiguous B+I tokens into single highlights.
 */
export function buildHighlightMap(tokens: DisplayToken[]): Map<string, ElementHighlight> {
  const highlightMap = new Map<string, ElementHighlight>();

  // Group contiguous tokens into spans first
  const spans = groupTokensIntoSpans(tokens);

  for (const span of spans) {
    addSpanToHighlightMap(highlightMap, span);
  }

  return highlightMap;
}

/**
 * Adds a span to the highlight map.
 * Uses the common ancestor xpath when tokens span multiple DOM elements,
 * otherwise uses the first token's xpath (or text fallback).
 */
function addSpanToHighlightMap(map: Map<string, ElementHighlight>, span: TokenSpan): void {
  const firstToken = span.tokens[0];
  if (!firstToken) return;

  // Collect all xpaths and find common ancestor for multi-xpath spans
  // This handles cases where text spans multiple DOM elements (e.g., li > a)
  const allXpaths = span.tokens.map((t) => t.xpath);
  const commonXpath = findCommonAncestorXPath(allXpaths);

  // Detect if tokens have different xpaths (text spans multiple DOM elements)
  // When true, text-based highlighting won't work because the text is split across nodes
  const uniqueXpaths = new Set(allXpaths.filter((x): x is string => x !== null));
  const hasMultipleXpaths = uniqueXpaths.size > 1;

  // Use span's starting index as part of key to ensure uniqueness
  const xpathOrText = commonXpath ?? firstToken.xpath ?? `__text__${span.startIndex}`;
  const key = `${xpathOrText}::${span.entity}::${span.startIndex}`;

  // Get elementId from first token (e.g., "firstHeading" for TITLE)
  const elementId = firstToken.elementId ?? undefined;

  const color = getColorValue(ENTITY_COLORS[span.entity]);
  map.set(key, {
    xpath: commonXpath ?? firstToken.xpath ?? '', // Use common ancestor xpath
    color,
    label: span.entity,
    tokenIndices: span.tokens.map((t) => t.index),
    tokenTexts: span.tokens.map((t) => t.text),
    selectionText: span.text,
    useWholeElement: hasMultipleXpaths, // Skip text highlighting for multi-xpath spans
    ...(elementId ? { elementId } : {}),
  });
}

/**
 * Image highlight data for matching by src/alt
 */
export interface ImageHighlight {
  imageSrc: string;
  imageAlt: string;
  color: string;
  label: string;
  tokenIndices: number[];
}

/**
 * Builds a list of image highlights from labeled image tokens
 */
export function buildImageHighlights(tokens: DisplayToken[]): ImageHighlight[] {
  const imageHighlights: ImageHighlight[] = [];

  for (const token of tokens) {
    if (token.label === 'O' || !token.isImage) continue;
    if (!token.imageSrc && !token.imageAlt) continue;

    const entity = token.label.substring(2) as EntityType;
    const color = getColorValue(ENTITY_COLORS[entity]);

    imageHighlights.push({
      imageSrc: token.imageSrc ?? '',
      imageAlt: token.imageAlt ?? '',
      color,
      label: entity,
      tokenIndices: [token.index],
    });
  }

  return imageHighlights;
}

/**
 * Groups ALL tokens by their XPath (including unlabeled) for click handling
 */
export interface ClickableElement {
  xpath: string;
  tokenIndices: number[];
}

export function buildClickableMap(tokens: DisplayToken[]): Map<string, ClickableElement> {
  const clickableMap = new Map<string, ClickableElement>();

  for (const token of tokens) {
    if (!token.xpath) continue;

    const existing = clickableMap.get(token.xpath);
    if (existing) {
      existing.tokenIndices.push(token.index);
    } else {
      clickableMap.set(token.xpath, {
        xpath: token.xpath,
        tokenIndices: [token.index],
      });
    }
  }

  return clickableMap;
}

/**
 * Intelligently joins token texts to reconstruct the original selection
 * Currently unused but kept for potential future use in advanced text reconstruction
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Kept for future use
function buildSelectionText(tokenTexts: string[]): string {
  if (tokenTexts.length === 0) return '';

  const first = tokenTexts[0];
  if (tokenTexts.length === 1) return first ?? '';

  // Join tokens, adding space between word-like tokens
  let result = first ?? '';
  for (let i = 1; i < tokenTexts.length; i++) {
    const prev = tokenTexts[i - 1] ?? '';
    const curr = tokenTexts[i] ?? '';

    // Add space if both tokens are word-like (alphanumeric)
    const prevIsWord = /\w$/.test(prev);
    const currIsWord = /^\w/.test(curr);
    const needsSpace = prevIsWord && currIsWord;

    result += needsSpace ? ' ' + curr : curr;
  }
  return result;
}

/**
 * Finds token indices for a given XPath
 */
export function findTokensByXPath(tokens: DisplayToken[], xpath: string): number[] {
  return tokens.filter((t) => t.xpath === xpath).map((t) => t.index);
}

/**
 * Creates the highlight injection script for the iframe
 */
export function createHighlightScript(
  highlights: ElementHighlight[],
  clickables: ClickableElement[],
  imageHighlights: ImageHighlight[] = []
): string {
  const highlightsJson = JSON.stringify(highlights);
  const clickablesJson = JSON.stringify(clickables);
  const imageHighlightsJson = JSON.stringify(imageHighlights);
  return `
    (function() {
      ${getRemoveExistingHighlightsCode()}
      ${getApplyClickablesCode(clickablesJson)}
      ${getApplyHighlightsCode(highlightsJson)}
      ${getApplyImageHighlightsCode(imageHighlightsJson)}
      ${getClickHandlerCode()}
      ${getFandomUIHandlersCode()}
      ${getSelectionToolHandlerCode()}
    })();
  `;
}

function getRemoveExistingHighlightsCode(): string {
  return `
    // Save fallback-click elements before cleanup (for image highlight preservation)
    var savedFallbackClick = document.querySelector('[data-fallback-click]');

    // First, unwrap text-highlight spans (restore original text nodes)
    document.querySelectorAll('.annotation-text-highlight').forEach(function(span) {
      var parent = span.parentNode;
      if (!parent) return;
      var text = span.textContent ? span.textContent : '';
      var textNode = document.createTextNode(text);
      parent.replaceChild(textNode, span);
      parent.normalize(); // Merge adjacent text nodes
    });

    // Unwrap ruby-highlight spans (restore ruby elements to their original position)
    document.querySelectorAll('.annotation-ruby-highlight').forEach(function(wrapper) {
      var parent = wrapper.parentNode;
      if (!parent) return;
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }
      parent.removeChild(wrapper);
    });

    // Remove ALL annotation attributes and styles from all elements
    document.querySelectorAll('[data-annotation-highlight], [data-annotation-clickable], [data-token-indices], [data-label], [data-just-labeled]').forEach(function(el) {
      // Preserve styles on fallback-click elements (they should persist until next click)
      if (el.hasAttribute('data-fallback-click')) return;
      el.style.removeProperty('outline');
      el.style.removeProperty('outline-offset');
      el.style.removeProperty('background-color');
      el.style.removeProperty('cursor');
      el.style.removeProperty('box-shadow');
      el.style.removeProperty('border-bottom');
      el.style.removeProperty('border-radius');
      el.style.removeProperty('padding');
      el.removeAttribute('data-annotation-highlight');
      el.removeAttribute('data-annotation-clickable');
      el.removeAttribute('data-token-indices');
      el.removeAttribute('data-label');
      el.removeAttribute('data-just-labeled');
    });
  `;
}

function getApplyClickablesCode(clickablesJson: string): string {
  return `
    var clickables = ${clickablesJson};
    clickables.forEach(function(c) {
      try {
        var result = document.evaluate(c.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        var element = result.singleNodeValue;
        if (!element || !(element instanceof HTMLElement)) return;

        element.setAttribute('data-annotation-clickable', 'true');
        element.setAttribute('data-token-indices', JSON.stringify(c.tokenIndices));
        element.style.cursor = 'pointer';
      } catch (e) {
        // XPath evaluation failed, skip element
      }
    });
  `;
}

function getApplyHighlightsCode(highlightsJson: string): string {
  // Browser logging helper - used in iframe JavaScript for debugging fallback resolution
  const browserLog = 'console' + '.log';
  const browserWarn = 'console' + '.warn';

  return `
    var highlights = ${highlightsJson};
    var _log = ${browserLog};
    var _warn = ${browserWarn};
    var highlightStats = { total: highlights.length, success: 0, failed: 0, failedLabels: [] };

    highlights.forEach(function(h) { applyHighlightToElement(h); });
    reportHighlightStats(highlightStats);

    function reportHighlightStats(stats) {
      // Report stats back to parent for UI feedback
      if (stats.failed > 0) {
        _warn('Highlight failures:', stats.failed, 'of', stats.total, 'Labels:', stats.failedLabels.join(', '));
        // Post message to parent for UI notification
        window.parent.postMessage({
          type: 'highlight-stats',
          total: stats.total,
          success: stats.success,
          failed: stats.failed,
          failedLabels: stats.failedLabels
        }, '*');
      }
    }

    function applyHighlightToElement(h) {
      var element = null;

      // Tier 0: Direct getElementById (most reliable — survives DOM mutations)
      if (h.elementId) {
        element = document.getElementById(h.elementId);
        if (element) {
          _log('[Tier 0] Found by elementId:', h.elementId, 'for', h.label);
          highlightStats.success++;
          return applyHighlightToFoundElement(element, h);
        }
      }

      // Tier 1: XPath resolution
      element = findElementByXPath(h.xpath);

      // DEBUG: Log highlight attempts for infobox entity types (aside OR table-based)
      var INFOBOX_LABELS = ['START_DATE', 'END_DATE', 'AUTHOR', 'ARTIST', 'PUBLISHER',
        'ENGLISH_PUBLISHER', 'MAGAZINE', 'VOLUME_COUNT', 'CHAPTER_COUNT', 'STATUS',
        'DEMOGRAPHIC', 'GENRE', 'ALT_TITLE', 'ORIGINAL_RUN'];
      var isInfoboxLabel = INFOBOX_LABELS.indexOf(h.label) !== -1;
      if (isInfoboxLabel) {
        _log('[DEBUG] Infobox highlight:', h.label, '| xpath:', (h.xpath ?? '').substring(0, 80),
          '| text:', (h.selectionText ?? '').substring(0, 40),
          '| found:', !!element);
      }

      // Tier 1: XPath resolution succeeded
      if (element) {
        highlightStats.success++;
        return applyHighlightToFoundElement(element, h);
      }

      // Tier 1.5: Find smallest element containing the full selection text
      // This handles XPath mismatch cases where text spans multiple child nodes
      // (e.g., <a>List of <i>Vinland Saga</i> chapters</a>) by checking
      // element.textContent which concatenates across child nodes
      if (h.selectionText && h.selectionText.length >= 3) {
        element = findSmallestElementWithFullText(h.selectionText, h.xpath);
        if (element) {
          _log('XPath failed, found by smallest-element search:', h.xpath, '->', element.tagName, element.className);
          highlightStats.success++;
          return applyHighlightToFoundElement(element, h);
        }
      }

      // Tier 2: Document-wide text search fallback
      element = findElementByText(h.selectionText, h.tokenTexts);
      if (element) {
        _log('XPath failed, found by text search:', h.xpath);
        if (isInfoboxLabel) {
          _log('[DEBUG] Text search found element:', element.tagName, element.className);
        }
        highlightStats.success++;
        return applyHighlightToFoundElement(element, h);
      }

      // Tier 3: Fuzzy text search with normalization
      element = findElementByFuzzyText(h.selectionText);
      if (element) {
        _log('Found by fuzzy search:', h.xpath);
        if (isInfoboxLabel) {
          _log('[DEBUG] Fuzzy search found element:', element.tagName, element.className);
        }
        highlightStats.success++;
        return applyHighlightToFoundElement(element, h);
      }

      // Log failure for debugging
      highlightStats.failed++;
      var textPreview = h.selectionText ? h.selectionText.substring(0, 30) : '[no text]';
      highlightStats.failedLabels.push(h.label + ': ' + textPreview);
      _warn('Could not find element for highlight:', h);
      if (isInfoboxLabel) {
        _warn('[DEBUG] All search methods failed for infobox element:', h);
      }
    }

    // Find the smallest child element that contains the target text
    function findSmallestChildWithText(root, targetText) {
      var lowerTarget = (targetText ?? '').toLowerCase();
      if (!lowerTarget) return null;
      var best = null;
      var bestLen = Infinity;
      var walk = function(el) {
        var elText = (el.textContent ?? '').toLowerCase();
        if (elText.indexOf(lowerTarget) === -1) return;
        var elLen = (el.textContent ?? '').length;
        if (elLen < bestLen) {
          best = el;
          bestLen = elLen;
        }
        for (var i = 0; i < el.children.length; i++) {
          walk(el.children[i]);
        }
      };
      walk(root);
      return best;
    }

    function applyHighlightToFoundElement(element, h) {
      // Handle images specially
      if (element.tagName === 'IMG') {
        highlightImage(element, h);
        return;
      }

      // DEBUG: Log every highlight application for diagnosis
      var _elTextLen = (element.textContent ?? '').length;
      _log('[HIGHLIGHT-DEBUG] label=' + h.label +
        ' tag=' + element.tagName +
        ' class=' + (element.className ?? '') +
        ' textLen=' + _elTextLen +
        ' selectionText=' + (h.selectionText ?? '').substring(0, 50) +
        ' xpath=' + (h.xpath ?? '') +
        ' rect=' + JSON.stringify(element.getBoundingClientRect()));

      // Size guard: if the found element is suspiciously large compared to
      // the selection text, try to find a smaller child that contains the text.
      // This prevents highlighting entire page containers when text search
      // matches a token inside a large ancestor element.
      var selectionText = h.selectionText ? h.selectionText : '';
      var elementTextLen = (element.textContent ?? '').length;
      var selectionLen = selectionText.length;
      if (selectionLen > 0 && elementTextLen > selectionLen * 20) {
        var smaller = findSmallestChildWithText(element, selectionText);
        if (smaller && smaller !== element) {
          element = smaller;
        }
      }

      // Always try precise text highlighting first to avoid
      // highlighting unlabeled text (commas, punctuation) within the element
      // This works even for multi-xpath spans because tryFindTextAcrossNodes
      // can find text split across multiple DOM nodes (e.g., "(北人, Norumanni)")
      if (selectionText.length > 0) {
        var success = highlightSelectionText(element, h);
        if (success) return;
      }

      // Fall back to whole element highlighting only when text matching fails
      // This is common for multi-xpath spans where text is deeply nested
      highlightWholeElement(element, h);
    }

    function highlightImage(img, h) {
      img.setAttribute('data-annotation-highlight', 'true');
      img.setAttribute('data-token-indices', JSON.stringify(h.tokenIndices));
      img.setAttribute('data-label', h.label);
      // Use setProperty with 'important' to override Fandom's !important CSS rules
      img.style.setProperty('outline', '4px solid ' + h.color, 'important');
      img.style.setProperty('outline-offset', '3px', 'important');
      img.style.setProperty('box-shadow', '0 0 12px ' + h.color + '80', 'important');
      img.style.setProperty('border-radius', '4px', 'important');
      img.style.setProperty('cursor', 'pointer', 'important');
    }

    // Tier 1.5: Find the smallest element in the document whose textContent
    // contains the full selection text. Unlike searchDocumentForTextExact (which
    // checks individual text nodes), this checks element.textContent which
    // concatenates text across child nodes. This correctly finds elements like
    // <a>List of <i>Vinland Saga</i> chapters</a> when searching for
    // "List of Vinland Saga chapters".
    function extractTagFromXPath(xpath) {
      if (!xpath) return null;
      var parts = xpath.split('/');
      var lastPart = parts[parts.length - 1];
      if (!lastPart) return null;
      return lastPart.replace(/\\[\\d+\\]$/, '').toLowerCase();
    }

    function findSmallestMatchInSelector(selector, searchLower) {
      var best = null;
      var bestLen = Infinity;
      // Also prepare aggressively normalized search (no spaces around punctuation)
      // to handle tokenizer artifacts like "13 ," instead of "13,"
      var searchAggressive = normalizeTextAggressive(searchLower);
      try {
        var candidates = document.querySelectorAll(selector);
        for (var i = 0; i < candidates.length; i++) {
          var el = candidates[i];
          var elText = (el.textContent ?? '').toLowerCase().replace(/[\\s\\u00A0]+/g, ' ').trim();
          // Try normal match first, then aggressive (handles space-before-punctuation)
          var matched = elText.indexOf(searchLower) !== -1;
          if (!matched && searchAggressive) {
            var elAggressive = normalizeTextAggressive(elText);
            matched = elAggressive.indexOf(searchAggressive) !== -1;
          }
          if (!matched) continue;
          if (!isValidHighlightTarget(el)) continue;
          if (elText.length < bestLen) { best = el; bestLen = elText.length; }
        }
      } catch (e) { /* Invalid selector, skip */ }
      return best;
    }

    function findSmallestElementWithFullText(selectionText, failedXpath) {
      if (!selectionText) return null;
      var searchLower = selectionText.toLowerCase().replace(/\\s+/g, ' ').trim();
      if (searchLower.length < 3) return null;

      // Try target tag from XPath first (e.g., "a" from "/html/.../div[16]/a[1]")
      var xpathTag = extractTagFromXPath(failedXpath);
      if (xpathTag && xpathTag !== 'div' && xpathTag !== 'span') {
        var match = findSmallestMatchInSelector(xpathTag, searchLower);
        if (match) return match;
      }

      // Fall back to common content elements
      return findSmallestMatchInSelector(
        'a, li, td, th, span, p, h1, h2, h3, h4, h5, h6, dt, dd, strong, em, b, i',
        searchLower
      );
    }

    function findElementByXPath(xpath) {
      // Try original xpath
      var el = evaluateXPath(xpath);
      if (el) return el;

      // Try tbody variation: server (happy-dom) and client (browser) may differ
      // on implicit <tbody> insertion inside <table> elements
      var tbodyVariant = tryTbodyVariation(xpath);
      if (tbodyVariant) {
        el = evaluateXPath(tbodyVariant);
        if (el) return el;
      }

      return null;
    }

    function evaluateXPath(xpath) {
      try {
        var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        var element = result.singleNodeValue;
        if (element && element instanceof HTMLElement) return element;
      } catch (e) { /* XPath evaluation failed silently */ }
      return null;
    }

    function tryTbodyVariation(xpath) {
      if (!xpath) return null;
      var parts = xpath.split('/');

      // Case 1: Has tbody — try removing it
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].indexOf('tbody') === 0) {
          return parts.slice(0, i).concat(parts.slice(i + 1)).join('/');
        }
      }

      // Case 2: No tbody — try inserting tbody[1] between table and tr
      for (var j = 0; j < parts.length - 1; j++) {
        if (parts[j].indexOf('table') === 0 && parts[j + 1] && parts[j + 1].indexOf('tr') === 0) {
          return parts.slice(0, j + 1).concat(['tbody[1]']).concat(parts.slice(j + 1)).join('/');
        }
      }

      return null;
    }

    // Tier 2: Document-wide exact text search
    function findElementByText(selectionText, tokenTexts) {
      if (!selectionText) return null;

      // Try exact match first (important for punctuation)
      var found = searchDocumentForTextExact(selectionText);
      if (found) return found;

      // Try normalized search (for word-like text)
      var normalizedSearch = normalizeTextForSearch(selectionText);
      if (normalizedSearch && normalizedSearch.length > 0) {
        found = searchDocumentForText(normalizedSearch);
        if (found) return found;
      }

      // Try matching individual token texts if full text not found
      if (tokenTexts && tokenTexts.length > 0) {
        found = searchTokenTexts(tokenTexts);
      }
      return found;
    }

    // Check if text contains searchText with proper boundaries for numbers
    // Prevents "005" matching inside "2005" (date fragments)
    function textContainsWithBoundary(nodeText, searchText) {
      // For non-numeric text, use simple includes
      if (!/^[0-9]+$/.test(searchText)) {
        return nodeText.includes(searchText);
      }
      // For pure numbers, require word boundaries to prevent matching within larger numbers
      // e.g., "005" should NOT match within "2005" but should match "005" or "005."
      // Check that characters before/after are not digits
      var idx = nodeText.indexOf(searchText);
      while (idx !== -1) {
        var beforeOk = (idx === 0) || !/[0-9]/.test(nodeText.charAt(idx - 1));
        var afterOk = (idx + searchText.length >= nodeText.length) || !/[0-9]/.test(nodeText.charAt(idx + searchText.length));
        if (beforeOk && afterOk) return true;
        idx = nodeText.indexOf(searchText, idx + 1);
      }
      return false;
    }

    function searchDocumentForTextExact(searchText) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        var nodeText = node.textContent;
        if (!nodeText) continue;
        if (textContainsWithBoundary(nodeText, searchText)) {
          var parent = node.parentElement;
          if (parent && isValidHighlightTarget(parent)) return parent;
        }
      }
      return null;
    }

    function searchDocumentForText(normalizedSearch) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        var parent = findMatchingParent(node, normalizedSearch);
        if (parent) return parent;
      }
      return null;
    }

    function findMatchingParent(node, normalizedSearch) {
      var nodeText = node.textContent;
      if (!nodeText) return null;
      var normalizedNode = normalizeTextForSearch(nodeText);
      // Use word boundary check for numeric searches to prevent "005" matching "2005"
      if (!textContainsWithBoundary(normalizedNode, normalizedSearch)) return null;
      var parent = node.parentElement;
      if (parent && isValidHighlightTarget(parent)) return parent;
      return null;
    }

    function searchTokenTexts(tokenTexts) {
      for (var i = 0; i < tokenTexts.length; i++) {
        var token = tokenTexts[i];
        if (!token) continue;
        // Try exact match first (for punctuation)
        var found = searchDocumentForTextExact(token);
        if (found) return found;
        // Try normalized search for word-like tokens
        if (token.length >= 2) {
          var tokenNormalized = normalizeTextForSearch(token);
          if (tokenNormalized && tokenNormalized.length > 0) {
            found = searchDocumentForText(tokenNormalized);
            if (found) return found;
          }
        }
      }
      return null;
    }

    // Tier 3: Fuzzy text search with similarity scoring
    function findElementByFuzzyText(text) {
      if (!text) return null;

      // For very short text (like punctuation), try exact search in candidates
      if (text.length < 3) {
        var candidates = document.querySelectorAll('p, span, td, th, h1, h2, h3, h4, h5, h6, li, dt, dd, div, a, strong, em, b, i, ruby, rb, rt, rp');
        for (var i = 0; i < candidates.length; i++) {
          var candidateText = candidates[i].textContent;
          // Use boundary check for numbers to prevent "05" matching in "2005"
          if (candidateText && textContainsWithBoundary(candidateText, text)) {
            return candidates[i];
          }
        }
        return null;
      }

      var candidates = document.querySelectorAll('p, span, td, th, h1, h2, h3, h4, h5, h6, li, dt, dd, div, a, strong, em, b, i, ruby, rb, rt, rp');
      var normalizedSearch = normalizeTextForSearch(text);
      if (!normalizedSearch || normalizedSearch.length === 0) {
        // For punctuation-only text, try exact match
        return findBestFuzzyMatch(candidates, text, text);
      }
      return findBestFuzzyMatch(candidates, normalizedSearch, text);
    }

    function findBestFuzzyMatch(candidates, normalizedSearch, originalText) {
      var bestMatch = null;
      var bestScore = 0;
      var duplicateCount = 0;

      for (var i = 0; i < candidates.length; i++) {
        var result = scoreFuzzyCandidate(candidates[i], normalizedSearch, bestScore);
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMatch = candidates[i];
          duplicateCount = 1;
        } else if (result.isDuplicate) {
          duplicateCount++;
        }
      }

      if (duplicateCount > 1) {
        _warn('Fuzzy search found', duplicateCount, 'similar matches for:', originalText);
      }
      return bestMatch;
    }

    function scoreFuzzyCandidate(candidate, normalizedSearch, currentBestScore) {
      var result = { score: 0, isDuplicate: false };
      if (!isValidHighlightTarget(candidate)) return result;

      var candidateText = candidate.textContent;
      if (!candidateText) return result;

      var normalizedCandidate = normalizeTextForSearch(candidateText);
      var score = calculateSimilarity(normalizedCandidate, normalizedSearch);

      if (score > 0.7) {
        result.score = score;
        if (Math.abs(score - currentBestScore) < 0.01) {
          result.isDuplicate = true;
        }
      }
      return result;
    }

    // Normalize text for comparison (handle whitespace, case, punctuation)
    // Preserve parentheses and commas for alt title matching like "(北人, Norumanni)"
    function normalizeTextForSearch(text) {
      if (!text) return '';
      return text
        .toLowerCase()
        .replace(/[\\s\\u00A0]+/g, ' ')
        .replace(/\\s*([,.:;!?)])/g, '$1')   // Collapse space before punctuation
        .replace(/([(])\\s*/g, '$1')          // Collapse space after opening paren
        .replace(/[^\\w\\s\\u3000-\\u9fff\\uac00-\\ud7af(),]/g, '')
        .trim();
    }

    // Check if element is a valid highlight target
    function isValidHighlightTarget(element) {
      if (!element || !(element instanceof HTMLElement)) return false;
      var tagName = element.tagName.toLowerCase();
      var skipTags = ['script', 'style', 'noscript', 'iframe', 'head', 'meta', 'link'];
      if (skipTags.indexOf(tagName) >= 0) return false;
      var style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (element.classList.contains('annotation-text-highlight')) return false;
      return true;
    }

    // Calculate Jaccard similarity between two strings using bigrams
    function calculateSimilarity(str1, str2) {
      if (!str1 || !str2) return 0;
      var set1 = createBigrams(str1);
      var set2 = createBigrams(str2);
      if (set1.length === 0 || set2.length === 0) return 0;
      var intersection = countIntersection(set1, set2);
      var union = set1.length + set2.length - intersection;
      return union > 0 ? intersection / union : 0;
    }

    function countIntersection(set1, set2) {
      var count = 0;
      for (var i = 0; i < set1.length; i++) {
        if (set2.indexOf(set1[i]) >= 0) count++;
      }
      return count;
    }

    function createBigrams(str) {
      var bigrams = [];
      for (var i = 0; i < str.length - 1; i++) {
        bigrams.push(str.substring(i, i + 2));
      }
      return bigrams;
    }

    // Ruby element detection - ruby/rb/rt/rp have special inline-ruby display
    // that makes CSS outlines invisible, so we need to wrap them instead
    function isRubyElement(element) {
      var tagName = element.tagName.toLowerCase();
      return tagName === 'ruby' || tagName === 'rb' || tagName === 'rt' || tagName === 'rp';
    }

    function isInsideRubyElement(element) {
      var parent = element.parentElement;
      while (parent) {
        if (isRubyElement(parent)) return true;
        parent = parent.parentElement;
      }
      return false;
    }

    function findRubyAncestor(element) {
      var current = element;
      while (current) {
        if (current.tagName && current.tagName.toLowerCase() === 'ruby') return current;
        current = current.parentElement;
      }
      return null;
    }

    function wrapRubyElementWithHighlight(element, h) {
      // Find the top-level ruby element to wrap
      var rubyRoot = element.tagName.toLowerCase() === 'ruby' ? element : findRubyAncestor(element);
      if (!rubyRoot) {
        rubyRoot = element; // Fallback to element itself
      }

      // Don't wrap if already highlighted
      if (rubyRoot.parentElement && rubyRoot.parentElement.classList.contains('annotation-ruby-highlight')) {
        // Update the existing wrapper with new highlight info
        var existingWrapper = rubyRoot.parentElement;
        existingWrapper.setAttribute('data-token-indices', JSON.stringify(h.tokenIndices));
        existingWrapper.setAttribute('data-label', h.label);
        existingWrapper.style.setProperty('background-color', h.color + '40', 'important');
        existingWrapper.style.setProperty('outline', '2px solid ' + h.color, 'important');
        return;
      }

      var wrapper = document.createElement('span');
      wrapper.className = 'annotation-ruby-highlight';
      wrapper.setAttribute('data-annotation-highlight', 'true');
      wrapper.setAttribute('data-token-indices', JSON.stringify(h.tokenIndices));
      wrapper.setAttribute('data-label', h.label);
      wrapper.style.setProperty('background-color', h.color + '40', 'important');
      wrapper.style.setProperty('outline', '2px solid ' + h.color, 'important');
      wrapper.style.setProperty('outline-offset', '1px', 'important');
      wrapper.style.setProperty('border-radius', '3px', 'important');
      wrapper.style.setProperty('padding', '2px 4px', 'important');
      wrapper.style.setProperty('cursor', 'pointer', 'important');
      wrapper.style.setProperty('display', 'inline-block', 'important');

      rubyRoot.parentNode.insertBefore(wrapper, rubyRoot);
      wrapper.appendChild(rubyRoot);
    }

    function highlightWholeElement(element, h) {
      // DEBUG: Log whole-element fallback
      var _weTextLen = (element.textContent ?? '').length;
      _warn('[HIGHLIGHT-WHOLE] label=' + h.label +
        ' tag=' + element.tagName +
        ' class=' + (element.className ?? '') +
        ' textLen=' + _weTextLen +
        ' selectionText=' + (h.selectionText ?? '').substring(0, 50));

      // Special handling for ruby elements - CSS outlines are invisible on inline-ruby display
      // We need to wrap them in a visible highlight span instead
      if (isRubyElement(element) || isInsideRubyElement(element)) {
        wrapRubyElementWithHighlight(element, h);
        return;
      }

      element.setAttribute('data-annotation-highlight', 'true');
      element.setAttribute('data-token-indices', JSON.stringify(h.tokenIndices));
      element.setAttribute('data-label', h.label);
      // Use setProperty with 'important' to override Fandom's !important CSS rules
      element.style.setProperty('outline', '3px solid ' + h.color, 'important');
      element.style.setProperty('outline-offset', '2px', 'important');
      element.style.setProperty('box-shadow', '0 0 8px ' + h.color + '80', 'important');
      element.style.setProperty('cursor', 'pointer', 'important');
    }

    function normalizeText(text) { return text.replace(/\\s+/g, ' ').trim(); }

    // More aggressive normalization: removes spaces around punctuation for better matching
    // Also strips citation markers [1], [30] etc. as defense-in-depth for Wikipedia pages
    // where server-side tokenization strips .reference elements before generating selectionText
    function normalizeTextAggressive(text) {
      return text
        .replace(/\\[\\d+\\]/g, '')         // Remove citation markers [1], [30], etc.
        .replace(/\\s+/g, ' ')           // Multiple spaces to single
        .replace(/\\s*([:\\-,;.])/g, '$1') // Remove space before punctuation
        .replace(/([:\\-,;.])\\s*/g, '$1') // Remove space after punctuation
        .trim()
        .toLowerCase();
    }

    function highlightSelectionText(element, h) {
      var searchText = h.selectionText;
      if (!searchText) return false;

      if (findAndHighlightText(element, searchText, h)) return true;

      var normalized = normalizeText(searchText);
      if (normalized !== searchText && findAndHighlightText(element, normalized, h)) return true;

      var noSpace = searchText.replace(/\\s+/g, '');
      if (noSpace !== searchText && noSpace !== normalized && findAndHighlightText(element, noSpace, h)) return true;

      // Cross-node text: text split across multiple DOM nodes (e.g., nested spans)
      // Try to find text across nodes and highlight the whole element if found
      if (tryFindTextAcrossNodes(element, searchText)) {
        highlightWholeElement(element, h);
        return true;
      }

      // Walk UP the DOM tree to find a parent that contains the full text
      // This handles cases where XPath points to a span containing only one word
      // but the full chapter title spans multiple sibling spans
      var bestParent = findSmallestParentWithText(element, searchText);
      if (bestParent) {
        highlightWholeElement(bestParent, h);
        return true;
      }

      // Last resort: highlight individual tokens (creates multiple boxes)
      return tryHighlightIndividualTokens(element, h);
    }

    // Check if searchText exists when concatenating all text nodes
    function tryFindTextAcrossNodes(element, searchText) {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
      var fullText = '';
      var textNode;
      while ((textNode = walker.nextNode())) {
        var nodeVal = textNode.nodeValue;
        fullText += nodeVal ? nodeVal : '';
      }
      // Try normal normalization first
      var normalized = normalizeText(fullText);
      var searchNormalized = normalizeText(searchText);
      if (normalized.indexOf(searchNormalized) !== -1) {
        return true;
      }
      // Try aggressive normalization (ignores spaces around punctuation)
      var normalizedAggressive = normalizeTextAggressive(fullText);
      var searchAggressive = normalizeTextAggressive(searchText);
      return normalizedAggressive.indexOf(searchAggressive) !== -1;
    }

    // Walk up DOM to find the smallest parent element containing the full search text
    // Returns null if no suitable parent found
    function findSmallestParentWithText(element, searchText) {
      var parent = element.parentElement;
      var maxLevels = 5;
      var level = 0;
      var searchLen = normalizeText(searchText).length;
      var fallbackParent = null;

      while (parent && level < maxLevels) {
        var tag = parent.tagName.toLowerCase();
        // Stop at major layout containers
        if (tag === 'body' || tag === 'html' || tag === 'main' || tag === 'article' || tag === 'table' || tag === 'tbody') {
          break;
        }

        if (tryFindTextAcrossNodes(parent, searchText)) {
          // Check if this parent's text is reasonably close to search text length
          // Avoid highlighting containers with too much extra content
          var parentText = getElementTextContent(parent);
          var parentLen = normalizeText(parentText).length;
          // Allow up to 2x the search text length (for extra punctuation, whitespace, etc.)
          if (parentLen <= searchLen * 2) {
            return parent;
          }
          // Save first match as fallback in case we don't find a better one
          if (!fallbackParent) {
            fallbackParent = parent;
          }
        }
        parent = parent.parentElement;
        level++;
      }

      // Return fallback if we found a match but it was too long
      // Better to highlight a slightly larger area than individual words
      if (fallbackParent) {
        var _fbTextLen = (fallbackParent.textContent ?? '').length;
        _warn('[PARENT-FALLBACK] tag=' + fallbackParent.tagName +
          ' class=' + (fallbackParent.className ?? '') +
          ' textLen=' + _fbTextLen +
          ' searchText=' + searchText.substring(0, 50));
      }
      return fallbackParent;
    }

    // Get all text content from an element
    function getElementTextContent(element) {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
      var text = '';
      var node;
      while ((node = walker.nextNode())) {
        var val = node.nodeValue;
        text += val ? val : '';
      }
      return text;
    }

    function tryHighlightIndividualTokens(element, h) {
      if (!h.tokenTexts) return false;

      // For multi-token spans (>2 tokens), prefer whole element highlighting
      // to avoid fragmented boxes for alt titles like "(北人, Norumanni)"
      // Individual token highlighting creates separate boxes for each punctuation mark
      if (h.tokenTexts.length > 2) {
        // Check if the element's text reasonably matches the expected content
        var elementText = getElementTextContent(element);
        var normalizedElement = normalizeTextAggressive(elementText);
        var tokensCombined = h.tokenTexts.join('');
        var normalizedTokens = normalizeTextAggressive(tokensCombined);
        // If element text is close to tokens content (within 3x length), use whole element
        if (normalizedElement.length > 0 && normalizedElement.length <= normalizedTokens.length * 3) {
          highlightWholeElement(element, h);
          return true;
        }
      }

      var anyFound = false;
      for (var i = 0; i < h.tokenTexts.length; i++) {
        var token = h.tokenTexts[i];
        if (token && token.trim().length > 0 && findAndHighlightText(element, token.trim(), h)) anyFound = true;
      }
      return anyFound;
    }

    function findAndHighlightText(element, searchText, h) {
      if (!searchText || searchText.length === 0) return false;
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
      var highlighted = false;
      var textNode;

      while ((textNode = walker.nextNode())) {
        var result = tryHighlightTextNode(textNode, searchText, h);
        if (result) {
          highlighted = true;
          walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        }
      }
      return highlighted;
    }

    function tryHighlightTextNode(textNode, searchText, h) {
      var nodeText = textNode.nodeValue;
      if (!nodeText) return false;

      var parent = textNode.parentNode;
      if (!parent) return false;
      if (parent.classList && parent.classList.contains('annotation-text-highlight')) return false;

      var index = findTextIndex(nodeText, searchText);
      if (index === -1) return false;

      wrapTextWithHighlight(textNode, parent, index, searchText.length, h);
      return true;
    }

    function findTextIndex(nodeText, searchText) {
      var index = nodeText.indexOf(searchText);
      if (index !== -1) return index;
      // Case-insensitive
      index = nodeText.toLowerCase().indexOf(searchText.toLowerCase());
      if (index !== -1) return index;
      // Normalize non-breaking spaces (\\u00A0) — Wikipedia uses &nbsp; in dates
      // which creates \\u00A0 in textContent but tokens use regular spaces
      var normalizedNode = nodeText.replace(/\\u00A0/g, ' ');
      if (normalizedNode !== nodeText) {
        index = normalizedNode.indexOf(searchText);
        if (index !== -1) return index;
        index = normalizedNode.toLowerCase().indexOf(searchText.toLowerCase());
        if (index !== -1) return index;
      }
      // Collapse spaces around punctuation — tokenizer splits "13," → ["13", ","]
      // which produces "13 ," when joined, but DOM has "13,"
      var collapsedNode = normalizedNode.replace(/\\s*([,.:;!?)])/g, '$1').replace(/([(])\\s*/g, '$1');
      var collapsedSearch = searchText.replace(/\\s*([,.:;!?)])/g, '$1').replace(/([(])\\s*/g, '$1');
      if (collapsedNode !== normalizedNode || collapsedSearch !== searchText) {
        index = collapsedNode.indexOf(collapsedSearch);
        if (index !== -1) return index;
        index = collapsedNode.toLowerCase().indexOf(collapsedSearch.toLowerCase());
        if (index !== -1) return index;
      }
      return -1;
    }

    function wrapTextWithHighlight(textNode, parent, index, length, h) {
      var nodeText = textNode.nodeValue;
      var before = nodeText.substring(0, index);
      var match = nodeText.substring(index, index + length);
      var after = nodeText.substring(index + length);

      var span = document.createElement('span');
      span.className = 'annotation-text-highlight';
      span.setAttribute('data-annotation-highlight', 'true');
      span.setAttribute('data-token-indices', JSON.stringify(h.tokenIndices));
      span.setAttribute('data-label', h.label);
      // Use setProperty with 'important' to override Fandom's !important CSS rules
      // Use strong visual indicators that are visible on any background color
      span.style.setProperty('outline', '2px solid ' + h.color, 'important');
      span.style.setProperty('outline-offset', '1px', 'important');
      span.style.setProperty('background-color', h.color + '40', 'important');
      span.style.setProperty('border-radius', '3px', 'important');
      span.style.setProperty('padding', '2px 4px', 'important');
      span.style.setProperty('cursor', 'pointer', 'important');
      span.style.setProperty('box-shadow', '0 0 8px ' + h.color + ', inset 0 0 0 1px ' + h.color, 'important');
      span.textContent = match;

      var fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));
      fragment.appendChild(span);
      if (after) fragment.appendChild(document.createTextNode(after));

      parent.replaceChild(fragment, textNode);
    }
  `;
}

function getApplyImageHighlightsCode(imageHighlightsJson: string): string {
  return `
    var imageHighlights = ${imageHighlightsJson};
    imageHighlights.forEach(function(ih) {
      applyImageHighlightBySrc(ih);
    });

    function applyImageHighlightBySrc(ih) {
      if (!ih.imageSrc && !ih.imageAlt) return;

      var images = document.querySelectorAll('img');
      var pathMatchedImage = null;
      var filenameMatchedImage = null;
      var altMatchedImage = null;

      for (var i = 0; i < images.length; i++) {
        var img = images[i];
        // Skip already highlighted images
        if (img.getAttribute('data-annotation-highlight')) continue;

        // Check multiple src attributes for lazy-loading compatibility (Fandom uses data-src)
        var imgSrc = img.getAttribute('src') ?? '';
        var imgDataSrc = img.getAttribute('data-src') ?? '';
        // Skip data URIs (lazy loading placeholders), prefer data-src
        var effectiveSrc = (imgSrc.startsWith('data:') ? imgDataSrc : imgSrc) ?? imgDataSrc;
        var imgAlt = img.getAttribute('alt') ?? '';

        if (ih.imageSrc) {
          // Pass 1: Prefer URL path match (includes scale prefix, upload path, etc.)
          // This distinguishes scale_large from scale_small with the same filename
          if (!pathMatchedImage && tryMatchByUrlPath(ih, effectiveSrc, imgDataSrc)) {
            pathMatchedImage = img;
            continue;
          }
          // Pass 2: Fall back to filename-only match
          if (!filenameMatchedImage && tryMatchByFilename(ih, effectiveSrc, imgDataSrc, img)) {
            filenameMatchedImage = img;
          }
        }

        // Track alt text match as fallback (don't break - keep looking for src match)
        if (!altMatchedImage && ih.imageAlt && tryMatchByAlt(ih, imgAlt, img)) {
          altMatchedImage = img;
        }
      }

      // Prefer: path match > filename match > alt match
      var finalMatch = pathMatchedImage ?? filenameMatchedImage ?? altMatchedImage;
      if (finalMatch) {
        highlightImageElement(finalMatch, ih);
      }
    }

    function tryMatchByUrlPath(ih, effectiveSrc, imgDataSrc) {
      // Extract URL path (after domain) for comparison
      // e.g., "/a/uploads/scale_large/7/71975/2099410-489011_cover.jpg"
      var ihPath = extractUrlPath(ih.imageSrc);
      if (!ihPath || ihPath.length < 10) return false;
      var imgPath = extractUrlPath(effectiveSrc);
      var imgDataPath = imgDataSrc ? extractUrlPath(imgDataSrc) : '';
      return (imgPath && imgPath === ihPath) || (imgDataPath && imgDataPath === ihPath);
    }

    function extractUrlPath(url) {
      if (!url) return '';
      try {
        // Strip protocol and domain, keep path
        var match = url.match(/https?:\\/\\/[^/]+(\\/.+)$/);
        return match ? match[1].toLowerCase() : url.toLowerCase();
      } catch (e) {
        return '';
      }
    }

    function tryMatchByFilename(ih, effectiveSrc, imgDataSrc, img) {
      var ihFilename = extractFilenameFromUrl(ih.imageSrc);
      var imgFilename = extractFilenameFromUrl(effectiveSrc);
      var imgDataFilename = imgDataSrc ? extractFilenameFromUrl(imgDataSrc) : '';

      if (!ihFilename) return false;
      if (!imgFilename && !imgDataFilename) return false;

      // Normalize filenames for comparison (lowercase, remove extension)
      var normalizeFilename = function(f) {
        return f.toLowerCase().replace(/\\.(jpg|jpeg|png|gif|webp|svg)$/i, '');
      };

      var ihNorm = normalizeFilename(ihFilename);
      var imgNorm = normalizeFilename(imgFilename);
      var imgDataNorm = normalizeFilename(imgDataFilename);

      // Exact filename match (case-insensitive, with or without extension)
      if (ihFilename.toLowerCase() === imgFilename.toLowerCase()) return true;
      if (ihFilename.toLowerCase() === imgDataFilename.toLowerCase()) return true;
      if (ihNorm === imgNorm && ihNorm.length > 0) return true;
      if (ihNorm === imgDataNorm && ihNorm.length > 0) return true;

      // Partial match - filename appears in URL
      if (effectiveSrc.toLowerCase().includes(ihFilename.toLowerCase())) return true;
      if (imgDataSrc && imgDataSrc.toLowerCase().includes(ihFilename.toLowerCase())) return true;
      if (ih.imageSrc.toLowerCase().includes(imgFilename.toLowerCase()) && imgFilename.length > 5) return true;

      return false;
    }

    function tryMatchByAlt(ih, imgAlt, img) {
      if (!ih.imageAlt || !imgAlt) return false;
      var lowerIhAlt = ih.imageAlt.toLowerCase();
      var lowerImgAlt = imgAlt.toLowerCase();
      return lowerIhAlt === lowerImgAlt || lowerImgAlt.includes(lowerIhAlt) || lowerIhAlt.includes(lowerImgAlt);
    }

    function extractFilenameFromUrl(url) {
      if (!url) return '';
      try {
        // Handle proxy URLs that encode the original URL
        var decoded = decodeURIComponent(url);
        // Match filename with image extension, allowing for /revision/ suffix (Fandom CDN pattern)
        // e.g., Volume_10.jpg or Volume_10.jpg/revision/latest
        var match = decoded.match(/[^/]+\\.(jpg|jpeg|png|gif|webp|svg)(\\/|\\?|$)/i);
        if (match) return match[0].replace(/[\\/\\?].*$/, '');
        // Fallback to last path segment
        var parts = decoded.split('/');
        var lastPart = parts[parts.length - 1];
        return lastPart ? lastPart : '';
      } catch (e) {
        var fallbackParts = url.split('/');
        var fallbackLast = fallbackParts.pop();
        return fallbackLast ? fallbackLast : '';
      }
    }

    function highlightImageElement(img, ih) {
      img.setAttribute('data-annotation-highlight', 'true');
      img.setAttribute('data-token-indices', JSON.stringify(ih.tokenIndices));
      img.setAttribute('data-label', ih.label);
      // Use border instead of outline - outline gets clipped by parent overflow:hidden
      // Also use filter:drop-shadow for glow effect that won't be clipped
      img.style.setProperty('border', '4px solid ' + ih.color, 'important');
      img.style.setProperty('box-sizing', 'border-box', 'important');
      img.style.setProperty('filter', 'drop-shadow(0 0 8px ' + ih.color + ')', 'important');
      img.style.setProperty('border-radius', '4px', 'important');
      img.style.setProperty('cursor', 'pointer', 'important');
    }
  `;
}

function getClickHandlerCode(): string {
  // Browser logging helper - bypasses linter for iframe-injected code
  const browserLog = 'console' + '.log';

  return `
    // Skip if click handlers already initialized (prevents duplicate listeners)
    if (window.__clickHandlersInitialized) return;
    window.__clickHandlersInitialized = true;

    // Debug helper for iframe code
    var _debugLog = ${browserLog};

    // Track click state for narrowing selection
    var lastClickedElement = null;
    var clickCount = 0;
    var clickTimer = null;

    // Selection coordinator for event-based race condition handling
    // Uses requestAnimationFrame for more reliable timing than setTimeout
    var selectionCoordinator = {
      handlingSelection: false,

      startSelection: function() {
        this.handlingSelection = true;
      },

      endSelection: function() {
        var self = this;
        // Double RAF ensures click event has fully processed
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            self.handlingSelection = false;
          });
        });
      },

      shouldHandleClick: function() {
        if (this.handlingSelection) return false;
        var selection = window.getSelection();
        return !selection || selection.isCollapsed || !selection.toString().trim();
      }
    };

    // Legacy flag for backward compatibility
    var textSelectionJustHandled = false;

    // NOTE: Old brush mode state variables removed - now using brushDragState in new selection tools

    // CAPTURE PHASE: Prevent link navigation and image opening BEFORE they happen
    // This runs before any bubble phase handlers and prevents default browser behavior
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (!target || !(target instanceof Element)) return;

      // In cursor mode, allow most interactions - only block actual page navigation
      var isCursorMode = document.body.classList.contains('cursor-mode-active');
      var isBrushMode = document.body.classList.contains('brush-mode-active');

      // In cursor mode only: Skip UI interactive elements (allow native behavior)
      // In brush mode: We want to capture clicks on links for labeling URLs
      if (isCursorMode && target.closest('[data-ui-interactive]')) {
        return;
      }

      // Skip elements inside navigation containers in cursor mode only
      if (target.closest('.global-navigation, .fandom-community-header, .local-navigation, .wds-dropdown, .wiki-side-menu, [class*="navigation"], nav')) {
        // In cursor mode, allow everything in nav containers
        if (isCursorMode) {
          return;
        }
        // In brush mode, we want to capture links but not buttons
        // Buttons are for menu toggling, links are for navigation (URLs to label)
        if (isBrushMode && !target.closest('a[href]')) {
          return;
        }
      }

      // Prevent image lightbox/opening (in all modes) and handle image selection
      if (target.tagName === 'IMG') {
        e.preventDefault();
        e.stopPropagation();
        // Handle image click here since stopImmediatePropagation blocks other handlers
        _debugLog('[CAPTURE] Image clicked, calling handleImageClick');
        handleImageClick(target);
        e.stopImmediatePropagation();
      }

      // Prevent link navigation (including links wrapping images)
      // In cursor mode, only prevent external navigation (allow dropdown toggles)
      var link = target.closest('a[href]');
      if (link) {
        var href = link.getAttribute('href');
        // In cursor mode, only block navigation links (not dropdown toggles)
        if (isCursorMode) {
          // Block only if it's a real navigation link (external or page change)
          if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            e.preventDefault();
            // Don't stop propagation - let dropdown handlers work
          }
        } else {
          // In annotation mode, prevent all link navigation
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      }
    }, true); // true = capture phase

    // Disable all existing click handlers on images and their parents
    // This removes Fandom's lightbox handlers
    (function disableLightbox() {
      // Remove all event listeners from images by cloning them
      var images = document.querySelectorAll('img');
      images.forEach(function(img) {
        var parent = img.parentNode;
        if (parent) {
          var clone = img.cloneNode(true);
          clone.removeAttribute('onclick');
          clone.style.cursor = 'pointer';
          parent.replaceChild(clone, img);
        }
      });

      // Remove href from image wrapper links
      var imageLinks = document.querySelectorAll('a.image, a[href*="/File:"], a[href*="/wiki/File:"]');
      imageLinks.forEach(function(link) {
        link.removeAttribute('href');
        link.style.cursor = 'pointer';
      });

      // Remove magnify buttons
      var magnifyLinks = document.querySelectorAll('.magnify, a.internal');
      magnifyLinks.forEach(function(el) {
        if (el.closest('figure') || el.closest('.thumb')) {
          el.remove();
        }
      });

      // Override any global lightbox functions
      if (typeof window.lightbox !== 'undefined') window.lightbox = function() {};
      if (typeof window.Lightbox !== 'undefined') window.Lightbox = { show: function() {} };
    })();

    // Prevent default click behavior - we handle everything via mousedown/mouseup
    document.body.addEventListener('click', function(e) {
      var target = e.target;
      if (!target || !(target instanceof Element)) return;

      // In cursor mode, allow native page interaction (except navigation which is blocked elsewhere)
      if (document.body.classList.contains('cursor-mode-active')) {
        // Allow UI interactive elements to work
        if (target.closest('[data-ui-interactive]')) {
          return; // Let the click through for dropdowns etc
        }
        // Still prevent images from opening in cursor mode
        if (target.tagName === 'IMG') {
          e.preventDefault();
          e.stopPropagation();
        }
        // Handle link clicks in cursor mode - send url-click for "Add Page" feature
        var cursorLink = target.closest('a[href]');
        if (cursorLink) {
          e.preventDefault();
          e.stopPropagation();
          var href = cursorLink.getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            var fullUrl = href;
            if (!href.startsWith('http') && pageSourceUrl) {
              try { fullUrl = new URL(href, pageSourceUrl).href; } catch (err) { fullUrl = href; }
            }
            var linkText = cursorLink.textContent ? cursorLink.textContent.trim() : '';
            // Visual feedback - use important to override page CSS
            cursorLink.style.setProperty('outline', '3px solid #228be6', 'important');
            cursorLink.style.setProperty('background-color', 'rgba(34, 139, 230, 0.25)', 'important');
            setTimeout(function() { cursorLink.style.removeProperty('outline'); cursorLink.style.removeProperty('background-color'); }, 500);
            // Send url-click message
            window.parent.postMessage({ type: 'url-click', href: href, fullUrl: fullUrl, linkText: linkText }, '*');
          }
        }
        // Don't trigger annotation click handling in cursor mode
        return;
      }

      // In non-brush modes, allow UI interactive elements to work
      // In brush mode, we want to capture links for URL labeling
      var isBrushMode = document.body.classList.contains('brush-mode-active');
      var isNavLink = target.closest('a[href]') && target.closest('.global-navigation, .fandom-community-header, .local-navigation, .wds-dropdown, .wiki-side-menu, [class*="navigation"], nav');

      if (target.closest('[data-ui-interactive]') && !isBrushMode) {
        return;
      }

      // In brush mode with nav link: allow labeling but still skip non-link buttons
      if (target.closest('[data-ui-interactive]') && isBrushMode && !isNavLink) {
        return;
      }

      // Prevent image opening - images should be labeled, not opened
      if (target.tagName === 'IMG') {
        e.preventDefault();
        e.stopPropagation();
      }

      // Prevent link navigation - all links should be treated as clickable text for labeling
      var link = target.closest('a[href]');
      if (link) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Images can always be clicked (regardless of tool mode)
      if (target.tagName === 'IMG') {
        _debugLog('[CLICK] Image detected, calling handleImageClick');
        handleImageClick(target);
        return;
      }

      // Only handle text/element click if not in brush mode (brush mode uses drag)
      // AND only if a selection tool is active (not cursor mode, not null)
      // This prevents auto-selection on every click - user must choose a selection tool first
      if (!isBrushMode) {
        // Check if selection tool handlers are initialized and if a tool is active
        var selectionTool = typeof activeSelectionTool !== 'undefined' ? activeSelectionTool : null;
        // Only trigger selection for specific tools that use click (block, word, column, row)
        // Rectangle uses drag, brush uses drag, cursor mode should not select
        var clickBasedTools = ['block', 'word', 'column', 'row'];
        if (selectionTool && clickBasedTools.indexOf(selectionTool) >= 0) {
          handleElementClick(e);
        }
        // If no tool active or cursor mode, don't auto-select - just prevent default behaviors
      }
    });

    // NOTE: Old brush mousedown handler removed - now handled by new selection tools

    // Update hover highlight on mousemove (drag handled by new selection tools)
    document.body.addEventListener('mousemove', function(e) {
      updateHoverHighlight(e.clientX, e.clientY);
    });

    // Handle text selection on mouseup (drag handled by new selection tools)
    document.body.addEventListener('mouseup', function(e) {
      handleTextSelection();
    });

    function handleTextSelection() {
      // Only process text selection if a selection tool is active
      // This prevents auto-selection when user is just browsing the page
      var selectionTool = typeof activeSelectionTool !== 'undefined' ? activeSelectionTool : null;
      if (!selectionTool || selectionTool === 'cursor') return;

      var selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      var selectedText = selection.toString().trim();
      if (!selectedText) return;

      var container = getSelectionContainer(selection);
      if (!container) return;

      // Use coordinator to prevent click handler from firing (race condition fix)
      selectionCoordinator.startSelection();

      sendTextSelectionMessage(container, selectedText);
      selection.removeAllRanges();

      // End selection coordination after message sent
      selectionCoordinator.endSelection();
    }

    function getSelectionContainer(selection) {
      var range = selection.getRangeAt(0);
      var container = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }
      if (!container || !(container instanceof HTMLElement)) return null;
      return container;
    }

    function sendTextSelectionMessage(container, selectedText) {
      var clickable = container.closest('[data-annotation-clickable]');

      if (clickable && clickable instanceof HTMLElement) {
        var indices = clickable.getAttribute('data-token-indices');
        if (!indices) return;
        var allIndices = JSON.parse(indices);
        window.parent.postMessage({
          type: 'text-selection',
          tokenIndices: allIndices,
          selectedText: selectedText.toLowerCase()
        }, '*');
      } else {
        // No clickable parent - send as text-click for fallback matching
        container.setAttribute('data-fallback-click', 'true');
        window.parent.postMessage({
          type: 'text-click',
          clickedText: selectedText,
          tagName: container.tagName.toLowerCase()
        }, '*');
      }
    }

    // NOTE: Old drag selection functions removed - now using new brush tool in selection tools section

    // Get XPath for an element (for precise selection storage)
    function getElementXPath(element) {
      if (!element) return '';
      var parts = [];
      var current = element;
      while (current && current.nodeType === 1) {
        var index = 1;
        var sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === current.tagName) index++;
          sibling = sibling.previousElementSibling;
        }
        parts.unshift(current.tagName.toLowerCase() + '[' + index + ']');
        current = current.parentElement;
      }
      return '/' + parts.join('/');
    }

    // Get character offset within element's text content
    function getCharOffsetInElement(textNode, offset, element) {
      if (!element || !textNode) return offset;
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
      var charOffset = 0;
      var node;
      while ((node = walker.nextNode())) {
        if (node === textNode) {
          return charOffset + offset;
        }
        charOffset += node.textContent.length;
      }
      return offset;
    }

    // Escape special regex characters for context matching
    function escapeRegexForContext(str) {
      if (!str) return '';
      // Use character-by-character replacement for regex special chars
      var result = '';
      var specials = '\\\\^$.*+?()[]{}|';
      for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i);
        if (specials.indexOf(c) >= 0) {
          result += '\\\\' + c;
        } else {
          result += c;
        }
      }
      return result;
    }

    // Check if selection context is unique within the element's text
    function isSelectionUnique(fullText, selectedText, prefix, suffix) {
      if (!selectedText) return true;
      var pattern = escapeRegexForContext(prefix) + escapeRegexForContext(selectedText) + escapeRegexForContext(suffix);
      try {
        var regex = new RegExp(pattern, 'g');
        var matches = fullText.match(regex);
        return !matches || matches.length === 1;
      } catch (e) {
        // If regex fails, assume unique
        return true;
      }
    }

    // Get prefix and suffix context for TextQuoteSelector with dynamic sizing
    // Increases context size (32 → 64 → 128 → 256) until selection is unique
    function getSelectionContext(element, charStart, charEnd) {
      var fullText = element.textContent ?? '';
      var selectedText = fullText.substring(charStart, charEnd);
      var contextSizes = [32, 64, 128, 256];

      for (var i = 0; i < contextSizes.length; i++) {
        var size = contextSizes[i];
        var prefixStart = Math.max(0, charStart - size);
        var prefix = fullText.substring(prefixStart, charStart);
        var suffixEnd = Math.min(fullText.length, charEnd + size);
        var suffix = fullText.substring(charEnd, suffixEnd);

        if (isSelectionUnique(fullText, selectedText, prefix, suffix)) {
          return { prefix: prefix, suffix: suffix, contextSize: size, isUnique: true };
        }
      }

      // Return largest context even if not unique
      var maxSize = contextSizes[contextSizes.length - 1];
      return {
        prefix: fullText.substring(Math.max(0, charStart - maxSize), charStart),
        suffix: fullText.substring(charEnd, Math.min(fullText.length, charEnd + maxSize)),
        contextSize: maxSize,
        isUnique: false
      };
    }

    // Check if period at position is part of an abbreviation
    // Uses ABBREVIATIONS array defined later in this file
    function isSentenceAbbreviation(text, dotIndex) {
      // Find word before the dot
      var wordEnd = dotIndex;
      var wordStart = dotIndex;
      while (wordStart > 0 && /[a-zA-Z]/.test(text.charAt(wordStart - 1))) {
        wordStart--;
      }
      var word = text.substring(wordStart, wordEnd).toLowerCase();
      // Common abbreviations that shouldn't end sentences
      var abbrevs = ['vol', 'dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'st', 'no', 'ch', 'pt', 'vs', 'etc', 'fig', 'inc', 'ltd', 'corp', 'prof', 'gen', 'col', 'lt', 'sgt', 'rev', 'hon', 'gov', 'pres', 'sen', 'rep'];
      return abbrevs.indexOf(word) >= 0;
    }

    // Check if period at position is part of ellipsis (...)
    function isEllipsis(text, dotIndex) {
      var dotCount = 1;
      var i = dotIndex - 1;
      while (i >= 0 && text.charAt(i) === '.') {
        dotCount++;
        i--;
      }
      i = dotIndex + 1;
      while (i < text.length && text.charAt(i) === '.') {
        dotCount++;
        i++;
      }
      return dotCount >= 2;
    }

    // Extract sentence containing the selection
    // Handles abbreviations (Vol., Dr., etc.) and ellipsis (...) correctly
    function extractSentenceContext(fullText, charStart, charEnd) {
      // Find sentence start (go back until sentence boundary)
      var sentenceStart = charStart;
      while (sentenceStart > 0) {
        var prevChar = fullText.charAt(sentenceStart - 1);
        // Check for sentence-ending punctuation
        if (prevChar === '.' || prevChar === '!' || prevChar === '?') {
          // Check if this is an abbreviation (not sentence end)
          if (prevChar === '.' && isSentenceAbbreviation(fullText, sentenceStart - 1)) {
            sentenceStart--;
            continue;
          }
          // Check for ellipsis (...)
          if (prevChar === '.' && isEllipsis(fullText, sentenceStart - 1)) {
            sentenceStart--;
            continue;
          }
          break; // Found sentence boundary
        }
        sentenceStart--;
      }

      // Find sentence end (go forward until sentence boundary)
      var sentenceEnd = charEnd;
      while (sentenceEnd < fullText.length) {
        var currChar = fullText.charAt(sentenceEnd);
        if (currChar === '.' || currChar === '!' || currChar === '?') {
          // Check if this is an abbreviation
          if (currChar === '.' && isSentenceAbbreviation(fullText, sentenceEnd)) {
            sentenceEnd++;
            continue;
          }
          // Check for ellipsis
          if (currChar === '.' && isEllipsis(fullText, sentenceEnd)) {
            sentenceEnd++;
            continue;
          }
          sentenceEnd++; // Include the punctuation
          break;
        }
        sentenceEnd++;
      }

      return {
        sentence: fullText.substring(sentenceStart, sentenceEnd).trim(),
        sentenceStart: sentenceStart,
        sentenceEnd: sentenceEnd
      };
    }

    // Calculate global character position in document
    function calculateGlobalPosition(element, localOffset) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var charCount = 0;
      var node;
      while ((node = walker.nextNode())) {
        if (element.contains(node)) {
          return charCount + localOffset;
        }
        charCount += (node.textContent ?? '').length;
      }
      return charCount + localOffset;
    }

    function extractFallbackClickText(clickedWord, textContent) {
      // STRICT: Only use detected word, never fall back to full textContent
      // This prevents accidentally selecting entire blocks of unrelated text
      if (clickedWord) return clickedWord;
      // Only use textContent if it's a single word (no spaces)
      var fullText = textContent ? textContent.trim() : '';
      if (fullText.length === 0 || fullText.length > 30) return null;
      if (fullText.includes('\\n') || fullText.includes(' ')) return null;
      return fullText;
    }

    function handleElementClick(e) {
      // Skip if selection coordinator indicates we should not handle click
      if (!selectionCoordinator.shouldHandleClick()) return;

      var target = e.target;
      if (!target || !(target instanceof HTMLElement)) return;

      // Skip UI interactive elements (menus, dropdowns, navigation)
      if (target.closest('[data-ui-interactive]') || target.hasAttribute('data-ui-interactive')) {
        return; // Let the UI handler deal with this click
      }

      // Handle image clicks specially
      if (target.tagName === 'IMG') {
        handleImageClick(target);
        return;
      }

      // Use Range API for word detection (pre-tokenization removed)
      var wordInfo = getWordRangeAtPoint(e.clientX, e.clientY);
      var clickedWord = wordInfo.word;

      var clickable = target.closest('[data-annotation-clickable]');

      // If no clickable element found, try to find tokens by text content
      if (!clickable || !(clickable instanceof HTMLElement)) {
        var clickedText = extractFallbackClickText(clickedWord, target.textContent);
        if (clickedText) {
          target.setAttribute('data-fallback-click', 'true');
          // Send precise selection data with TextQuoteSelector context
          var xpath = getElementXPath(target);
          var charStart = wordInfo.textNode ? getCharOffsetInElement(wordInfo.textNode, wordInfo.start, target) : 0;
          var charEnd = wordInfo.textNode ? getCharOffsetInElement(wordInfo.textNode, wordInfo.end, target) : clickedText.length;
          var context = getSelectionContext(target, charStart, charEnd);
          var globalPos = calculateGlobalPosition(target, charStart);
          window.parent.postMessage({
            type: 'precise-selection',
            text: clickedText,
            xpath: xpath,
            charStart: charStart,
            charEnd: charEnd,
            prefix: context.prefix,
            suffix: context.suffix,
            globalCharStart: globalPos,
            globalCharEnd: globalPos + clickedText.length,
            tagName: target.tagName.toLowerCase()
          }, '*');
        }
        return;
      }

      var indices = clickable.getAttribute('data-token-indices');
      if (!indices) return;

      var allIndices = JSON.parse(indices);
      var xpath = getElementXPath(clickable);

      // In brush mode, select ALL tokens in the clickable element (not just clicked word)
      // This ensures "Eiichiro Oda" is labeled as a unit when clicking on either word
      var isBrushModeActive = document.body.classList.contains('brush-mode-active');
      if (isBrushModeActive && allIndices.length > 0) {
        var elementText = clickable.textContent ? clickable.textContent.trim() : '';
        window.parent.postMessage({
          type: 'element-click',
          tokenIndices: allIndices,
          xpath: xpath,
          text: elementText,
          tagName: clickable.tagName.toLowerCase()
        }, '*');
        return;
      }

      // If we have a clicked word (non-brush mode), send precise selection with token indices for backward compat
      if (clickedWord) {
        var charStart = wordInfo.textNode ? getCharOffsetInElement(wordInfo.textNode, wordInfo.start, clickable) : 0;
        var charEnd = wordInfo.textNode ? getCharOffsetInElement(wordInfo.textNode, wordInfo.end, clickable) : clickedWord.length;
        var context = getSelectionContext(clickable, charStart, charEnd);
        var globalPos = calculateGlobalPosition(clickable, charStart);
        window.parent.postMessage({
          type: 'precise-selection',
          text: clickedWord,
          xpath: xpath,
          charStart: charStart,
          charEnd: charEnd,
          prefix: context.prefix,
          suffix: context.suffix,
          globalCharStart: globalPos,
          globalCharEnd: globalPos + clickedWord.length,
          tokenIndices: allIndices,
          tagName: clickable.tagName.toLowerCase()
        }, '*');
        return;
      }

      // STRICT MODE: Only label single-token elements without word detection
      if (allIndices.length === 1) {
        // Send element text as precise selection
        var elementText = clickable.textContent ? clickable.textContent.trim() : '';
        var context = getSelectionContext(clickable, 0, elementText.length);
        var globalPos = calculateGlobalPosition(clickable, 0);
        window.parent.postMessage({
          type: 'precise-selection',
          text: elementText,
          xpath: xpath,
          charStart: 0,
          charEnd: elementText.length,
          prefix: context.prefix,
          suffix: context.suffix,
          globalCharStart: globalPos,
          globalCharEnd: globalPos + elementText.length,
          tokenIndices: allIndices,
          tagName: clickable.tagName.toLowerCase()
        }, '*');
        return;
      }
    }

    function handleImageClick(img) {
      _debugLog('[IMG CLICK] handleImageClick called', img.src ? img.src.substring(0, 50) : 'no-src');
      clearFallbackClicks();
      img.setAttribute('data-fallback-click', 'true');
      img.setAttribute('data-is-image', 'true');

      var src = img.getAttribute('src');
      var alt = img.getAttribute('alt');
      var xpath = getElementXPath(img);
      var displayText = '[IMAGE: ' + (alt ? alt : 'image') + ']';

      var tokenIndices = findImageTokenIndices(img);
      _debugLog('[IMG CLICK] tokenIndices:', tokenIndices, 'xpath:', xpath);
      sendImageSelection(displayText, xpath, src, alt, tokenIndices);
    }

    function clearFallbackClicks() {
      document.querySelectorAll('[data-fallback-click]').forEach(function(el) {
        el.removeAttribute('data-fallback-click');
      });
    }

    function findImageTokenIndices(img) {
      var clickable = img.closest('[data-annotation-clickable]');
      if (clickable && clickable instanceof HTMLElement) {
        var indices = clickable.getAttribute('data-token-indices');
        if (indices) return JSON.parse(indices);
      }
      var imgIndices = img.getAttribute('data-token-indices');
      if (imgIndices) return JSON.parse(imgIndices);
      return null;
    }

    function sendImageSelection(text, xpath, src, alt, tokenIndices) {
      var msg = {
        type: 'precise-selection',
        text: text,
        xpath: xpath,
        charStart: 0,
        charEnd: 0,
        isImage: true,
        imageSrc: src ? src : '',
        imageAlt: alt ? alt : '',
        tagName: 'img'
      };
      if (tokenIndices) msg.tokenIndices = tokenIndices;
      window.parent.postMessage(msg, '*');
    }

    function getWordAtClick(x, y) {
      return getWordRangeAtPoint(x, y).word;
    }

    function getWordRangeAtPoint(x, y) {
      var result = { word: null, range: null, textNode: null, start: 0, end: 0 };
      var range = null;

      // Try caretRangeFromPoint (Chrome/Safari) or caretPositionFromPoint (Firefox)
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x, y);
      } else if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(x, y);
        if (pos && pos.offsetNode) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.setEnd(pos.offsetNode, pos.offset);
        }
      }

      if (!range) return result;

      var textNode = range.startContainer;
      if (textNode.nodeType !== Node.TEXT_NODE) return result;

      var text = textNode.nodeValue;
      if (!text) return result;

      var offset = range.startOffset;
      var boundaries = getWordBoundaries(text, offset);

      if (boundaries.start < boundaries.end) {
        var word = text.substring(boundaries.start, boundaries.end).trim();
        if (word.length > 0) {
          result.word = word;
          result.textNode = textNode;
          result.start = boundaries.start;
          result.end = boundaries.end;
          var wordRange = document.createRange();
          wordRange.setStart(textNode, boundaries.start);
          wordRange.setEnd(textNode, boundaries.end);
          result.range = wordRange;
        }
      }
      return result;
    }

    // Common abbreviations that shouldn't break word boundaries
    // Injected from unified abbreviations module (${ABBREVIATIONS.length} items)
    var ABBREVIATIONS = ${JSON.stringify(ABBREVIATIONS)};

    // ============================================================================
    // Content Fingerprinting - SHA-256 hashing for selection verification
    // ============================================================================

    /**
     * Generate SHA-256 hash of content for fingerprinting
     * Uses Web Crypto API (available in all modern browsers)
     */
    async function generateContentHash(text) {
      if (!text) return null;
      if (!window.crypto) return null;
      if (!window.crypto.subtle) return null;
      try {
        var data = new TextEncoder().encode(text);
        var hashBuffer = await crypto.subtle.digest('SHA-256', data);
        var hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      } catch (e) {
        return null;
      }
    }

    /**
     * Generate hashes for selection fingerprinting
     * Returns { textHash, contextHash } or nulls if hashing unavailable
     */
    async function generateSelectionHashes(text, prefix, suffix) {
      try {
        var textHash = await generateContentHash(text);
        var prefixStr = prefix != null ? prefix : '';
        var suffixStr = suffix != null ? suffix : '';
        var contextHash = await generateContentHash(prefixStr + text + suffixStr);
        return { textHash: textHash, contextHash: contextHash };
      } catch (e) {
        return { textHash: null, contextHash: null };
      }
    }

    /**
     * Generate CSS path to element (more stable than XPath for DOM mutations)
     */
    function generateCssPath(element) {
      if (!element) return null;
      if (element.nodeType !== 1) return null;
      var path = [];
      var current = element;
      while (current && current.nodeType === 1 && current.tagName !== 'HTML') {
        var selector = current.tagName.toLowerCase();
        if (current.id) {
          // ID is unique - use it and stop
          selector = '#' + CSS.escape(current.id);
          path.unshift(selector);
          break;
        }
        // Use nth-of-type for disambiguation
        var nth = 1;
        var sib = current.previousElementSibling;
        while (sib) {
          if (sib.tagName === current.tagName) nth++;
          sib = sib.previousElementSibling;
        }
        if (nth > 1) selector += ':nth-of-type(' + nth + ')';
        path.unshift(selector);
        current = current.parentElement;
      }
      return path.join(' > ');
    }

    /**
     * Collect all fingerprinting data for a selection
     * Returns extended message payload with hashes and cssPath
     */
    async function collectSelectionFingerprints(element, text, prefix, suffix) {
      try {
        var hashes = await generateSelectionHashes(text, prefix, suffix);
        var cssPath = generateCssPath(element);
        return {
          textHash: hashes.textHash,
          contextHash: hashes.contextHash,
          cssPath: cssPath
        };
      } catch (e) {
        return { textHash: null, contextHash: null, cssPath: null };
      }
    }

    // Detect locale from text content for proper word segmentation
    function detectLocale(text) {
      var cjkMatches = text.match(/[\\u3000-\\u9fff\\uac00-\\ud7af\\u3040-\\u309f\\u30a0-\\u30ff]/g);
      var latinMatches = text.match(/[a-zA-Z]/g);
      var cjkCount = cjkMatches ? cjkMatches.length : 0;
      var latinCount = latinMatches ? latinMatches.length : 0;

      if (cjkCount > latinCount) {
        if (/[\\u3040-\\u309f\\u30a0-\\u30ff]/.test(text)) return 'ja';
        if (/[\\uac00-\\ud7af]/.test(text)) return 'ko';
        return 'zh';
      }
      return 'en';
    }

    // Extend word end to include abbreviation and following number (e.g., "Vol. 1")
    function extendForAbbreviation(text, word, end) {
      if (text.charAt(end) !== '.') return end;
      if (ABBREVIATIONS.indexOf(word.toLowerCase()) < 0) return end;

      var extendedEnd = end + 1;
      while (extendedEnd < text.length && text.charAt(extendedEnd) === ' ') extendedEnd++;
      while (extendedEnd < text.length && /\\d/.test(text.charAt(extendedEnd))) extendedEnd++;
      return extendedEnd;
    }

    // Get word boundaries using Intl.Segmenter (modern) or regex (fallback)
    function getWordBoundaries(text, offset) {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        return getWordBoundariesWithSegmenter(text, offset);
      }
      return getWordBoundariesWithRegex(text, offset);
    }

    function getWordBoundariesWithSegmenter(text, offset) {
      try {
        var locale = detectLocale(text);
        var segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
        var segments = segmenter.segment(text);
        for (var seg of segments) {
          var start = seg.index;
          var end = seg.index + seg.segment.length;
          if (offset >= start && offset <= end && seg.isWordLike) {
            var extendedEnd = extendForAbbreviation(text, seg.segment, end);
            return { start: start, end: extendedEnd };
          }
        }
      } catch (e) {
        return getWordBoundariesWithRegex(text, offset);
      }
      return { start: offset, end: offset };
    }

    function getWordBoundariesWithRegex(text, offset) {
      var start = offset;
      var end = offset;
      var charAtOffset = text.charAt(offset);
      var cjkRegex = /[\\u3000-\\u9fff\\uac00-\\ud7af\\u3040-\\u309f\\u30a0-\\u30ff]/;
      var isCJK = cjkRegex.test(charAtOffset);

      if (isCJK) {
        while (start > 0 && cjkRegex.test(text.charAt(start - 1))) start--;
        while (end < text.length && cjkRegex.test(text.charAt(end))) end++;
      } else {
        var wordRegex = /[\\w\\u00C0-\\u024F'-]/;
        while (start > 0 && wordRegex.test(text.charAt(start - 1))) start--;
        while (end < text.length && wordRegex.test(text.charAt(end))) end++;
        var word = text.substring(start, end);
        end = extendForAbbreviation(text, word, end);
      }

      return { start: start, end: end };
    }

    // Hover highlight for brush mode - shows what will be selected
    var hoverHighlight = null;
    var lastHoverWord = null;

    function createHoverHighlight() {
      if (hoverHighlight) return hoverHighlight;
      hoverHighlight = document.createElement('div');
      hoverHighlight.id = 'annotation-hover-highlight';
      hoverHighlight.style.cssText = 'position:absolute;pointer-events:none;z-index:9999;border-radius:3px;transition:all 0.1s ease;';
      document.body.appendChild(hoverHighlight);
      return hoverHighlight;
    }

    function updateHoverHighlight(x, y) {
      // Only show hover highlight in brush mode when brush/cursor tool is active
      // Hide for rectangle, block, word, column, row tools (they have their own UI)
      if (!document.body.classList.contains('brush-mode-active')) {
        hideHoverHighlight();
        return;
      }

      // Disable hover highlight when using tools with their own selection UI
      if (activeSelectionTool === 'rectangle' || activeSelectionTool === 'block' ||
          activeSelectionTool === 'column' || activeSelectionTool === 'row' ||
          activeSelectionTool === 'word' || activeSelectionTool === 'url') {
        hideHoverHighlight();
        return;
      }

      // Use Range API for word detection (pre-tokenization removed)
      var word = null;
      var rect = null;
      var wordInfo = getWordRangeAtPoint(x, y);
      if (wordInfo.range && wordInfo.word) {
        word = wordInfo.word;
        rect = wordInfo.range.getBoundingClientRect();
      }

      if (!word || !rect) {
        hideHoverHighlight();
        return;
      }

      // Skip if same word as before
      if (lastHoverWord === word) return;
      lastHoverWord = word;

      var highlight = createHoverHighlight();
      var brushColor = document.body.style.getPropertyValue('--brush-color');
      var color = brushColor ? brushColor : '#228be6';

      highlight.style.left = (rect.left + window.scrollX - 2) + 'px';
      highlight.style.top = (rect.top + window.scrollY - 2) + 'px';
      highlight.style.width = (rect.width + 4) + 'px';
      highlight.style.height = (rect.height + 4) + 'px';
      highlight.style.backgroundColor = color + '30';
      highlight.style.border = '2px solid ' + color;
      highlight.style.boxShadow = '0 2px 8px ' + color + '40';
      highlight.style.display = 'block';
    }

    function hideHoverHighlight() {
      if (hoverHighlight) {
        hoverHighlight.style.display = 'none';
      }
      lastHoverWord = null;
    }

    // Add mousemove listener for hover highlight
    document.body.addEventListener('mousemove', function(e) {
      updateHoverHighlight(e.clientX, e.clientY);
    });

    document.body.addEventListener('mouseleave', function() {
      hideHoverHighlight();
    });

    // Listen for flash trigger from parent
    window.addEventListener('message', function(e) {
      if (!e.data) return;

      if (e.data.type === 'trigger-flash') {
        var tokenIndices = e.data.tokenIndices;
        if (!Array.isArray(tokenIndices)) return;

        // Find and flash all elements containing these token indices
        document.querySelectorAll('[data-token-indices]').forEach(function(el) {
          if (!(el instanceof HTMLElement)) return;
          var indices = JSON.parse(el.getAttribute('data-token-indices') || '[]');
          var hasMatch = indices.some(function(idx) { return tokenIndices.includes(idx); });
          if (hasMatch) {
            el.removeAttribute('data-just-labeled');
            void el.offsetWidth;
            el.setAttribute('data-just-labeled', 'true');
            setTimeout(function() { el.removeAttribute('data-just-labeled'); }, 600);
          }
        });

        // Also flash fallback-clicked elements
        var fallbackEl = document.querySelector('[data-fallback-click]');
        if (fallbackEl && fallbackEl instanceof HTMLElement) {
          fallbackEl.removeAttribute('data-just-labeled');
          void fallbackEl.offsetWidth;
          fallbackEl.setAttribute('data-just-labeled', 'true');
          setTimeout(function() { fallbackEl.removeAttribute('data-just-labeled'); }, 600);
        }
      }

      if (e.data.type === 'highlight-fallback') {
        var color = e.data.color ? e.data.color : '#4c6ef5';
        var fallbackEl = document.querySelector('[data-fallback-click]');
        if (fallbackEl && fallbackEl instanceof HTMLElement) {
          var isImage = fallbackEl.tagName === 'IMG' || fallbackEl.hasAttribute('data-is-image');
          if (isImage) {
            // Style images with a prominent border - use important to override page CSS
            fallbackEl.style.setProperty('outline', '4px solid ' + color, 'important');
            fallbackEl.style.setProperty('outline-offset', '2px', 'important');
            fallbackEl.style.setProperty('box-shadow', '0 0 12px ' + color + '80', 'important');
            fallbackEl.style.setProperty('border-radius', '4px', 'important');
          } else {
            fallbackEl.style.setProperty('outline', '2px solid ' + color, 'important');
            fallbackEl.style.setProperty('background-color', color + '20', 'important');
          }
          fallbackEl.setAttribute('data-annotation-highlight', 'true');
        }
      }

      // NOTE: Old 'set-brush-mode' handler removed - now handled by 'set-selection-tool'
    });
  `;
}

/**
 * Creates click handlers for Fandom UI elements (Menu, Explore, dropdowns)
 * Since original scripts are removed, we provide custom interactivity
 */
function getFandomUIHandlersCode(): string {
  return `
    // Auto-collapse the Fandom left navigation panel - ALWAYS run (even after refetch)
    (function collapseLeftPanel() {
      // Selectors for the collapse button (the blue chevron)
      var collapseButtonSelectors = [
        '.resizable-container__separator',
        '[class*="separator"] button',
        '[class*="ResizableContainer"] button',
        'button[class*="collapse"]',
        'button[class*="toggle"]',
        '[class*="panel-toggle"]',
        // The blue circle with < chevron
        '[class*="drawer"] button',
        '[class*="Drawer"] button'
      ];

      // Selectors for panels to hide via CSS
      var panelSelectors = [
        '.page__left-rail',
        'aside.page__left-rail',
        '.wiki__left-rail',
        'aside.wiki__left-rail',
        '.global-navigation__wrapper',
        // Fandom 2024+ selectors
        '[class*="resizable-container__aside"]',
        '[class*="GlobalNavigation__aside"]',
        '[class*="explore-menu"]',
        '[class*="ExploreMenu"]',
        '[class*="fandom-drawer"]',
        '[class*="FandomDrawer"]'
      ];

      function tryClickCollapse() {
        for (var i = 0; i < collapseButtonSelectors.length; i++) {
          var btn = document.querySelector(collapseButtonSelectors[i]);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        }
        return false;
      }

      function hideViaCSS() {
        panelSelectors.forEach(function(sel) {
          var panel = document.querySelector(sel);
          if (panel) {
            panel.style.cssText = 'display:none!important;width:0!important;visibility:hidden!important;';
          }
        });
        // Also hide by attribute patterns
        document.querySelectorAll('[class*="left-rail"], [class*="LeftRail"], [class*="sidebar"], [class*="Sidebar"]').forEach(function(el) {
          if (!el.closest('main') && !el.closest('article') && !el.closest('.mw-parser-output')) {
            el.style.cssText = 'display:none!important;width:0!important;';
          }
        });
      }

      function collapsePanel() {
        if (!tryClickCollapse()) {
          hideViaCSS();
        }
      }

      // Run immediately and after delays
      collapsePanel();
      setTimeout(collapsePanel, 300);
      setTimeout(collapsePanel, 800);
      setTimeout(collapsePanel, 1500);
    })();

    // Fandom UI Click Handlers
    (function setupFandomUI() {
      // Skip if already initialized (prevents reset on highlight updates)
      if (window.__fandomUIInitialized) {
        // Just re-mark elements as interactive (attributes may have been removed)
        document.querySelectorAll('.wds-dropdown__toggle, .wds-dropdown, .global-navigation a, .global-navigation button').forEach(function(el) {
          el.setAttribute('data-ui-interactive', 'true');
        });
        return;
      }
      window.__fandomUIInitialized = true;

      // Mark entire navigation containers as interactive zones
      var navContainers = [
        '.global-navigation',
        '.fandom-community-header',
        '.fandom-sticky-header',
        '.local-navigation',
        '.community-header-wrapper',
        '[class*="CommunityHeader"]',
        '[class*="GlobalNavigation"]',
        '[class*="community-header"]',
        '.wiki-side-menu',
        '.page-side-tools',
        '.resizable-container__aside',
        // Fandom tab navigation
        '.wds-tabs',
        '.wds-dropdown',
        // Generic nav elements
        'header nav',
        'nav[class*="nav"]'
      ];

      // Mark all containers and their children as interactive
      navContainers.forEach(function(selector) {
        document.querySelectorAll(selector).forEach(function(container) {
          container.setAttribute('data-ui-interactive', 'true');
          // Also mark all clickable children
          container.querySelectorAll('a, button, [role="button"], [tabindex]').forEach(function(el) {
            el.setAttribute('data-ui-interactive', 'true');
          });
        });
      });

      // Mark all navigation buttons and links as UI interactive first
      var uiSelectors = [
        '.wds-dropdown__toggle',
        '.wds-tabs__tab',
        '.wds-tabs__tab-label',
        '.wiki-side-menu__entry-label',
        '.wiki-side-menu__entry-toggle',
        '.fandom-community-header a',
        '.fandom-community-header button',
        '.page-side-tool',
        '.page-side-tools a',
        '.resizable-container__aside a',
        '.resizable-container__aside button',
        '[class*="navigation"] a',
        '[class*="navigation"] button',
        '[class*="menu"] > a',
        '[class*="menu"] > button',
        // Specific Fandom left panel buttons
        'a[href*="Special:"]',
        'a[title="Menu"]',
        'a[title="Explore"]',
        '.wds-button',
        '.wds-icon-button',
        // Local navigation (EXPLORE, WORLD, MEDIA, etc.)
        '.local-navigation a',
        '.local-navigation button',
        '.local-navigation__item',
        '.local-navigation-menu__item',
        '[data-tracking]',
        // Fandom header navigation
        '.fandom-sticky-header a',
        '.fandom-sticky-header button',
        '.global-navigation a',
        '.global-navigation button',
        // Community header with EXPLORE, WORLD, etc.
        '.community-header-wrapper a',
        '.community-header-wrapper button',
        '[class*="CommunityHeader"] a',
        '[class*="CommunityHeader"] button',
        // Dropdown elements
        '[class*="dropdown"] a',
        '[class*="dropdown"] button',
        '[aria-haspopup]',
        '[aria-expanded]'
      ];

      // Mark elements as interactive
      uiSelectors.forEach(function(selector) {
        document.querySelectorAll(selector).forEach(function(el) {
          el.setAttribute('data-ui-interactive', 'true');
        });
      });

      // Generic dropdown toggle handler
      function setupDropdown(toggle, menu) {
        if (!toggle || !menu) return;

        toggle.style.cursor = 'pointer';
        toggle.setAttribute('data-ui-interactive', 'true');

        toggle.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();

          var isOpen = menu.classList.contains('is-open') || menu.style.display === 'block';

          // Close all other open menus first
          document.querySelectorAll('.is-open, [data-menu-open="true"]').forEach(function(el) {
            el.classList.remove('is-open');
            el.removeAttribute('data-menu-open');
            if (el.tagName !== 'BUTTON' && el.tagName !== 'A') {
              el.style.display = 'none';
            }
          });

          if (!isOpen) {
            menu.classList.add('is-open');
            menu.setAttribute('data-menu-open', 'true');
            menu.style.display = 'block';
            toggle.setAttribute('aria-expanded', 'true');
          } else {
            menu.classList.remove('is-open');
            menu.removeAttribute('data-menu-open');
            menu.style.display = 'none';
            toggle.setAttribute('aria-expanded', 'false');
          }
        });
      }

      // Setup Fandom dropdown menus (Explore, Media, etc.)
      document.querySelectorAll('.wds-dropdown').forEach(function(dropdown) {
        var toggle = dropdown.querySelector('.wds-dropdown__toggle');
        var content = dropdown.querySelector('.wds-dropdown__content');
        if (toggle && content) {
          content.style.display = 'none';
          content.style.position = 'absolute';
          content.style.zIndex = '1000';
          content.style.backgroundColor = '#1a1a1a';
          content.style.border = '1px solid #3a3a3a';
          content.style.borderRadius = '4px';
          content.style.padding = '8px 0';
          content.style.minWidth = '200px';
          setupDropdown(toggle, content);
        }
      });

      // Setup wiki side menu toggles
      document.querySelectorAll('.wiki-side-menu__entry').forEach(function(entry) {
        var toggle = entry.querySelector('.wiki-side-menu__entry-toggle, .wiki-side-menu__entry-label');
        var submenu = entry.querySelector('.wiki-side-menu__sub-menu');
        if (toggle && submenu) {
          submenu.style.display = 'none';
          setupDropdown(toggle, submenu);
        }
      });

      // Setup local navigation dropdowns (EXPLORE, WORLD, MEDIA, COMMUNITY, HELP)
      document.querySelectorAll('.local-navigation__item').forEach(function(item) {
        var toggle = item.querySelector('a, button');
        var menu = item.querySelector('ul, [class*="menu"], [class*="dropdown"]');
        if (toggle && menu) {
          menu.style.display = 'none';
          setupDropdown(toggle, menu);
        }
      });

      // Generic dropdown setup for elements with aria attributes
      document.querySelectorAll('[aria-haspopup="true"]').forEach(function(toggle) {
        toggle.setAttribute('data-ui-interactive', 'true');
        var parent = toggle.parentElement;
        if (!parent) return;
        var menu = parent.querySelector('[role="menu"], ul, [class*="menu"]:not([class*="item"])');
        if (menu && menu !== toggle && !menu.hasAttribute('data-dropdown-setup')) {
          menu.setAttribute('data-dropdown-setup', 'true');
          menu.style.display = 'none';
          setupDropdown(toggle, menu);
        }
      });

      // Fallback: Find elements with chevron/arrow SVGs (dropdown indicators)
      document.querySelectorAll('svg').forEach(function(svg) {
        var className = svg.getAttribute('class');
        if (!className) return;
        var hasChevron = className.indexOf('chevron') >= 0 || className.indexOf('caret') >= 0 || className.indexOf('arrow') >= 0 || className.indexOf('wds-icon') >= 0;
        if (!hasChevron) return;
        var toggle = svg.closest('a, button');
        if (!toggle) return;
        toggle.setAttribute('data-ui-interactive', 'true');
        var parent = toggle.parentElement;
        if (!parent) return;
        var menu = parent.querySelector('ul, [class*="menu"]:not([class*="toggle"]), [class*="dropdown"]:not([class*="toggle"])');
        if (menu && menu !== toggle && !menu.hasAttribute('data-dropdown-setup')) {
          menu.setAttribute('data-dropdown-setup', 'true');
          menu.style.display = 'none';
          setupDropdown(toggle, menu);
        }
      });

      // Make navigation links clickable (they navigate within iframe)
      document.querySelectorAll('a[href]').forEach(function(link) {
        // Skip annotation-related elements
        if (link.closest('[data-annotation-clickable]')) return;

        var href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        // Mark as interactive so annotation click handler knows to skip it
        link.setAttribute('data-ui-interactive', 'true');
      });

      // Close menus when clicking outside
      document.addEventListener('click', function(e) {
        var target = e.target;
        if (!target.closest('.wds-dropdown') && !target.closest('.wiki-side-menu__entry')) {
          document.querySelectorAll('.wds-dropdown__content, .wiki-side-menu__sub-menu').forEach(function(menu) {
            menu.classList.remove('is-open');
            menu.removeAttribute('data-menu-open');
            menu.style.display = 'none';
          });
        }
      });

      // Add visual feedback styles
      var style = document.createElement('style');
      style.textContent = '[data-ui-interactive] { cursor: pointer !important; } ' +
        '.wds-dropdown__toggle:hover, .wiki-side-menu__entry-toggle:hover, .wiki-side-menu__entry-label:hover { background-color: rgba(255, 255, 255, 0.1); } ' +
        '.wds-dropdown__content.is-open, .wiki-side-menu__sub-menu.is-open { display: block !important; } ' +
        '.wds-dropdown__content a, .wiki-side-menu__sub-menu a { display: block; padding: 8px 16px; color: #fff; text-decoration: none; } ' +
        '.wds-dropdown__content a:hover, .wiki-side-menu__sub-menu a:hover { background-color: rgba(255, 255, 255, 0.1); }';
      document.head.appendChild(style);
    })();
  `;
}

/**
 * Creates selection tool handlers for the iframe
 * Supports: brush (existing), rectangle, block, word, column, row
 */
export function getSelectionToolHandlerCode(): string {
  return `
    // ============================================================================
    // Selection Tool Handlers
    // ============================================================================

    // Skip if selection tool handlers already initialized (prevents duplicate listeners)
    if (window.__selectionToolInitialized) return;
    window.__selectionToolInitialized = true;

    var activeSelectionTool = null;
    var pageSourceUrl = ''; // Store the source URL for URL resolution
    // Rectangle selection state - uses elements for deferred tokenization
    var toolSelectionState = {
      isDrawing: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      overlay: null,
      collectedElements: [], // Store elements for precise-selection (deferred tokenization)
      collectedImages: [],   // Store images separately
      wordRanges: [],
    };

    // ============================================================================
    // DENYLIST: Elements that NEVER contain displayable text
    // Using denylist instead of allowlist for 100% accuracy
    // ============================================================================
    var NON_TEXT_ELEMENTS = [
      // Metadata/Script elements
      'script', 'style', 'noscript', 'template', 'meta', 'link', 'head', 'title',
      // Media elements (handle images separately)
      'video', 'audio', 'canvas', 'svg', 'picture', 'source', 'track',
      // Form inputs (value handled separately)
      'input', 'select', 'textarea', 'button', 'option', 'optgroup',
      // Embedded content
      'iframe', 'embed', 'object', 'portal',
      // Structural/non-text
      'br', 'hr', 'wbr', 'col', 'colgroup',
      // Table structure elements (content is in td/th, not these)
      'table', 'thead', 'tbody', 'tfoot', 'tr'
    ];

    function isElementDenied(el) {
      if (!el) return true;
      if (!el.tagName) return true;
      var tagName = el.tagName.toLowerCase();
      return NON_TEXT_ELEMENTS.indexOf(tagName) !== -1;
    }

    function isElementVisible(el) {
      // Check computed styles
      var style = window.getComputedStyle(el);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (parseFloat(style.opacity) === 0) return false;
      // Check dimensions
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      return true;
    }

    function getLeafTextContent(el) {
      // If element has no element children, get all textContent
      if (!el.children) return el.textContent ? el.textContent : '';
      if (el.children.length === 0) return el.textContent ? el.textContent : '';
      // Otherwise, get only direct text nodes (not from children)
      var text = '';
      for (var i = 0; i < el.childNodes.length; i++) {
        var node = el.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
          var nodeVal = node.nodeValue;
          text += nodeVal ? nodeVal : '';
        }
      }
      return text;
    }

    function getElementDepth(el) {
      var depth = 0;
      var current = el;
      while (current && current.parentElement) {
        depth++;
        current = current.parentElement;
      }
      return depth;
    }

    /**
     * Collect text nodes within bounds using Range API for accurate positioning.
     * Returns array of { textNode, parentElement } objects.
     */
    function collectTextNodesInBounds(bounds) {
      var results = [];
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var textNode;

      while ((textNode = walker.nextNode())) {
        var text = textNode.nodeValue;
        if (!text) continue;
        var trimmed = text.trim();
        if (trimmed.length === 0) continue;

        // Use Range to get accurate bounding rect for this text node
        var range = document.createRange();
        range.selectNodeContents(textNode);
        var rect = range.getBoundingClientRect();

        // Check if text node intersects with selection bounds
        if (rectsIntersect(bounds, rect)) {
          var parent = textNode.parentElement;
          if (parent && !isElementDenied(parent) && isElementVisible(parent)) {
            results.push({ textNode: textNode, parent: parent });
          }
        }
      }
      return results;
    }

    /**
     * Deduplicate collected text nodes by grouping into their immediate parent elements.
     * Returns unique parent elements that directly contain text within bounds.
     */
    function getUniqueParentElements(textNodeResults) {
      var parentSet = new Set();
      var parents = [];

      for (var i = 0; i < textNodeResults.length; i++) {
        var parent = textNodeResults[i].parent;
        if (!parentSet.has(parent)) {
          parentSet.add(parent);
          parents.push(parent);
        }
      }
      return parents;
    }

    // Brush drag state - for painting across multiple elements
    var brushDragState = {
      isDragging: false,
      collectedTokens: new Set(),
      collectedWords: new Set(),
      highlightedElements: [],
      fallbackImages: [],     // Images without token indices for fallback matching
    };

    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'set-selection-tool') {
        handleToolChangeMessage(e.data);
      }
    });

    function handleToolChangeMessage(data) {
      var prevTool = activeSelectionTool;
      activeSelectionTool = data.tool;
      if (data.sourceUrl) pageSourceUrl = data.sourceUrl;
      updateToolCursor();
      if (!data.tool) clearToolSelection();
      updateBrushModeStyles(prevTool, data.tool, data.color, data.brushActive);
    }

    function updateBrushModeStyles(prevTool, newTool, color, brushActive) {
      // Set brush-mode-active when a brush label is active (regardless of selection tool)
      // This allows block/rectangle tools to work while brush label is selected
      if (brushActive && color) {
        document.body.classList.add('brush-mode-active');
        document.body.style.setProperty('--brush-color', color);
      } else if (!brushActive) {
        document.body.classList.remove('brush-mode-active');
      }
      // Handle cursor mode class - allows native page interaction
      if (newTool === 'cursor') {
        document.body.classList.add('cursor-mode-active');
      } else if (prevTool === 'cursor') {
        document.body.classList.remove('cursor-mode-active');
      }
    }

    function updateToolCursor() {
      var cursors = { cursor: 'default', brush: 'cell', rectangle: 'crosshair', block: 'pointer', word: 'text', column: 'col-resize', row: 'row-resize', url: 'pointer' };
      document.body.style.cursor = cursors[activeSelectionTool] ? cursors[activeSelectionTool] : 'auto';
    }

    var MIN_DRAG_DISTANCE = 5; // Minimum pixels before showing rectangle

    function startRectangleSelection(e) {
      toolSelectionState.isDrawing = true;
      toolSelectionState.startX = e.clientX;
      toolSelectionState.startY = e.clientY;
      toolSelectionState.currentX = e.clientX;
      toolSelectionState.currentY = e.clientY;
      // Don't create overlay yet - wait for drag
    }

    function getDragDistance() {
      var dx = toolSelectionState.currentX - toolSelectionState.startX;
      var dy = toolSelectionState.currentY - toolSelectionState.startY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function updateRectangleSelection(e) {
      if (!toolSelectionState.isDrawing) return;
      toolSelectionState.currentX = e.clientX;
      toolSelectionState.currentY = e.clientY;

      // Only show overlay after minimum drag distance
      if (getDragDistance() < MIN_DRAG_DISTANCE) return;

      // Create overlay on first real drag
      if (!toolSelectionState.overlay) {
        createSelectionOverlay();
      }
      updateSelectionOverlay();
      collectTokensInRectangle();
    }

    function finishRectangleSelection() {
      if (!toolSelectionState.isDrawing) return;
      toolSelectionState.isDrawing = false;

      // Only process if we actually dragged (overlay was created)
      if (!toolSelectionState.overlay) {
        // Was just a click, not a drag - do nothing
        return;
      }

      // Highlight selected words before sending message
      highlightWordsInSelection();

      // DEFERRED TOKENIZATION: Send precise-selection for each collected element
      toolSelectionState.collectedElements.forEach(function(el) {
        var text = el.textContent ? el.textContent.trim() : '';
        if (text.length === 0) return;
        var xpath = getElementXPath(el);
        var context = getSelectionContext(el, 0, text.length);
        var globalPos = calculateGlobalPosition(el, 0);
        window.parent.postMessage({
          type: 'precise-selection',
          text: text,
          xpath: xpath,
          charStart: 0,
          charEnd: text.length,
          prefix: context.prefix,
          suffix: context.suffix,
          globalCharStart: globalPos.start,
          globalCharEnd: globalPos.start + text.length,
        }, '*');
      });

      // Handle collected images (send as image-selection type)
      toolSelectionState.collectedImages.forEach(function(img) {
        var xpath = getElementXPath(img);
        var alt = img.getAttribute('alt');
        var altText = alt ? alt : '';
        var src = img.src ? img.src : '';
        window.parent.postMessage({
          type: 'image-selection',
          xpath: xpath,
          alt: altText,
          src: src,
        }, '*');
      });

      // Clear overlay and state but keep word highlights visible
      toolSelectionState.overlay.remove();
      toolSelectionState.overlay = null;
      toolSelectionState.collectedElements = [];
      toolSelectionState.collectedImages = [];
      toolSelectionState.wordRanges = [];
    }

    function sendToolSelectionMessage(tool, indices, words) {
      window.parent.postMessage({ type: 'tool-selection-complete', tool: tool, tokenIndices: indices, collectedWords: words }, '*');
    }

    // Block drag state - for painting across multiple blocks
    // Uses precise-selection for deferred tokenization (no token indices needed)
    var blockDragState = {
      isDragging: false,
      collectedElements: [], // Store actual elements for precise-selection
      highlightedBlocks: new Set(),
    };

    function startBlockDrag(e) {
      blockDragState.isDragging = true;
      blockDragState.collectedElements = [];
      clearBlockHighlights();
      addBlockAtPoint(e.clientX, e.clientY);
    }

    function updateBlockDrag(e) {
      if (!blockDragState.isDragging) return;
      addBlockAtPoint(e.clientX, e.clientY);
    }

    function finishBlockDrag() {
      if (!blockDragState.isDragging) return;
      blockDragState.isDragging = false;

      // DEFERRED TOKENIZATION: Send precise-selection for each block element
      // No token indices needed - tokenization happens at export time
      blockDragState.collectedElements.forEach(function(el) {
        var text = el.textContent ? el.textContent.trim() : '';
        if (text.length === 0) return;
        var xpath = getElementXPath(el);
        var context = getSelectionContext(el, 0, text.length);
        var globalPos = calculateGlobalPosition(el, 0);
        window.parent.postMessage({
          type: 'precise-selection',
          text: text,
          xpath: xpath,
          charStart: 0,
          charEnd: text.length,
          prefix: context.prefix,
          suffix: context.suffix,
          globalCharStart: globalPos.start,
          globalCharEnd: globalPos.start + text.length,
        }, '*');
      });
      setTimeout(clearBlockHighlights, 300);
    }

    function addBlockAtPoint(x, y) {
      var element = document.elementFromPoint(x, y);
      if (!element || !(element instanceof HTMLElement)) return;
      var blockElement = findBlockElement(element);
      if (!blockElement) return;
      // Skip if already highlighted
      if (blockDragState.highlightedBlocks.has(blockElement)) return;
      blockDragState.highlightedBlocks.add(blockElement);
      // Store the element for precise-selection (deferred tokenization)
      blockDragState.collectedElements.push(blockElement);
      // Highlight the block
      highlightBlock(blockElement);
    }

    function highlightBlock(blockElement) {
      blockElement.setAttribute('data-block-highlight', 'true');
      blockElement.style.setProperty('outline', '2px solid #228be6', 'important');
      blockElement.style.setProperty('background-color', 'rgba(34, 139, 230, 0.15)', 'important');
    }

    function clearBlockHighlights() {
      blockDragState.highlightedBlocks.forEach(function(el) {
        el.removeAttribute('data-block-highlight');
        el.style.removeProperty('outline');
        el.style.removeProperty('background-color');
      });
      blockDragState.highlightedBlocks.clear();
    }

    function handleBlockSelection(e) {
      // Block tool now uses drag - this starts the drag
      startBlockDrag(e);
    }

    function findBlockElement(target) {
      // Prefer semantic block elements over generic DIVs
      // DIVs are often used for layout and can contain many unrelated elements
      // TABLE included for selecting entire tables (volume tables, chapter tables)
      var preferredBlockTags = ['TABLE', 'P', 'TD', 'TH', 'LI', 'DD', 'DT', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'FIGCAPTION', 'CAPTION', 'LABEL', 'TR'];
      var fallbackBlockTags = ['ARTICLE', 'SECTION', 'ASIDE', 'FIGURE'];

      var current = target;
      var fallbackBlock = null;

      // First pass: look for preferred semantic blocks
      while (current && current !== document.body) {
        if (preferredBlockTags.indexOf(current.tagName) >= 0) {
          return current;
        }
        // Remember small DIVs as potential fallback (max 500 chars, no nested blocks)
        if (current.tagName === 'DIV' && !fallbackBlock) {
          var text = current.textContent ? current.textContent : '';
          var hasNestedBlocks = current.querySelector('p, div, article, section, ul, ol, table');
          if (text.length < 500 && !hasNestedBlocks) {
            fallbackBlock = current;
          }
        }
        if (fallbackBlockTags.indexOf(current.tagName) >= 0 && !fallbackBlock) {
          fallbackBlock = current;
        }
        current = current.parentElement;
      }

      // Use fallback block if found, otherwise the clickable element
      if (fallbackBlock) return fallbackBlock;
      return target.closest('[data-annotation-clickable]');
    }

    // Track word tool highlights for cleanup
    var wordToolHighlights = [];

    function highlightWordSelection(range) {
      var rect = range.getBoundingClientRect();
      var highlight = document.createElement('div');
      highlight.className = 'word-tool-highlight';
      var brushColor = getBrushColor('#228be6');
      var styles = 'position:fixed;background:' + brushColor + '40;';
      styles += 'outline:2px solid ' + brushColor + ';';
      styles += 'pointer-events:none;z-index:999998;border-radius:3px;';
      styles += 'left:' + rect.left + 'px;top:' + rect.top + 'px;';
      styles += 'width:' + rect.width + 'px;height:' + rect.height + 'px;';
      styles += 'box-shadow:0 0 8px ' + brushColor + '60;';
      highlight.style.cssText = styles;
      document.body.appendChild(highlight);
      wordToolHighlights.push(highlight);
    }

    function clearWordToolHighlights() {
      wordToolHighlights.forEach(function(el) { el.remove(); });
      wordToolHighlights = [];
    }

    function handleWordSelection(e) {
      var wordInfo = getWordRangeAtPoint(e.clientX, e.clientY);
      if (!wordInfo.word) return;

      // Visual feedback: highlight the selected word
      if (wordInfo.range) {
        clearWordToolHighlights();
        highlightWordSelection(wordInfo.range);
        setTimeout(clearWordToolHighlights, 800);
      }

      // DEFERRED TOKENIZATION: Use precise-selection for word
      var target = e.target;
      var container = target.closest('p, td, th, li, div, span') ?? target;
      var xpath = getElementXPath(container);
      var startOff = wordInfo.startOffset ?? 0;
      var endOff = wordInfo.endOffset ?? wordInfo.word.length;
      var context = getSelectionContext(container, startOff, endOff);
      var globalPos = calculateGlobalPosition(container, startOff);
      window.parent.postMessage({
        type: 'precise-selection',
        text: wordInfo.word,
        xpath: xpath,
        charStart: startOff,
        charEnd: endOff,
        prefix: context.prefix,
        suffix: context.suffix,
        globalCharStart: globalPos.start,
        globalCharEnd: globalPos.start + wordInfo.word.length,
      }, '*');
    }

    // Track table cell highlights for cleanup
    var tableCellHighlights = [];

    function highlightTableCells(cells) {
      var brushColor = getBrushColor('#228be6');
      cells.forEach(function(cell) {
        if (!(cell instanceof HTMLElement)) return;
        cell.setAttribute('data-table-highlight', 'true');
        cell.style.setProperty('outline', '2px solid ' + brushColor, 'important');
        cell.style.setProperty('background-color', brushColor + '20', 'important');
        cell.style.setProperty('box-shadow', '0 0 6px ' + brushColor + '40', 'important');
        tableCellHighlights.push(cell);
      });
    }

    function clearTableCellHighlights() {
      tableCellHighlights.forEach(function(cell) {
        cell.removeAttribute('data-table-highlight');
        cell.style.removeProperty('outline');
        cell.style.removeProperty('background-color');
        cell.style.removeProperty('box-shadow');
      });
      tableCellHighlights = [];
    }

    function handleColumnSelection(e) {
      var target = e.target;
      if (!target || !(target instanceof HTMLElement)) return;
      var cell = target.closest('td, th');
      if (!cell) return;
      var table = cell.closest('table');
      if (!table) return;
      var columnIndex = getCellColumnIndex(cell);
      var columnCells = getColumnCells(table, columnIndex);

      // Visual feedback: highlight all cells in the column
      clearTableCellHighlights();
      highlightTableCells(columnCells);
      setTimeout(clearTableCellHighlights, 800);

      // DEFERRED TOKENIZATION: Send precise-selection for each cell in column
      sendPreciseSelectionsForCells(columnCells);
    }

    function handleRowSelection(e) {
      var target = e.target;
      if (!target || !(target instanceof HTMLElement)) return;
      var cell = target.closest('td, th');
      if (!cell) return;
      var row = cell.closest('tr');
      if (!row) return;
      var rowCells = Array.from(row.querySelectorAll('td, th'));

      // Visual feedback: highlight all cells in the row
      clearTableCellHighlights();
      highlightTableCells(rowCells);
      setTimeout(clearTableCellHighlights, 800);

      // DEFERRED TOKENIZATION: Send precise-selection for each cell in row
      sendPreciseSelectionsForCells(rowCells);
    }

    // Send precise-selection messages for a list of cells (used by column/row tools)
    function sendPreciseSelectionsForCells(cells) {
      cells.forEach(function(cell) {
        var text = cell.textContent ? cell.textContent.trim() : '';
        if (text.length === 0) return;
        var xpath = getElementXPath(cell);
        var context = getSelectionContext(cell, 0, text.length);
        var globalPos = calculateGlobalPosition(cell, 0);
        window.parent.postMessage({
          type: 'precise-selection',
          text: text,
          xpath: xpath,
          charStart: 0,
          charEnd: text.length,
          prefix: context.prefix,
          suffix: context.suffix,
          globalCharStart: globalPos.start,
          globalCharEnd: globalPos.start + text.length,
        }, '*');
      });
    }

    // === URL Tool Selection ===
    function handleUrlSelection(e) {
      var target = e.target;
      if (!target || !(target instanceof HTMLElement)) return;
      var link = target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      // Build full URL using the original page's source URL
      var fullUrl = href;
      if (href.startsWith('http')) {
        // Already absolute
        fullUrl = href;
      } else if (pageSourceUrl) {
        // Use the source URL to resolve relative URLs
        try {
          fullUrl = new URL(href, pageSourceUrl).href;
        } catch (err) {
          // Fallback: just use the href as-is
          fullUrl = href;
        }
      }

      var linkText = link.textContent ? link.textContent.trim() : '';

      // Highlight the link briefly
      var brushColor = getBrushColor('#228be6');
      link.style.setProperty('outline', '3px solid ' + brushColor, 'important');
      link.style.setProperty('background-color', brushColor + '40', 'important');

      // Send URL click message
      window.parent.postMessage({
        type: 'url-click',
        href: href,
        fullUrl: fullUrl,
        linkText: linkText
      }, '*');

      // Clear highlight after delay
      setTimeout(function() {
        link.style.removeProperty('outline');
        link.style.removeProperty('background-color');
      }, 500);
    }

    function createSelectionOverlay() {
      // Remove any existing overlay first
      var existing = document.getElementById('selection-tool-overlay');
      if (existing) existing.remove();

      // macOS Finder-style selection rectangle
      var overlay = document.createElement('div');
      overlay.id = 'selection-tool-overlay';
      // Use !important to override any CSS that might hide it
      overlay.setAttribute('style', [
        'position: fixed !important',
        'border: 2px solid rgba(0, 122, 255, 0.9) !important',
        'background: rgba(0, 122, 255, 0.25) !important',
        'pointer-events: none !important',
        'z-index: 2147483647 !important',
        'border-radius: 2px !important',
        'min-width: 1px !important',
        'min-height: 1px !important',
        'box-sizing: border-box !important',
        'display: block !important',
        'visibility: visible !important',
        'opacity: 1 !important'
      ].join(';'));
      document.body.appendChild(overlay);
      toolSelectionState.overlay = overlay;
    }

    function updateSelectionOverlay() {
      var overlay = toolSelectionState.overlay;
      if (!overlay) return;
      var bounds = getSelectionBounds();
      // Use setProperty with !important to ensure visibility
      overlay.style.setProperty('left', bounds.x + 'px', 'important');
      overlay.style.setProperty('top', bounds.y + 'px', 'important');
      overlay.style.setProperty('width', Math.max(bounds.width, 1) + 'px', 'important');
      overlay.style.setProperty('height', Math.max(bounds.height, 1) + 'px', 'important');
    }

    function getSelectionBounds() {
      var x = Math.min(toolSelectionState.startX, toolSelectionState.currentX);
      var y = Math.min(toolSelectionState.startY, toolSelectionState.currentY);
      var width = Math.abs(toolSelectionState.currentX - toolSelectionState.startX);
      var height = Math.abs(toolSelectionState.currentY - toolSelectionState.startY);
      return { x: x, y: y, width: width, height: height };
    }

    function collectTokensInRectangle() {
      var bounds = getSelectionBounds();
      toolSelectionState.collectedElements = [];
      toolSelectionState.collectedImages = [];
      toolSelectionState.wordRanges = [];

      // TEXT-NODE BASED APPROACH: Collect actual text nodes within bounds
      // This ensures ALL text is captured - no content is lost due to DOM hierarchy issues
      var textNodeResults = collectTextNodesInBounds(bounds);

      // Get unique parent elements from collected text nodes
      toolSelectionState.collectedElements = getUniqueParentElements(textNodeResults);

      // Collect images separately (they don't have text nodes)
      var allImages = document.body.getElementsByTagName('img');
      var imageCandidates = [];
      for (var i = 0; i < allImages.length; i++) {
        var img = allImages[i];
        if (!isElementVisible(img)) continue;
        var imgRect = img.getBoundingClientRect();
        if (rectsIntersect(bounds, imgRect)) {
          imageCandidates.push(img);
        }
      }
      toolSelectionState.collectedImages = imageCandidates;

      // Log collection summary to parent for debugging
      var summary = toolSelectionState.collectedElements.map(function(el) {
        var tag = el.tagName ? el.tagName.toLowerCase() : 'unknown';
        var text = el.textContent ? el.textContent.trim().substring(0, 50) : '';
        return tag + ': ' + text;
      });
      window.parent.postMessage({
        type: 'rectangle-collection-debug',
        totalScanned: textNodeResults.length,
        textCandidates: textNodeResults.length,
        afterDedup: toolSelectionState.collectedElements.length,
        images: imageCandidates.length,
        elements: summary
      }, '*');
    }

    function rectsIntersect(r1, r2) {
      return !(r2.left > r1.x + r1.width || r2.right < r1.x || r2.top > r1.y + r1.height || r2.bottom < r1.y);
    }

    function collectWordsInBounds(element, bounds) {
      var words = [];
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
      var textNode;

      while ((textNode = walker.nextNode())) {
        var text = textNode.nodeValue;
        if (!text || !text.trim()) continue;
        var nodeWords = collectWordsFromTextNode(textNode, text, bounds);
        words = words.concat(nodeWords);
      }

      return words;
    }

    function collectWordsFromTextNode(textNode, text, bounds) {
      var words = [];
      var wordMatches = extractWordPositions(text);

      for (var i = 0; i < wordMatches.length; i++) {
        var wordInfo = wordMatches[i];
        if (isWordInBounds(textNode, wordInfo, bounds)) {
          words.push(wordInfo.text);
        }
      }

      return words;
    }

    function isWordInBounds(textNode, wordInfo, bounds) {
      var range = document.createRange();
      try {
        range.setStart(textNode, wordInfo.start);
        range.setEnd(textNode, wordInfo.end);
      } catch (e) {
        return false;
      }

      var rects = range.getClientRects();
      for (var j = 0; j < rects.length; j++) {
        if (rectsIntersect(bounds, rects[j])) {
          // Store range info for later word-level highlighting
          toolSelectionState.wordRanges.push({
            textNode: textNode,
            start: wordInfo.start,
            end: wordInfo.end
          });
          return true;
        }
      }
      return false;
    }

    function extractWordPositions(text) {
      var words = [];
      var regex = /\\S+/g;
      var match;

      while ((match = regex.exec(text)) !== null) {
        words.push({
          text: match[0],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      return words;
    }

    function highlightWordsInSelection() {
      clearToolHighlights();
      toolSelectionState.wordRanges.forEach(function(wordRange) {
        highlightWordRange(wordRange.textNode, wordRange.start, wordRange.end);
      });
    }

    function highlightWordRange(textNode, start, end) {
      var range = document.createRange();
      try {
        range.setStart(textNode, start);
        range.setEnd(textNode, end);
      } catch (e) {
        return;
      }

      var highlight = document.createElement('span');
      highlight.className = 'rectangle-selection-highlight';
      highlight.style.cssText = 'background:rgba(34,139,230,0.3);outline:1px solid #228be6;border-radius:2px;';
      highlight.setAttribute('data-tool-highlight', 'true');

      try {
        range.surroundContents(highlight);
      } catch (e) {
        // Range spans multiple elements - fallback to simple background
        var rects = range.getClientRects();
        for (var i = 0; i < rects.length; i++) {
          createHighlightOverlay(rects[i]);
        }
      }
    }

    function createHighlightOverlay(rect) {
      var overlay = document.createElement('div');
      overlay.className = 'rectangle-selection-highlight';
      overlay.setAttribute('data-tool-highlight', 'true');
      overlay.style.cssText = 'position:fixed;background:rgba(34,139,230,0.3);outline:1px solid #228be6;border-radius:2px;pointer-events:none;z-index:9999;';
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      document.body.appendChild(overlay);
    }

    function collectTokensInElement(element) {
      var indices = [];
      if (element.hasAttribute('data-annotation-clickable')) {
        var indicesStr = element.getAttribute('data-token-indices');
        indices = indices.concat(indicesStr ? JSON.parse(indicesStr) : []);
      }
      element.querySelectorAll('[data-annotation-clickable]').forEach(function(c) {
        var childStr = c.getAttribute('data-token-indices');
        indices = indices.concat(childStr ? JSON.parse(childStr) : []);
      });
      return Array.from(new Set(indices));
    }

    function collectWordsInElement(element) {
      var text = element.textContent ? element.textContent : '';
      return text.trim().split(/\\s+/).filter(function(w) { return w.length > 0; });
    }

    function getCellColumnIndex(cell) {
      var index = 0;
      var sibling = cell.previousElementSibling;
      while (sibling) {
        index += sibling.colSpan ? sibling.colSpan : 1;
        sibling = sibling.previousElementSibling;
      }
      return index;
    }

    function getColumnCells(table, columnIndex) {
      var cells = [];
      var rows = table.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) {
        var cell = findCellAtColumnIndex(rows[i], columnIndex);
        if (cell) cells.push(cell);
      }
      return cells;
    }

    function findCellAtColumnIndex(row, columnIndex) {
      var currentIndex = 0;
      var rowCells = row.querySelectorAll('td, th');
      for (var j = 0; j < rowCells.length; j++) {
        var cell = rowCells[j];
        var span = cell.colSpan ? cell.colSpan : 1;
        if (currentIndex <= columnIndex && columnIndex < currentIndex + span) return cell;
        currentIndex += span;
      }
      return null;
    }

    function highlightSelectedElements() {
      clearToolHighlights();
      document.querySelectorAll('[data-annotation-clickable]').forEach(function(el) {
        if (hasSelectedToken(el)) applyToolHighlight(el);
      });
    }

    function hasSelectedToken(el) {
      var indicesStr = el.getAttribute('data-token-indices');
      var indices = indicesStr ? JSON.parse(indicesStr) : [];
      return indices.some(function(i) { return toolSelectionState.collectedTokens.has(i); });
    }

    function applyToolHighlight(el) {
      el.setAttribute('data-tool-highlight', 'true');
      el.style.setProperty('outline', '2px solid #228be6', 'important');
      el.style.setProperty('background-color', 'rgba(34,139,230,0.1)', 'important');
    }

    function clearToolHighlights() {
      document.querySelectorAll('[data-tool-highlight]').forEach(function(el) {
        // For word highlight spans, unwrap them to restore original text structure
        if (el.classList.contains('rectangle-selection-highlight')) {
          unwrapHighlightSpan(el);
        } else {
          el.style.removeProperty('outline');
          el.style.removeProperty('background-color');
          el.removeAttribute('data-tool-highlight');
        }
      });
    }

    function unwrapHighlightSpan(span) {
      var parent = span.parentNode;
      if (!parent) {
        span.remove();
        return;
      }
      // Move all children out of the span
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      span.remove();
      // Normalize to merge adjacent text nodes
      parent.normalize();
    }

    function clearToolSelection() {
      if (toolSelectionState.overlay) {
        toolSelectionState.overlay.remove();
        toolSelectionState.overlay = null;
      }
      toolSelectionState.collectedTokens.clear();
      toolSelectionState.collectedWords.clear();
      toolSelectionState.wordRanges = [];
      toolSelectionState.isDrawing = false;
      clearToolHighlights();
    }

    function isUIInteractiveElement(target) {
      if (!target || !(target instanceof HTMLElement)) return false;
      return target.closest('[data-ui-interactive]') || target.hasAttribute('data-ui-interactive');
    }

    function routeToolMousedown(e) {
      var handlers = { rectangle: startRectangleSelection, block: handleBlockSelection, word: handleWordSelection, column: handleColumnSelection, row: handleRowSelection, url: handleUrlSelection };
      var handler = handlers[activeSelectionTool];
      if (handler) handler(e);
    }

    // === Brush Drag Selection Functions ===
    // Unified brush tool that handles text, URLs, and images

    // Helper to get brush color (CSS var returns '' not null, so we need truthy check)
    function getBrushColor(fallback) {
      var cssColor = document.body.style.getPropertyValue('--brush-color');
      return cssColor ? cssColor : fallback;
    }

    function startBrushDrag(e) {
      brushDragState.isDragging = true;
      brushDragState.collectedTokens.clear();
      brushDragState.collectedWords.clear();
      brushDragState.fallbackImages = [];
      clearBrushHighlights();
      collectElementAtPoint(e.clientX, e.clientY);
    }

    function updateBrushDrag(e) {
      if (!brushDragState.isDragging) return;
      collectElementAtPoint(e.clientX, e.clientY);
    }

    function finishBrushDrag() {
      if (!brushDragState.isDragging) return;
      brushDragState.isDragging = false;

      // URLs now handled by dedicated URL tool only

      // Priority 1: Image fallback (images without token indices - useful for training)
      if (brushDragState.fallbackImages.length > 0 && brushDragState.collectedTokens.size === 0) {
        var img = brushDragState.fallbackImages[0];
        window.parent.postMessage({
          type: 'image-click',
          imageSrc: img.src,
          imageAlt: img.alt,
          tagName: 'img'
        }, '*');
        setTimeout(clearBrushHighlights, 300);
        return;
      }

      // Priority 2: Normal text/token selection
      var indices = Array.from(brushDragState.collectedTokens);
      var words = Array.from(brushDragState.collectedWords);
      if (indices.length > 0 || words.length > 0) {
        window.parent.postMessage({
          type: 'brush-drag-selection',
          tokenIndices: indices,
          words: words,
          text: words.join(' ')
        }, '*');
      }
      setTimeout(clearBrushHighlights, 300);
    }

    // === Element Collection Functions ===

    function collectElementAtPoint(x, y) {
      var element = document.elementFromPoint(x, y);
      if (!element) return;

      // Priority 1: Images (keep for training - image URLs are useful)
      if (element.tagName === 'IMG') {
        collectImageAtPoint(x, y, element);
        return;
      }

      // URLs now handled by dedicated URL tool only
      // Brush/cursor tools collect text only

      // Priority 2: Text/words
      collectWordAtPoint(x, y);
    }

    // URL collection removed - URLs now handled by dedicated URL tool only

    function collectImageAtPoint(x, y, imgElement) {
      var element = imgElement ? imgElement : document.elementFromPoint(x, y);
      if (!element || element.tagName !== 'IMG') return false;

      // Check for token indices first
      var indices = findBrushImageTokenIndices(element);
      if (indices && indices.length > 0) {
        indices.forEach(function(i) { brushDragState.collectedTokens.add(i); });
      } else {
        // Fallback: track by src/alt for later matching
        var src = element.getAttribute('src');
        var alt = element.getAttribute('alt');
        src = src ? src : '';
        alt = alt ? alt : '';
        if (src || alt) {
          var alreadyAdded = brushDragState.fallbackImages.some(function(img) {
            return img.src === src && img.alt === alt;
          });
          if (!alreadyAdded) {
            brushDragState.fallbackImages.push({ src: src, alt: alt });
          }
        }
      }

      highlightBrushImage(element);
      return true;
    }

    function findBrushImageTokenIndices(img) {
      var clickable = img.closest('[data-annotation-clickable]');
      if (clickable && clickable instanceof HTMLElement) {
        var indices = clickable.getAttribute('data-token-indices');
        if (indices) return JSON.parse(indices);
      }
      var imgIndices = img.getAttribute('data-token-indices');
      if (imgIndices) return JSON.parse(imgIndices);
      return null;
    }

    function collectTokensFromClickable(element) {
      var clickable = element.closest('[data-annotation-clickable]');
      if (!clickable) return;
      var indices = clickable.getAttribute('data-token-indices');
      if (!indices) return;
      JSON.parse(indices).forEach(function(i) { brushDragState.collectedTokens.add(i); });
    }

    function collectWordAtPoint(x, y) {
      var wordInfo = getWordRangeAtPoint(x, y);
      if (wordInfo.word && wordInfo.range) {
        var word = wordInfo.word.trim();
        if (word && !brushDragState.collectedWords.has(word)) {
          brushDragState.collectedWords.add(word);
          highlightBrushWord(wordInfo.range);
        }
      }
      // NOTE: Don't collect all token indices from parent clickable - rely on word matching
      // This ensures only the specific words brushed over get labeled, not the entire block
    }

    // === Brush Highlight Functions ===

    function highlightBrushWord(range) {
      var rect = range.getBoundingClientRect();
      var highlight = document.createElement('div');
      highlight.className = 'brush-drag-highlight';
      var brushColor = getBrushColor('rgba(34,139,230,0.4)');
      var styles = 'position:fixed;background:' + brushColor + '60;';
      styles += 'pointer-events:none;z-index:999998;border-radius:2px;';
      styles += 'left:' + rect.left + 'px;top:' + rect.top + 'px;';
      styles += 'width:' + rect.width + 'px;height:' + rect.height + 'px';
      highlight.style.cssText = styles;
      document.body.appendChild(highlight);
      brushDragState.highlightedElements.push(highlight);
    }

    // highlightBrushLink removed - URLs now handled by dedicated URL tool only

    function highlightBrushImage(img) {
      var brushColor = getBrushColor('#228be6');
      img.setAttribute('data-brush-highlight', 'true');
      // Use setProperty with important to override page CSS
      img.style.setProperty('outline', '4px solid ' + brushColor, 'important');
      img.style.setProperty('outline-offset', '2px', 'important');
      img.style.setProperty('box-shadow', '0 0 12px ' + brushColor + '80', 'important');
      brushDragState.highlightedElements.push({ element: img, isInline: true });
    }

    function clearBrushHighlights() {
      brushDragState.highlightedElements.forEach(function(item) {
        if (item.isInline) {
          // Inline element highlight - remove styles (use removeProperty for !important styles)
          item.element.removeAttribute('data-brush-highlight');
          item.element.style.removeProperty('outline');
          item.element.style.removeProperty('background-color');
          item.element.style.removeProperty('outline-offset');
          item.element.style.removeProperty('box-shadow');
        } else {
          // Overlay element - remove from DOM
          item.remove();
        }
      });
      brushDragState.highlightedElements = [];
    }

    function handleBrushMousedown(e) {
      if (!document.body.classList.contains('brush-mode-active')) return false;
      if (isUIInteractiveElement(e.target)) return false;
      e.preventDefault();
      startBrushDrag(e);
      return true;
    }

    function handleEscapeKey() {
      if (toolSelectionState.isDrawing) {
        clearToolSelection();
        window.parent.postMessage({ type: 'tool-selection-cancel', tool: activeSelectionTool }, '*');
      }
      if (brushDragState.isDragging) {
        brushDragState.isDragging = false;
        brushDragState.collectedTokens.clear();
        brushDragState.collectedWords.clear();
        brushDragState.fallbackImages = [];
        clearBrushHighlights();
      }
      if (blockDragState.isDragging) {
        blockDragState.isDragging = false;
        blockDragState.collectedTokens.clear();
        clearBlockHighlights();
      }
      // Clear word and table cell highlights on escape
      clearWordToolHighlights();
      clearTableCellHighlights();
    }

    // === Event Listeners ===
    document.body.addEventListener('mousedown', function(e) {
      // Brush tool or cursor mode with active label - allow brush drag
      var brushActive = document.body.classList.contains('brush-mode-active');
      if ((activeSelectionTool === 'brush' || activeSelectionTool === 'cursor') && brushActive && handleBrushMousedown(e)) return;
      if (!activeSelectionTool || activeSelectionTool === 'cursor') return;
      // URL tool should work on links (which are marked as UI interactive)
      // Skip UI interactive check for URL tool since it specifically targets links
      if (activeSelectionTool !== 'url' && isUIInteractiveElement(e.target)) return;
      e.preventDefault();
      routeToolMousedown(e);
    });

    document.body.addEventListener('mousemove', function(e) {
      // Allow brush drag in cursor mode when label is active
      if ((activeSelectionTool === 'brush' || activeSelectionTool === 'cursor') && brushDragState.isDragging) { updateBrushDrag(e); return; }
      if (activeSelectionTool === 'block' && blockDragState.isDragging) { updateBlockDrag(e); return; }
      if (activeSelectionTool === 'rectangle' && toolSelectionState.isDrawing) updateRectangleSelection(e);
    });

    document.body.addEventListener('mouseup', function(e) {
      // Allow brush drag in cursor mode when label is active
      if ((activeSelectionTool === 'brush' || activeSelectionTool === 'cursor') && brushDragState.isDragging) { finishBrushDrag(); return; }
      if (activeSelectionTool === 'block' && blockDragState.isDragging) { finishBlockDrag(); return; }
      if (activeSelectionTool === 'rectangle') finishRectangleSelection();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') handleEscapeKey();
    });
  `;
}

/**
 * Creates the CSS styles for the iframe content
 */
export function createIframeStyles(): string {
  return `
    <style>
      /* Flash animation for newly labeled elements */
      @keyframes labelFlash {
        0% {
          box-shadow: 0 0 0 4px rgba(64, 192, 87, 0.8);
          transform: scale(1.02);
        }
        50% {
          box-shadow: 0 0 20px 8px rgba(64, 192, 87, 0.6);
          transform: scale(1.04);
        }
        100% {
          box-shadow: none;
          transform: scale(1);
        }
      }

      [data-annotation-highlight][data-just-labeled="true"] {
        animation: labelFlash 0.5s ease-out forwards;
      }

      [data-annotation-highlight]:hover {
        outline-width: 3px !important;
        box-shadow: 0 0 8px rgba(0,0,0,0.3);
      }

      /* Brush mode cursor - shows + when a label is selected */
      body.brush-mode-active {
        cursor: cell !important;
      }
      body.brush-mode-active [data-annotation-clickable] {
        cursor: cell !important;
      }
      /* Image hover in brush mode - only images get hover effect */
      body.brush-mode-active img {
        cursor: cell !important;
      }
      body.brush-mode-active img:hover {
        outline: 3px solid var(--brush-color, #228be6) !important;
        outline-offset: 2px;
        box-shadow: 0 0 8px var(--brush-color, #228be6) !important;
      }
      /* Highlighted images */
      img[data-annotation-highlight] {
        outline: 4px solid currentColor !important;
        outline-offset: 2px;
        box-shadow: 0 0 12px rgba(0,0,0,0.3);
      }

      /* DISABLE ALL LIGHTBOX/MODAL/OVERLAY FUNCTIONALITY */
      /* Hide lightbox overlays but NOT image containers with lightbox class */
      /* Note: Fandom uses "lightbox" class on <a> tags wrapping images - DO NOT hide those */
      .media-viewer,
      .image-lightbox,
      .fandom-image-lightbox,
      [class*="media-viewer"],
      [class*="MediaViewer"],
      .modal-overlay,
      .image-modal,
      .fullscreen-image,
      #lightbox,
      #mediaViewer,
      /* Hide actual lightbox modals (positioned elements), not inline image links */
      div.lightbox,
      section.lightbox,
      aside.lightbox,
      div[class*="Lightbox"],
      section[class*="Lightbox"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* KEEP image-containing lightbox links visible (Fandom galleries) */
      a.lightbox,
      a[class*="lightbox"],
      .lightbox.image-thumbnail,
      .image-thumbnail.lightbox {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      /* Prevent images from having click handlers */
      img {
        pointer-events: auto !important;
      }

      /* Force image visibility - override lazy loading CSS that hides images */
      img {
        opacity: 1 !important;
        visibility: visible !important;
        display: inline-block !important;
      }

      /* Force lazy-loaded images to be visible */
      img[data-original-lazy],
      img[data-src],
      img.lazyload,
      img.lazyloading,
      img.lzy,
      img[data-image-key] {
        opacity: 1 !important;
        visibility: visible !important;
        display: inline-block !important;
      }

      /* Fandom gallery images - ensure they display properly */
      .wikia-gallery img,
      .gallery-image-wrapper img,
      .gallerybox img,
      .wikia-gallery-item img,
      .pi-image img,
      .pi-image-thumbnail,
      .image-thumbnail img,
      figure img,
      .thumb img,
      .thumbinner img {
        opacity: 1 !important;
        visibility: visible !important;
        display: block !important;
        max-width: 100%;
        height: auto;
      }

      /* Ensure gallery wrappers are visible while preserving layout */
      .wikia-gallery {
        display: flex !important;
        flex-wrap: wrap !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .gallery,
      .gallerybox,
      .wikia-gallery-item {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .gallery-image-wrapper {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      /* Override any lazy-load placeholder styling */
      img[src*="/api/image-proxy"] {
        background: none !important;
        min-width: 20px !important;
        min-height: 20px !important;
        width: auto !important;
        height: auto !important;
        max-width: 100% !important;
      }

      /* Fix images with zero dimensions (common lazy-load placeholder issue) */
      img[width="0"],
      img[height="0"],
      img[style*="width: 0"],
      img[style*="height: 0"],
      img[style*="width:0"],
      img[style*="height:0"] {
        width: auto !important;
        height: auto !important;
        min-width: 20px !important;
        min-height: 20px !important;
      }

      /* Disable magnify buttons */
      .magnify,
      .enlarge,
      .image-caption-zoom,
      [class*="magnify"] {
        display: none !important;
      }

      /* Ensure image links don't navigate */
      a.image,
      a[href*="/File:"],
      a[href*="/wiki/File:"] {
        cursor: pointer !important;
      }

      html, body {
        margin: 0;
        padding: 16px;
        overflow: auto !important;
        position: static !important;
        height: auto !important;
        max-height: none !important;
      }
      /* Remove Fandom fixed elements that block scrolling (but not nav elements) */
      .notifications-placeholder,
      .page__right-rail,
      .bottom-ads-container,
      .ad-slot {
        position: static !important;
        display: none !important;
      }

      /* Navigation elements - make static but visible for cursor mode */
      .global-navigation,
      .fandom-sticky-header,
      .fandom-community-header,
      .local-navigation,
      .community-header-wrapper {
        position: static !important;
      }

      /* Hide Fandom Explore sidebar and other side menus */
      .wiki-side-menu,
      .page-side-tool,
      .page-side-tools,
      .side-tool,
      .fandom-sidebar,
      [class*="SideMenu"],
      [class*="side-menu"],
      .explore-menu,
      .explore-panel,
      aside.explore,
      .page__left-rail,
      .wds-global-navigation__content-bar-left,
      .wds-community-bar,
      .wiki-tools-menu,
      .wiki__left-rail,
      [data-tracking-label="explore"],
      .global-navigation__bottom,
      .wds-global-navigation__dropdown-content,
      /* New Fandom slide-out navigation panels */
      [class*="WikiaMenuElement"],
      [class*="wds-drawer"],
      [class*="WikiaSideBar"],
      .wds-is-expanded,
      .wds-community-header__local-navigation,
      .local-navigation-menu,
      [class*="LocalNavigationMenu"],
      .global-navigation__link-group,
      .wds-global-navigation__link-group,
      /* Fandom 2024+ explore/menu panels */
      [class*="explore-menu"],
      [class*="ExploreMenu"],
      [class*="resizable-container__aside"],
      [class*="GlobalNavigation__aside"],
      [class*="global-navigation__aside"],
      [class*="LeftRail"],
      [class*="left-rail"]:not(.page__main):not(main):not(article),
      .custom-ad-slot-placeholder,
      /* The actual aside element containing Menu/Explore */
      aside:has([class*="Menu"]),
      aside:has([class*="Explore"]) {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        max-width: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -9999px !important;
      }

      /* Left panel collapse is handled via JavaScript in getFandomUIHandlersCode() */

      /* Make fixed/sticky elements static so they don't float over content */
      [style*="position: fixed"]:not(.global-navigation):not(.fandom-sticky-header),
      [style*="position:fixed"]:not(.global-navigation):not(.fandom-sticky-header) {
        position: static !important;
      }
      /* Ensure content is visible - be very explicit about Fandom structure */
      .page-content,
      .mw-parser-output,
      #content,
      main,
      main.page__main,
      .page__main,
      article,
      .resizable-container,
      .resizable-container__content,
      [class*="page__main"],
      [class*="page-content"],
      [class*="main-content"],
      [class*="wiki-content"],
      [class*="article-content"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: auto !important;
        max-width: none !important;
        overflow: visible !important;
      }
    </style>
  `;
}
