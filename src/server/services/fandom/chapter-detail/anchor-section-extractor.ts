/**
 * Anchor Section Extractor for Fandom Wikis
 *
 * Handles extraction of chapter content from volume/arc pages where chapters
 * are identified by anchor links (e.g., #001._Death_&_Strawberry).
 *
 * @module chapter-detail/anchor-section-extractor
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import { cleanWikiaImageUrl } from '../utils/imageUtils';

import type { AnyNode } from 'domhandler';

type CheerioElement = cheerio.Cheerio<AnyNode>;

/**
 * Extracted chapter section content
 */
export interface AnchorSectionContent {
  coverImageUrl?: string;
  synopsis?: string;
  title?: string;
}

/**
 * Parses URL anchor fragment (everything after #)
 */
export function extractAnchor(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const hash = urlObj.hash;
    if (!hash || hash === '#') return undefined;
    return decodeURIComponent(hash.slice(1));
  } catch {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return undefined;
    const anchor = url.slice(hashIndex + 1);
    try {
      return decodeURIComponent(anchor);
    } catch {
      return anchor;
    }
  }
}

/**
 * Checks if URL has an anchor fragment
 */
export function hasAnchor(url: string): boolean {
  return url.includes('#') && !url.endsWith('#');
}

function isHeading($el: CheerioElement): boolean {
  const tagName = $el.prop('tagName')?.toLowerCase();
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName ?? '');
}

function getHeadingLevel($el: CheerioElement): number {
  const tagName = $el.prop('tagName')?.toLowerCase();
  if (!tagName) return 7;
  const match = tagName.match(/^h(\d)$/);
  return match ? parseInt(match[1] ?? '7', 10) : 7;
}

function findAnchorElement(
  $: cheerio.CheerioAPI,
  anchor: string
): CheerioElement | null {
  let element = $(`[id="${anchor}"]`);
  if (element.length > 0) return element;

  const encoded = encodeURIComponent(anchor).replace(/%20/g, '_').replace(/%/g, '.');
  element = $(`[id="${encoded}"]`);
  if (element.length > 0) return element;

  const simplified = anchor.replace(/\./g, '.5C.');
  element = $(`[id="${simplified}"]`);
  if (element.length > 0) return element;

  const chapterNumMatch = anchor.match(/^(-?\d{1,4})/);
  if (!chapterNumMatch) return null;

  const chapterNum = chapterNumMatch[1];
  element = $(`[id^="${chapterNum}."]`).first();
  if (element.length > 0) return element;

  const paddedNum = chapterNum?.padStart(3, '0');
  element = $(`[id^="${paddedNum}."]`).first();
  if (element.length > 0) return element;

  logger.debug(`[anchor-section] Could not find element for anchor: ${anchor}`);
  return null;
}

function extractImageFromElement(
  $: cheerio.CheerioAPI,
  $el: CheerioElement
): string | undefined {
  const $img = $el.is('img') ? $el : $($el).find('img').first();
  if ($img.length === 0) return undefined;

  const src = $img.attr('data-src') ?? $img.attr('src') ?? $img.attr('data-image-url');
  if (!src || src.includes('data:') || src.includes('Site-logo')) return undefined;

  const cleaned = cleanWikiaImageUrl(src);
  return cleaned !== '' ? cleaned : undefined;
}

function extractSynopsisFromElement(
  $: cheerio.CheerioAPI,
  $el: CheerioElement
): string | undefined {
  const $p = $el.is('p') ? $el : $($el).find('p').first();
  if ($p.length > 0) {
    const text = $p.text().trim();
    if (text.length > 50 && text.length < 2000) return text;
  }

  if ($el.is('table') || $el.is('ul') || $el.is('ol')) return undefined;

  const text = $($el).text().trim();
  if (text.length > 100 && text.length < 2000 && !text.includes('|')) {
    return text.substring(0, 1000);
  }

  return undefined;
}

function extractFromTableCells(
  $: cheerio.CheerioAPI,
  $table: CheerioElement
): string | undefined {
  let synopsis: string | undefined;
  $table.find('td').each((_, td) => {
    const text = $(td).text().trim();
    const isValidLength = text.length > 100 && text.length < 2000;
    const isNotList = !text.includes('•') && !text.match(/^\d+\./m);
    if (isValidLength && isNotList) {
      synopsis = text.substring(0, 1000);
      return false;
    }
  });
  return synopsis;
}

function collectDirectSiblings(
  $: cheerio.CheerioAPI,
  $heading: CheerioElement,
  headingLevel: number
): CheerioElement[] {
  const elements: CheerioElement[] = [];
  let $current = $heading.next();

  while ($current.length > 0) {
    if (isHeading($current) && getHeadingLevel($current) <= headingLevel) break;
    elements.push($current);
    $current = $current.next();
  }

  return elements;
}

function collectFromParent(
  $: cheerio.CheerioAPI,
  $heading: CheerioElement,
  headingLevel: number
): CheerioElement[] {
  const elements: CheerioElement[] = [];
  const $parent = $heading.parent();

  if ($parent.length === 0 || $parent.is('body')) return elements;

  const headingIndex = $parent.children().index($heading);
  const children = $parent.children().toArray();

  for (let i = headingIndex + 1; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    const $child = $(child);
    if (isHeading($child) && getHeadingLevel($child) <= headingLevel) break;
    elements.push($child);
  }

  return elements;
}

function extractTitle(headingText: string): string | undefined {
  if (!headingText) return undefined;
  const titleMatch = headingText.match(/^\d{1,4}[.:]\s*(.+)$/);
  return titleMatch ? titleMatch[1]?.trim() : headingText;
}

function processElements(
  $: cheerio.CheerioAPI,
  elements: CheerioElement[],
  result: AnchorSectionContent
): void {
  /* eslint-disable no-param-reassign */
  for (const $el of elements) {
    if (!result.coverImageUrl) {
      const img = extractImageFromElement($, $el);
      if (img) result.coverImageUrl = img;
    }
    if (!result.synopsis) {
      const syn = extractSynopsisFromElement($, $el);
      if (syn) result.synopsis = syn;
    }
    if ($el.is('table')) {
      if (!result.coverImageUrl) {
        const img = extractImageFromElement($, $el);
        if (img) result.coverImageUrl = img;
      }
      if (!result.synopsis) {
        const syn = extractFromTableCells($, $($el));
        if (syn) result.synopsis = syn;
      }
    }
    if (result.coverImageUrl && result.synopsis) break;
  }
  /* eslint-enable no-param-reassign */
}

function extractSectionContent(
  $: cheerio.CheerioAPI,
  $anchor: CheerioElement
): AnchorSectionContent {
  const result: AnchorSectionContent = {};

  let $heading = $anchor;
  if ($anchor.is('span')) {
    $heading = $anchor.parent();
  }

  const title = extractTitle($heading.text().trim());
  if (title) result.title = title;

  const headingLevel = getHeadingLevel($heading);
  let elements = collectDirectSiblings($, $heading, headingLevel);

  if (elements.length === 0) {
    elements = collectFromParent($, $heading, headingLevel);
  }

  processElements($, elements, result);

  return result;
}

/**
 * Extract chapter content from a page using an anchor reference
 */
export function extractAnchorSectionContent(
  $: cheerio.CheerioAPI,
  url: string
): AnchorSectionContent | null {
  const anchor = extractAnchor(url);
  if (!anchor) {
    logger.debug(`[anchor-section] URL has no anchor: ${url}`);
    return null;
  }

  logger.debug(`[anchor-section] Looking for anchor: ${anchor}`);

  const $anchorEl = findAnchorElement($, anchor);
  if (!$anchorEl) {
    logger.warn(`[anchor-section] Could not find anchor element for: ${anchor}`);
    return null;
  }

  const content = extractSectionContent($, $anchorEl);

  logger.info(`[anchor-section] Extracted from anchor ${anchor.substring(0, 30)}...`, {
    hasCover: !!content.coverImageUrl,
    hasSynopsis: !!content.synopsis,
    hasTitle: !!content.title,
  });

  return content;
}
