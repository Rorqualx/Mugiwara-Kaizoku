/**
 * Visual Features Extraction
 *
 * Extracts visual presentation features from HTML elements.
 * These features capture styling, layout, and rendering characteristics
 * that may indicate semantic importance or content type.
 *
 * Note: These features are extracted from inline styles and CSS.
 * For more accurate results, consider actual browser rendering.
 */

import type { VisualFeatures } from './types';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';


type Element = AnyNode;

/**
 * Extract visual features from an element
 *
 * @param element - The DOM element to analyze
 * @param $ - Cheerio API instance for DOM traversal
 * @returns Visual features including font, color, visibility, and layout info
 */
export function extractVisualFeatures(element: Element, $: CheerioAPI): VisualFeatures {
  const $el = $(element);

  // Note: These would be more accurate with actual browser rendering
  // For now, we extract what we can from CSS
  const style = $el.attr('style') ?? '';

  const fontSize = extractFontSize(style);
  const fontWeight = extractFontWeight(style);
  const color = extractColor(style);
  const backgroundColor = extractBackgroundColor(style);
  const zIndex = extractZIndex(style);

  return {
    ...(fontSize !== undefined ? { fontSize } : {}),
    ...(fontWeight !== undefined ? { fontWeight } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(backgroundColor !== undefined ? { backgroundColor } : {}),
    isVisible: isElementVisible($el),
    boundingBox: estimateBoundingBox(element, $),
    isAboveFold: isLikelyAboveFold(element, $),
    ...(zIndex !== undefined ? { zIndex } : {})
  };
}

/**
 * Check if element is visible
 *
 * Uses style attributes to determine visibility without relying on
 * jQuery-specific pseudo-selectors like :hidden which aren't supported by css-select.
 *
 * @param $el - Cheerio wrapped element
 * @returns True if element appears to be visible
 */
function isElementVisible($el: ReturnType<CheerioAPI>): boolean {
  const style = $el.attr('style') ?? '';
  const display = $el.css('display');
  const visibility = $el.css('visibility');

  // Check for explicit hiding via style attribute
  if (style.includes('display: none') || style.includes('display:none')) {
    return false;
  }
  if (style.includes('visibility: hidden') || style.includes('visibility:hidden')) {
    return false;
  }

  // Check for CSS property values
  if (display === 'none') {
    return false;
  }
  if (visibility === 'hidden') {
    return false;
  }

  // Check for hidden attribute
  if ($el.attr('hidden') !== undefined) {
    return false;
  }

  // Check for aria-hidden
  if ($el.attr('aria-hidden') === 'true') {
    return false;
  }

  return true;
}

/**
 * Extract font size from inline style
 *
 * @param style - Inline style string
 * @returns Font size in pixels, or undefined if not found
 */
export function extractFontSize(style: string): number | undefined {
  const match = style.match(/font-size:\s*(\d+)(?:px)?/i);
  const value = match?.[1];
  return value ? parseInt(value, 10) : undefined;
}

/**
 * Extract font weight from inline style
 *
 * @param style - Inline style string
 * @returns Font weight value (e.g., "bold", "400"), or undefined if not found
 */
export function extractFontWeight(style: string): string | undefined {
  const match = style.match(/font-weight:\s*(\w+)/i);
  return match?.[1];
}

/**
 * Extract text color from inline style
 *
 * @param style - Inline style string
 * @returns Color value (any CSS color format), or undefined if not found
 */
export function extractColor(style: string): string | undefined {
  const match = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
  const value = match?.[1];
  return value ? value.trim() : undefined;
}

/**
 * Extract background color from inline style
 *
 * @param style - Inline style string
 * @returns Background color value (any CSS color format), or undefined if not found
 */
export function extractBackgroundColor(style: string): string | undefined {
  const match = style.match(/background(?:-color)?:\s*([^;]+)/i);
  const value = match?.[1];
  return value ? value.trim() : undefined;
}

/**
 * Extract z-index from inline style
 *
 * @param style - Inline style string
 * @returns Z-index value, or undefined if not found
 */
export function extractZIndex(style: string): number | undefined {
  const match = style.match(/z-index:\s*(\d+)/i);
  const value = match?.[1];
  return value ? parseInt(value, 10) : undefined;
}

/**
 * Estimate bounding box for element
 *
 * Rough estimation based on DOM position.
 * In production, use actual browser rendering for accurate measurements.
 *
 * @param element - The DOM element to measure
 * @param $ - Cheerio API instance for DOM traversal
 * @returns Estimated bounding box with x, y, width, height in pixels
 */
export function estimateBoundingBox(
  element: Element,
  $: CheerioAPI
): { x: number; y: number; width: number; height: number } {
  const $el = $(element);
  const depth = $el.parents().length;
  const index = $el.index();

  return {
    x: depth * 20,
    y: index * 30,
    width: 200,
    height: 30
  };
}

/**
 * Determine if element is likely above the fold
 *
 * Heuristic: elements with fewer parents and earlier in document order
 * are likely above fold. This is a rough estimate without actual viewport info.
 *
 * @param element - The DOM element to check
 * @param $ - Cheerio API instance for DOM traversal
 * @returns True if element is likely visible without scrolling
 */
export function isLikelyAboveFold(element: Element, $: CheerioAPI): boolean {
  const $el = $(element);
  const depth = $el.parents().length;
  const index = $el.index();

  return depth < 5 && index < 10;
}
