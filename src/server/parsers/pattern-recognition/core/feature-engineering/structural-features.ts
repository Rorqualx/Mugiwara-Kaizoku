/**
 * Structural Feature Extraction
 *
 * Extracts DOM structure features: tags, attributes, depth, position.
 * Analyzes element structure, relationships, and hierarchy for pattern recognition.
 *
 * Extracted from: FeatureEngineering.ts (lines 67-87)
 */

import { getDOMPath, getAttributes } from './dom-helpers';

import type { Element, CheerioAPI, StructuralFeatures } from './types';

// ============================================================================
// Structural Feature Extraction
// ============================================================================

/**
 * Extract structural features from DOM element
 *
 * Analyzes the DOM structure including:
 * - Element hierarchy (depth, parents, siblings, children)
 * - DOM paths and selectors
 * - Tag names and attributes
 * - Position within parent
 *
 * @param element - DOM element to extract features from
 * @param $ - Cheerio instance for DOM manipulation
 * @returns Structural features object with hierarchy and attribute data
 *
 * @example
 * ```typescript
 * const features = extractStructuralFeatures(element, $);
 * console.log(features.domDepth);      // 5 (number of parent elements)
 * console.log(features.tagName);       // 'div'
 * console.log(features.classList);     // ['container', 'main']
 * console.log(features.siblingCount);  // 3
 * ```
 */
export function extractStructuralFeatures(
  element: Element,
  $: CheerioAPI
): StructuralFeatures {
  const $el = $(element);
  const parents = $el.parents();
  const idAttr = $el.attr('id');

  return {
    // Placeholder counts (populated by parent analysis)
    tagCounts: {},
    maxDepth: 0,
    averageDepth: 0,
    elementCount: 0,

    // Element hierarchy
    domDepth: parents.length,
    domPath: getDOMPath(element, $),
    siblingCount: $el.siblings().length,
    childCount: $el.children().length,
    parentTag: $el.parent().prop('tagName')?.toLowerCase() ?? '',

    // Element identity
    tagName: ('tagName' in element && element.tagName ? element.tagName.toLowerCase() : ''),
    classList: ($el.attr('class') ?? '').split(/\s+/).filter(Boolean),
    ...(idAttr ? { idAttribute: idAttr } : {}),

    // Attributes and position
    attributes: getAttributes(element, $),
    position: $el.index()
  };
}
