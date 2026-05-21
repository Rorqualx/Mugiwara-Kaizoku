/**
 * Contextual Feature Extraction
 *
 * Extracts contextual features from HTML elements, including:
 * - Nearby text from siblings and parents
 * - Table context (position, headers)
 * - List context (type, position)
 * - Section context (headings, depth)
 */

import type { ContextualFeatures } from '@/server/parsers/pattern-recognition/types';

import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';


type Element = AnyNode;

/**
 * Table context result type (discriminated union)
 */
type TableContext =
  | { isInTable: false }
  | {
      isInTable: true;
      rowIndex: number;
      columnIndex: number;
      headerText?: string;
    };

/**
 * List context result type (discriminated union)
 */
type ListContext =
  | { isInList: false }
  | {
      isInList: true;
      listType: 'ul' | 'ol' | 'dl';
      itemIndex: number;
    };

/**
 * Section context result type
 */
interface SectionContext {
  sectionHeading?: string;
  sectionDepth?: number;
}

/**
 * Extract contextual features from surrounding elements
 *
 * @param element - DOM element to analyze
 * @param $ - Cheerio instance
 * @returns Contextual features including nearby text, table context, list context, and section context
 */
export function extractContextualFeatures(
  element: Element,
  $: CheerioAPI
): ContextualFeatures {
  const tableContext = getTableContext(element, $);
  const sectionContext = getSectionContext(element, $);

  return {
    nearbyText: getNearbyText(element, $),
    tableContext,
    listContext: getListContext(element, $),
    sectionContext,
  };
}

/**
 * Get text from nearby elements (siblings and parent)
 *
 * @param element - DOM element to analyze
 * @param $ - Cheerio instance
 * @returns Array of nearby text content
 */
export function getNearbyText(element: Element, $: CheerioAPI): string[] {
  const $el = $(element);
  const nearby: string[] = [];

  // Get previous sibling text
  const prev = $el.prev().text().trim();
  if (prev) nearby.push(prev);

  // Get next sibling text
  const next = $el.next().text().trim();
  if (next) nearby.push(next);

  // Get parent text (excluding current element)
  const parentClone = $el.parent().clone();
  // Remove the current element from the cloned parent
  const $current = parentClone.find('> *').filter((_, el) => el === element);
  $current.remove();
  const parentText = parentClone.text().trim();
  if (parentText) nearby.push(parentText);

  return nearby;
}

/**
 * Get table context information if element is within a table
 *
 * @param element - DOM element to analyze
 * @param $ - Cheerio instance
 * @returns Table context with position and header information
 */
export function getTableContext(element: Element, $: CheerioAPI): TableContext {
  const $el = $(element);
  const $table = $el.closest('table');

  if ($table.length === 0) {
    return { isInTable: false };
  }

  const $cell = $el.closest('td, th');
  const $row = $el.closest('tr');

  let headerText: string | undefined;

  if ($cell.length > 0) {
    const columnIndex = $cell.index();
    const $headerRow = $table.find('tr').first();
    const $header = $headerRow.find('th, td').eq(columnIndex);
    const text = $header.text().trim();
    if (text) headerText = text;
  }

  return {
    isInTable: true,
    rowIndex: $row.index(),
    columnIndex: $cell.index(),
    ...(headerText ? { headerText } : {}),
  };
}

/**
 * Get list context information if element is within a list
 *
 * @param element - DOM element to analyze
 * @param $ - Cheerio instance
 * @returns List context with type and position information
 */
export function getListContext(element: Element, $: CheerioAPI): ListContext {
  const $el = $(element);
  const $list = $el.closest('ul, ol, dl');

  if ($list.length === 0) {
    return { isInList: false };
  }

  const $item = $el.closest('li, dt, dd');

  const listNode = $list[0] as Element & { tagName?: string };
  const tagName = listNode.tagName ?? 'ul';
  return {
    isInList: true,
    listType: tagName.toLowerCase() as 'ul' | 'ol' | 'dl',
    itemIndex: $item.index(),
  };
}

/**
 * Get section context by finding nearest heading
 *
 * @param element - DOM element to analyze
 * @param $ - Cheerio instance
 * @returns Section context with heading text and depth
 */
export function getSectionContext(
  element: Element,
  $: CheerioAPI
): SectionContext {
  const $el = $(element);

  // Find nearest heading
  const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  let sectionHeading: string | undefined;
  let sectionDepth: number | undefined;

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const $heading = $el.prevAll(heading).first();

    if ($heading.length > 0) {
      sectionHeading = $heading.text().trim();
      sectionDepth = i + 1;
      break;
    }
  }

  return {
    ...(sectionHeading ? { sectionHeading } : {}),
    ...(sectionDepth !== undefined ? { sectionDepth } : {}),
  };
}
