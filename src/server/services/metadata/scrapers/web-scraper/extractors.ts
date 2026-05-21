/**
 * Web Scraper Value Extraction
 *
 * Handles extracting values from HTML elements using CSS/XPath selectors
 * with support for text, attribute, and HTML extraction.
 *
 * Extracted from: WebScraper.ts (lines 255-291)
 */

import * as cheerio from 'cheerio';


import { logger } from '@/server/utils/logger';
import type { SelectorConfig } from '@/types/adapters/native-download-types';


import { applyTransformations } from './transformations';

import type { AnyNode } from 'domhandler';

/**
 * Extract value from HTML element using selector configuration
 *
 * Orchestrates the extraction process:
 * 1. Finds element using CSS/XPath selector
 * 2. Extracts raw value based on extraction type
 * 3. Applies transformations if configured
 */
export function extractValue(
  $: cheerio.CheerioAPI,
  context: unknown,
  selector: SelectorConfig
): string {
  const element = findElement($, context, selector);
  if (!element || element.length === 0) {
    return '';
  }

  const rawValue = extractRawValue(element, selector);
  return applyTransforms(rawValue, selector);
}

/**
 * Find element using CSS or XPath selector
 *
 * Tries to find within context first, then falls back to global search.
 * XPath selectors are not yet implemented.
 */
function findElement(
  $: cheerio.CheerioAPI,
  context: unknown,
  selector: SelectorConfig
): cheerio.Cheerio<AnyNode> | null {
  if (selector.css) {
    // Try finding within context first
    const contextElement = $(context as AnyNode).find(selector.css);
    if (contextElement.length > 0) {
      return contextElement;
    }

    // Fall back to global search
    const globalElement = $(selector.css);
    return globalElement.length > 0 ? globalElement : null;
  }

  if (selector.xpath) {
    logger.info('XPath selectors not yet implemented:', selector.xpath);
    return null;
  }

  return null;
}

/**
 * Extract raw value based on extraction type
 *
 * Supports:
 * - text: Trimmed text content
 * - attribute: Value of specified attribute
 * - html: Raw HTML content
 */
function extractRawValue(
  element: cheerio.Cheerio<AnyNode>,
  selector: SelectorConfig
): string {
  switch (selector.extract) {
    case 'text':
      return element.text().trim();
    case 'attribute':
      return (element.attr(selector.attribute ?? '') ?? '') as string;
    case 'html':
      return (element.html() ?? '') as string;
    default:
      return '';
  }
}

/**
 * Apply transformations if configured
 *
 * Delegates to applyTransformations if transforms are present,
 * otherwise returns value unchanged.
 */
function applyTransforms(value: string, selector: SelectorConfig): string {
  if (selector.transform && selector.transform.length > 0) {
    return applyTransformations(value, selector.transform);
  }
  return value;
}
