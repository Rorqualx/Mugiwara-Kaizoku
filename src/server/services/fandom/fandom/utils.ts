/**
 * Fandom Service Utilities
 * Shared helper functions for parsing and processing wiki content.
 */

import { logger } from '@/utils/logger';

const log = logger.child('FandomUtils');

/**
 * Clean wikitext by removing markup (links, bold, templates, refs, HTML)
 */
export function cleanWikitext(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2') // [[Link|Text]] -> Text
    .replace(/\[\[([^\]]+)\]\]/g, '$1')            // [[Link]] -> Link
    .replace(/'''([^']+)'''/g, '$1')               // '''bold''' -> bold
    .replace(/''([^']+)''/g, '$1')                 // ''italic'' -> italic
    .replace(/{{[^}]+}}/g, '')                     // Remove templates
    .replace(/<ref[^>]*>.*?<\/ref>/g, '')          // Remove references
    .replace(/<[^>]+>/g, '')                       // Remove HTML tags
    .replace(/\n{3,}/g, '\n\n')                    // Normalize line breaks
    .trim();
}

/**
 * Parse date range string like "September 23, 2015 - February 22, 2022"
 * Handles different dash types (-, en-dash, em-dash)
 */
export function parseDateRange(dateString: string): { start: string; end: string } | null {
  if (!dateString) return null;

  const parts = dateString.split(/[-–—]/); // Handle different dash types

  if (parts.length >= 2 && parts[0] && parts[1]) {
    return {
      start: formatDateString(parts[0].trim()),
      end: formatDateString(parts[1].trim())
    };
  } else if (parts.length === 1 && parts[0]) {
    return {
      start: formatDateString(parts[0].trim()),
      end: 'present'
    };
  }
  return null;
}

/**
 * Format date string to YYYY-MM-DD format
 * Handles special terms like 'present', 'ongoing', 'current'
 */
export function formatDateString(dateStr: string): string {
  // Return as-is for special terms
  if (['present', 'ongoing', 'current'].some(term => dateStr.toLowerCase().includes(term))) {
    return dateStr;
  }

  // Handle year-only dates (e.g., "2015")
  const yearOnlyMatch = dateStr.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return `${yearOnlyMatch[1]}-01-01`;
  }

  // Try to parse the date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const parts = date.toISOString().split('T');
    return parts[0] ?? dateStr;
  }
  return dateStr;
}

/**
 * Process image URL to get the best quality direct image URL
 * Handles multiple URL formats from Fandom wikis
 */
export function processImageUrl(imageValue: string, wikiSubdomain: string): string {
  if (imageValue.startsWith('https://') && imageValue.includes('/wiki/File:')) {
    const fileName = imageValue.split('/wiki/File:')[1];
    return fileName
      ? `https://${wikiSubdomain}.fandom.com/wiki/Special:FilePath/${fileName}`
      : imageValue;
  } else if (imageValue.startsWith('File:')) {
    const fileName = imageValue.replace('File:', '');
    return `https://${wikiSubdomain}.fandom.com/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
  } else if (imageValue.startsWith('http')) {
    return imageValue;
  } else {
    return `https://${wikiSubdomain}.fandom.com/wiki/Special:FilePath/${encodeURIComponent(imageValue)}`;
  }
}

/**
 * Check if a manga has Chapter 0 by searching wiki content
 */
export function hasChapterZeroInContent(wikitext?: string): boolean {
  if (!wikitext) return false;

  const chapterZeroPatterns = [
    /Chapter\s+0(?:\s|:|\]|\)|,|$)/i,
    /Chapter\s+Zero/i,
    /Prologue.*Chapter\s+0/i,
    /\[\[Chapter\s+0[\]|]/i,
    /\[\[.*Chapter\s+0.*\]\]/i,
    /^\s*0\.\s+/m,
    /Chapter\s+0\s*[-–—:]/i,
    /\|\s*0\s*\|/i,
    /Chapter\s+0\s*\([^)]+\)/i,
    /^Prologue(?:\s|:|$)/im,
    /\[\[Prologue\]\]/i
  ];

  for (const pattern of chapterZeroPatterns) {
    if (pattern.test(wikitext)) {
      log.info('Found Chapter 0 reference in wikitext using pattern:', pattern.source);
      return true;
    }
  }

  // Check if there's a list of chapters that starts with 0
  const chapterListMatch = wikitext.match(/Chapters?\s*[:=]?\s*([\d,\s-]+)/i);
  if (chapterListMatch?.[1]) {
    const numbers = chapterListMatch[1].match(/\d+/g);
    if (numbers?.[0] === '0') {
      log.info('Found Chapter 0 as first chapter in list');
      return true;
    }
  }

  // Check for chapter list pages referenced in content
  if (wikitext.includes('[[List of Chapters]]') || wikitext.includes('[[Chapter 0]]')) {
    log.info('Found reference to Chapter 0 or chapter list in content');
    return true;
  }

  return false;
}
