/**
 * Element Finder Module
 *
 * Responsible for finding and selecting HTML elements that match pattern
 * recognition criteria. Provides utilities for:
 * - Finding candidate elements for pattern matching
 * - Getting selectors specific to pattern types
 * - Generating CSS selectors for discovered elements
 *
 * Extracted from: PatternRecognitionEngine.ts
 * Date: 2025-11-20
 */

import type { PatternType } from '@/server/parsers/pattern-recognition/types';

import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

// ============================================================================
// Type Aliases
// ============================================================================

type Element = AnyNode;

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Find candidate HTML elements for pattern matching
 *
 * Searches the DOM for elements that match selectors based on the target
 * pattern type. If no type is specified, uses broad selectors to find
 * all potential pattern-containing elements.
 *
 * @param $ - Cheerio API instance for DOM traversal
 * @param targetType - Optional pattern type to narrow search
 * @returns Array of candidate elements for pattern matching
 */
export function findCandidateElements(
  $: CheerioAPI,
  targetType?: PatternType
): Element[] {
  const candidates: Element[] = [];

  // Define selectors based on target type
  let selectors: string[] = [];
  if (targetType) {
    selectors = getSelectorsForType(targetType);
  } else {
    // Use broad selectors for general search
    selectors = [
      'table',
      '.infobox',
      '.portable-infobox',
      '.gallery',
      '.wikia-gallery',
      'h1, h2, h3',
      'img',
      'p',
      'div[class*="volume"]',
      'div[class*="chapter"]',
      'section',
      'article'
    ];
  }

  // Find elements matching selectors
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      candidates.push(element);
    });
  }

  return candidates;
}

/**
 * Get CSS selectors specific to a pattern type
 *
 * Returns an array of CSS selectors that are most likely to match
 * elements containing the specified pattern type. Uses attribute
 * selectors, class patterns, and semantic HTML markers.
 *
 * @param type - Pattern type to get selectors for
 * @returns Array of CSS selectors for the pattern type
 */
export function getSelectorsForType(type: PatternType): string[] {
  switch (type) {
    case 'volume':
      return [
        'div[class*="volume"]',
        'tr:contains("Volume")',
        '.volume-item',
        '[data-volume]'
      ];
    case 'chapter':
      return [
        'div[class*="chapter"]',
        'tr:contains("Chapter")',
        '.chapter-item',
        '[data-chapter]'
      ];
    case 'title':
      return ['h1', 'h2', '.title', '.page-title'];
    case 'coverImage':
      return [
        '.cover img',
        '.infobox img',
        '.portable-infobox img',
        'img[alt*="cover"]'
      ];
    case 'table':
      return ['table', '.wikitable', '.data-table'];
    case 'infobox':
      return ['.infobox', '.portable-infobox', '.sidebar'];
    default:
      return ['*'];
  }
}

/**
 * Generate a CSS selector for a specific element
 *
 * Creates a unique CSS selector that identifies the given element.
 * Strategy:
 * 1. Use element ID if available
 * 2. Use unique class combination if available
 * 3. Generate path-based selector from DOM ancestry
 *
 * @param element - DOM element to create selector for
 * @param $ - Cheerio API instance for DOM traversal
 * @returns CSS selector string for the element
 */
export function generateSelector(element: Element, $: CheerioAPI): string {
  const $el = $(element);

  // Try ID first - most specific selector
  const id = $el.attr('id');
  if (id) {
    return `#${id}`;
  }

  // Try unique class combination
  const classes = ($el.attr('class') ?? '').split(' ').filter(Boolean);
  if (classes.length > 0) {
    const selector = '.' + classes.join('.');
    if ($(selector).length === 1) {
      return selector;
    }
  }

  // Generate path-based selector from DOM ancestry
  const path: string[] = [];
  let current = $el;
  while (current.length > 0 && path.length < 5) {
    const node = current[0];
    if (!node) break;

    // Get tag name safely with optional chaining
    const tag =
      'tagName' in node && node.tagName
        ? node.tagName.toLowerCase()
        : undefined;
    if (!tag) break;

    // Build tag with first class if available
    const currentClasses = (current.attr('class') ?? '')
      .split(' ')
      .filter(Boolean);
    const classSelector = currentClasses.length > 0 ? '.' + currentClasses[0] : '';
    path.unshift(tag + classSelector);

    // Move to parent
    current = current.parent();
  }

  return path.join(' > ');
}
