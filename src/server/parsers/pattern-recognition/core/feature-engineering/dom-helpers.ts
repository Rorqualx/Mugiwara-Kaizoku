/**
 * DOM Helper Functions
 *
 * Utilities for DOM traversal, path generation, and attribute extraction.
 * Used by structural and contextual feature extractors.
 *
 * Extracted from: FeatureEngineering.ts (lines 176-238)
 */

import type { Element, CheerioAPI } from './types';

// ============================================================================
// DOM Path Generation
// ============================================================================

/**
 * Get DOM path with CSS selectors
 *
 * Traverses from element to root, building array of CSS selectors.
 * Prioritizes IDs, then first class, then tag name only.
 *
 * @param element - DOM element to get path for
 * @param $ - Cheerio instance
 * @returns Array of CSS selectors from root to element
 *
 * @example
 * getDOMPath(element, $) → ['html', 'body', 'div#content', 'section.main', 'p']
 */
export function getDOMPath(element: Element, $: CheerioAPI): string[] {
  const path: string[] = [];
  let current = $(element);
  while (current.length) {
    const node = current[0];
    if (!node || !('tagName' in node) || !node.tagName) break;
    const tag = node.tagName.toLowerCase();
    const id = current.attr('id');
    const classes = current.attr('class');
    let selector = tag;
    if (id) selector += `#${id}`;
    else if (classes) {
      const firstClass = classes.split(' ')[0];
      if (firstClass) selector += `.${firstClass}`;
    }
    path.unshift(selector);
    current = current.parent();
  }
  return path;
}

/**
 * Get XPath to element
 *
 * Generates an XPath expression that uniquely identifies the element.
 * Uses tag names and 1-based sibling indices.
 *
 * @param element - DOM element to get XPath for
 * @param $ - Cheerio instance
 * @returns XPath string (e.g., "/html[1]/body[1]/div[2]/p[1]")
 *
 * @example
 * getXPath(element, $) → '/html[1]/body[1]/div[2]/section[1]/p[3]'
 */
export function getXPath(element: Element, $: CheerioAPI): string {
  const path: string[] = [];
  let current = $(element);
  while (current.length) {
    const node = current[0];
    if (!node || !('tagName' in node) || !node.tagName) break;
    const tag = node.tagName.toLowerCase();
    const index = current.index() + 1;
    path.unshift(`${tag}[${index}]`);
    current = current.parent();
  }
  return '/' + path.join('/');
}

/**
 * Generate CSS selector for element
 *
 * Creates a CSS selector that can identify the element.
 * Priority: ID > classes > nth-child position.
 *
 * @param element - DOM element to generate selector for
 * @param $ - Cheerio instance
 * @returns CSS selector string
 *
 * @example
 * getCSSSelector(element, $) → 'div#main'
 * getCSSSelector(element, $) → 'p.intro.highlight'
 * getCSSSelector(element, $) → 'div:nth-child(3)'
 */
export function getCSSSelector(element: Element, $: CheerioAPI): string {
  const $el = $(element);
  const tag = ('tagName' in element && element.tagName ? element.tagName.toLowerCase() : '');
  const id = $el.attr('id');
  const classes = ($el.attr('class') ?? '').split(' ').filter(Boolean);
  let selector = tag;
  if (id) {
    selector += `#${id}`;
  } else if (classes.length > 0) {
    selector += '.' + classes.join('.');
  } else {
    const index = $el.index();
    if (index > 0) {
      selector += `:nth-child(${index + 1})`;
    }
  }
  return selector;
}

// ============================================================================
// Attribute Extraction
// ============================================================================

/**
 * Extract all element attributes
 *
 * Retrieves all HTML attributes from the element as key-value pairs.
 * Handles missing or undefined attributes safely.
 *
 * @param element - DOM element to extract attributes from
 * @param $ - Cheerio instance
 * @returns Record of attribute names to values
 *
 * @example
 * getAttributes(element, $) → { id: 'main', class: 'container', 'data-role': 'content' }
 */
export function getAttributes(element: Element, $: CheerioAPI): Record<string, string> {
  const attrs: Record<string, string> = {};
  const $el = $(element);
  // Get all attributes
  const node = $el[0];
  if (node !== undefined && 'attribs' in node) {
    const attribs = node.attribs;
    for (const [key, value] of Object.entries(attribs)) {
      attrs[key] = String(value);
    }
  }
  return attrs;
}
