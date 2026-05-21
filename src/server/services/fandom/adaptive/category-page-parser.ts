/**
 * Category Page Parser
 *
 * Handles Fandom wiki Category pages (e.g., /wiki/Category:Volumes, /wiki/Category:Chapters)
 * that list items using the `.category-page__members` structure.
 *
 * Example wikis: Blue Lock, Sakamoto Days, Tokyo Ghoul, Chainsaw Man
 *
 * @module category-page-parser
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

// ============================================================================
// Types
// ============================================================================

export interface CategoryPageVolume {
  number: number;
  title?: string;
  url: string;
  coverImage?: string;
}

export interface CategoryPageChapter {
  number: number;
  title?: string;
  url: string;
  volumeNumber?: number;
}

export interface CategoryPageResult {
  success: boolean;
  volumes: CategoryPageVolume[];
  chapters: CategoryPageChapter[];
  totalFound: number;
  pageType: 'volumes' | 'chapters' | 'mixed';
}

interface ParsedMember {
  type: 'volume' | 'chapter';
  volume?: CategoryPageVolume;
  chapter?: CategoryPageChapter;
}

// ============================================================================
// Detection
// ============================================================================

/**
 * Checks if the HTML contains a category page structure.
 */
export function isCategoryPageStructure(html: string): boolean {
  const $ = cheerio.load(html);
  const hasCategoryMembers = $('.category-page__members').length > 0;
  const hasCategoryTitle = $('h1.page-header__title').text().toLowerCase().includes('category:');
  const hasMemberLinks = $('.category-page__member-link').length > 0;

  return hasCategoryMembers || (hasCategoryTitle && hasMemberLinks);
}

// ============================================================================
// Parsing Utilities
// ============================================================================

/**
 * Extracts volume number from text like "Volume 1", "Vol. 12", etc.
 */
function extractVolumeNumber(text: string): number | null {
  const volumeMatch = text.match(/volume\s*(\d+)/i);
  if (volumeMatch?.[1]) return parseInt(volumeMatch[1], 10);

  const volMatch = text.match(/vol\.?\s*(\d+)/i);
  if (volMatch?.[1]) return parseInt(volMatch[1], 10);

  const numberMatch = text.match(/^(\d+)$/);
  if (numberMatch?.[1]) return parseInt(numberMatch[1], 10);

  return null;
}

/**
 * Extracts chapter number from text like "Chapter 1", "Ch. 12", "Episode 5", etc.
 * Also supports Volume 0 prequel format: "Chapter 0-1", "000-1" → 0.1
 */
function extractChapterNumber(text: string): number | null {
  // Special handling for Volume 0 prequel format: "Chapter 0-1", "000-1" → 0.1, 0.2, etc.
  const zeroChapterPatterns = [
    /chapter\s*0+-(\d+)/i,        // Chapter 0-1 → 0.1
    /^0+-(\d+)(?:\.|$|\s)/,       // 000-1, 000-1. → 0.1
    /\b0+-(\d+)\b/,               // 000-1 anywhere → 0.1
  ];
  for (const pattern of zeroChapterPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseFloat(`0.${match[1]}`);
    }
  }

  const chapterMatch = text.match(/chapter\s*(\d+(?:\.\d+)?)/i);
  if (chapterMatch?.[1]) return parseFloat(chapterMatch[1]);

  const chMatch = text.match(/ch\.?\s*(\d+(?:\.\d+)?)/i);
  if (chMatch?.[1]) return parseFloat(chMatch[1]);

  const episodeMatch = text.match(/episode\s*(\d+(?:\.\d+)?)/i);
  if (episodeMatch?.[1]) return parseFloat(episodeMatch[1]);

  const numberMatch = text.match(/^(\d+(?:\.\d+)?)$/);
  if (numberMatch?.[1]) return parseFloat(numberMatch[1]);

  return null;
}

/**
 * Determines if a member link is for a volume or chapter based on text/URL.
 */
function categorizeLink(text: string, href: string): 'volume' | 'chapter' | 'unknown' {
  const lowerText = text.toLowerCase();
  const lowerHref = href.toLowerCase();

  const isVolume =
    lowerText.includes('volume') ||
    lowerHref.includes('volume') ||
    lowerText.match(/^vol\.?\s*\d+/) !== null ||
    lowerHref.includes('/volume_');

  if (isVolume) return 'volume';

  const isChapter =
    lowerText.includes('chapter') ||
    lowerHref.includes('chapter') ||
    lowerText.match(/^ch\.?\s*\d+/) !== null ||
    lowerHref.includes('/chapter_') ||
    lowerText.includes('episode') ||
    lowerHref.includes('episode');

  if (isChapter) return 'chapter';

  return 'unknown';
}

/**
 * Extracts cover image URL from member thumbnail.
 */
function extractCoverImage($: CheerioAPI, $member: Cheerio<Element>): string | undefined {
  const $img = $member.find('.category-page__member-thumbnail');
  if ($img.length > 0) {
    return $img.attr('data-src') ?? $img.attr('src');
  }
  return undefined;
}

/**
 * Creates a volume entry from parsed data.
 */
function createVolumeEntry(
  volumeNumber: number,
  title: string,
  url: string,
  coverImage?: string
): CategoryPageVolume {
  const entry: CategoryPageVolume = { number: volumeNumber, url };
  if (title !== `Volume ${volumeNumber}`) entry.title = title;
  if (coverImage) entry.coverImage = coverImage;
  return entry;
}

/**
 * Creates a chapter entry from parsed data.
 */
function createChapterEntry(chapterNumber: number, title: string, url: string): CategoryPageChapter {
  const entry: CategoryPageChapter = { number: chapterNumber, url };
  if (title !== `Chapter ${chapterNumber}`) entry.title = title;
  return entry;
}

/**
 * Builds an absolute URL from a relative href.
 */
function buildAbsoluteUrl(href: string, baseUrl?: string): string {
  if (href.startsWith('http')) return href;
  if (!baseUrl) {
    logger.warn('[categoryPageParser] Relative URL without baseUrl', { href });
    return href; // Return relative as fallback
  }
  return `${baseUrl}${href}`;
}

/**
 * Parses a single category member element.
 */
function parseCategoryMember(
  $: CheerioAPI,
  $member: Cheerio<Element>,
  baseUrl?: string
): ParsedMember | null {
  const $link = $member.find('.category-page__member-link');
  if ($link.length === 0) return null;

  const href = $link.attr('href') ?? '';
  const title = $link.attr('title') ?? $link.text().trim();
  const text = $link.text().trim();

  if (!href || !text) return null;

  const url = buildAbsoluteUrl(href, baseUrl);
  const category = categorizeLink(text, href);

  if (category === 'volume') {
    const volumeNumber = extractVolumeNumber(text);
    if (volumeNumber === null) return null;
    const coverImage = extractCoverImage($, $member);
    return { type: 'volume', volume: createVolumeEntry(volumeNumber, title, url, coverImage) };
  }

  if (category === 'chapter') {
    const chapterNumber = extractChapterNumber(text);
    if (chapterNumber === null) return null;
    return { type: 'chapter', chapter: createChapterEntry(chapterNumber, title, url) };
  }

  // Unknown category - try to infer
  return parseUnknownMember(text, title, url, $, $member);
}

/**
 * Attempts to parse a member with unknown category type.
 */
function parseUnknownMember(
  text: string,
  title: string,
  url: string,
  $: CheerioAPI,
  $member: Cheerio<Element>
): ParsedMember | null {
  const volumeNumber = extractVolumeNumber(text);
  const chapterNumber = extractChapterNumber(text);

  if (volumeNumber !== null && chapterNumber === null) {
    const coverImage = extractCoverImage($, $member);
    return { type: 'volume', volume: createVolumeEntry(volumeNumber, title, url, coverImage) };
  }

  if (chapterNumber !== null) {
    return { type: 'chapter', chapter: createChapterEntry(chapterNumber, title, url) };
  }

  return null;
}

/**
 * Determines the page type based on extracted data.
 */
function determinePageType(
  volumeCount: number,
  chapterCount: number
): CategoryPageResult['pageType'] {
  if (volumeCount > 0 && chapterCount === 0) return 'volumes';
  if (chapterCount > 0 && volumeCount === 0) return 'chapters';
  return 'mixed';
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parses a category page to extract volume and chapter information.
 * @param html - The HTML content to parse
 * @param baseUrl - Base URL of the wiki for building absolute URLs
 */
export function parseCategoryPage(html: string, baseUrl?: string): CategoryPageResult {
  const $ = cheerio.load(html);
  const volumes: CategoryPageVolume[] = [];
  const chapters: CategoryPageChapter[] = [];

  const $members = $('.category-page__member');

  if ($members.length === 0) {
    logger.debug('[categoryPageParser] No category members found');
    return { success: false, volumes: [], chapters: [], totalFound: 0, pageType: 'mixed' };
  }

  logger.debug(`[categoryPageParser] Found ${$members.length} category members`);

  $members.each((_index, member) => {
    const parsed = parseCategoryMember($, $(member), baseUrl);
    if (!parsed) return;

    if (parsed.type === 'volume' && parsed.volume) {
      volumes.push(parsed.volume);
    } else if (parsed.type === 'chapter' && parsed.chapter) {
      chapters.push(parsed.chapter);
    }
  });

  volumes.sort((a, b) => a.number - b.number);
  chapters.sort((a, b) => a.number - b.number);

  const totalFound = volumes.length + chapters.length;
  const pageType = determinePageType(volumes.length, chapters.length);

  logger.info(`[categoryPageParser] Parsed ${volumes.length} volumes and ${chapters.length} chapters`);

  return { success: totalFound > 0, volumes, chapters, totalFound, pageType };
}

/**
 * Checks if the page title indicates a Volume or Chapter category.
 */
export function detectCategoryType(html: string): 'volumes' | 'chapters' | 'unknown' {
  const $ = cheerio.load(html);
  const pageTitle = $('h1.page-header__title').text().toLowerCase();

  if (pageTitle.includes('volume')) return 'volumes';
  if (pageTitle.includes('chapter')) return 'chapters';

  const canonical = $('link[rel="canonical"]').attr('href') ?? '';
  if (canonical.toLowerCase().includes('volumes')) return 'volumes';
  if (canonical.toLowerCase().includes('chapters')) return 'chapters';

  return 'unknown';
}
