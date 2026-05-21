/**
 * Structure-Preserving HTML→Text Converter
 *
 * Converts wiki page HTML to a structure-preserving text format that retains
 * headings, lists, images, and tables — designed for AI volume page extraction.
 *
 * Unlike `cleanHtmlToText` (flat text for page detection), this preserves
 * section boundaries so the model can identify chapter sections.
 *
 * @module phase-orchestrator/structured-text-converter
 */

import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

// ============================================================================
// Constants
// ============================================================================

/** Max structured text size for AI volume extraction (12KB ≈ 3K tokens) */
const STRUCTURED_TEXT_MAX_LENGTH = 12288;

// ============================================================================
// Element Converters
// ============================================================================

/** Check if an image URL is a tracking/spacer pixel */
function isTrackingPixel(src: string): boolean {
  return /\b(1x1|pixel|spacer|blank|tracking)\b/i.test(src);
}

/** Extract image reference string from a cheerio element, or null if tracking pixel */
function extractImageRef($: CheerioAPI, img: AnyNode): string | null {
  const src = $(img).attr('data-src') ?? $(img).attr('src') ?? '';
  const alt = $(img).attr('alt') ?? '';
  if (!src || isTrackingPixel(src)) return null;
  return `[IMAGE: ${alt} | ${src}]`;
}

/** Get tag name from a cheerio node */
function getTagName(el: AnyNode): string {
  return ('tagName' in el && typeof el.tagName === 'string') ? el.tagName.toLowerCase() : '';
}

/** Convert list items to dash-prefixed lines */
function convertListToText($: CheerioAPI, $el: ReturnType<CheerioAPI>): string {
  const items: string[] = [];
  $el.find('li').each((_j: number, li: AnyNode) => { items.push(`- ${$(li).text().trim()}`); });
  return items.length > 0 ? items.join('\n') + '\n' : '';
}

/** Convert table rows to dash-prefixed text lines */
function convertTableToText($: CheerioAPI, $el: ReturnType<CheerioAPI>): string {
  const lines: string[] = [];
  $el.find('tr').each((_j: number, tr: AnyNode) => {
    const cellTexts: string[] = [];
    $(tr).find('td, th').each((_k: number, td: AnyNode) => { cellTexts.push($(td).text().trim()); });
    if (cellTexts.some((c: string) => c.length > 0)) lines.push(`- ${cellTexts.join(' | ')}`);
  });
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

/** Convert div/figure containers: extract images + remaining text */
function convertContainerToText($: CheerioAPI, $el: ReturnType<CheerioAPI>): string {
  let result = '';
  $el.find('img').each((_j: number, img: AnyNode) => {
    const ref = extractImageRef($, img);
    if (ref) result += `${ref}\n`;
  });
  const text = $el.clone().find('img').remove().end().text().trim();
  if (text.length > 0) result += `${text}\n\n`;
  return result;
}

/** Convert a single HTML element to structured text lines */
function convertElementToText($: CheerioAPI, el: AnyNode): string {
  const tagName = getTagName(el);
  const $el = $(el);

  if (tagName === 'h2') return `\n## ${$el.text().trim()}\n`;
  if (tagName === 'h3') return `\n### ${$el.text().trim()}\n`;
  if (tagName === 'ul' || tagName === 'ol') return convertListToText($, $el);

  if (tagName === 'p') {
    const text = $el.text().trim();
    return text.length > 0 ? `${text}\n\n` : '';
  }

  if (tagName === 'table') return convertTableToText($, $el);
  if (tagName === 'div' || tagName === 'figure') return convertContainerToText($, $el);

  if (tagName === 'img') {
    const ref = extractImageRef($, el);
    return ref ? `${ref}\n` : '';
  }

  return '';
}

// ============================================================================
// Infobox & Truncation Helpers
// ============================================================================

/** Extract infobox cover image URL before removing noise elements */
function extractInfoboxCover($: CheerioAPI, $content: ReturnType<CheerioAPI>): string {
  const $img = $content.find('.infobox img, .portable-infobox img, .pi-image img').first();
  if ($img.length === 0) return '';
  const src = $img.attr('data-src') ?? $img.attr('src') ?? '';
  if (!src || isTrackingPixel(src)) return '';
  return `[INFOBOX_COVER: ${src}]\n\n`;
}

/** Truncate sections to fit within budget, never cutting mid-section */
function truncateSections(sections: string[], prefix: string): string {
  const full = prefix + sections.join('\n\n');
  if (full.length <= STRUCTURED_TEXT_MAX_LENGTH) return full;

  let truncated = '';
  for (const section of sections) {
    const next = truncated ? `${truncated}\n\n${section}` : section;
    if ((prefix + next).length > STRUCTURED_TEXT_MAX_LENGTH) break;
    truncated = next;
  }
  return prefix + truncated;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Convert raw HTML to structure-preserving text for AI volume page extraction.
 * Preserves headings, lists, and image references so the model can identify
 * chapter sections within volume pages.
 */
export async function cleanHtmlToStructuredText(html: string): Promise<string> {
  const { load } = await import('cheerio');
  const $ = load(html);
  const $content = $('.mw-parser-output').length > 0
    ? $('.mw-parser-output')
    : ($('.page-content').length > 0 ? $('.page-content') : $('body'));

  const infoboxCover = extractInfoboxCover($, $content);

  // Remove noise elements
  $content.find('.navbox, .toc, .mw-editsection, script, style, nav, footer, .global-navigation, .reference, .references').remove();

  // Convert children to structured sections
  const sections: string[] = [];
  let currentSection = '';

  $content.children().each((_i: number, el: AnyNode) => {
    if (getTagName(el) === 'h2' && currentSection.trim()) {
      sections.push(currentSection.trim());
      currentSection = '';
    }
    currentSection += convertElementToText($, el);
  });

  if (currentSection.trim()) sections.push(currentSection.trim());

  return truncateSections(sections, infoboxCover);
}
