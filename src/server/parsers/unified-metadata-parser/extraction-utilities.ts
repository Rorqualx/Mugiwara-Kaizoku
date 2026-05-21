/**
 * Extraction Utilities
 *
 * Shared utility functions for extracting and cleaning content
 * from HTML documents using Cheerio.
 *
 * Extracted from: UnifiedMetadataParser.ts (lines 113-226)
 */

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';

/**
 * Utility class for extracting and cleaning content from HTML documents
 */
export class ExtractionUtilities {
  /**
   * Clean and normalize image URLs
   * @param url - The URL to clean
   * @returns Cleaned and normalized URL
   */
  static cleanImageUrl(url: string | undefined): string {
    if (!url) return '';

    let cleanedUrl = url;

    // Remove query parameters that affect image size
    cleanedUrl = cleanedUrl.replace(/\/revision\/latest.*/, '');
    cleanedUrl = cleanedUrl.replace(/\/scale-to-width-down\/\d+/, '');
    cleanedUrl = cleanedUrl.replace(/\?cb=\d+/, '');

    // Handle thumbnail URLs
    if (cleanedUrl.includes('/thumb/')) {
      // Extract original from thumbnail URL
      const parts = cleanedUrl.split('/');
      const filename = parts[parts.length - 1];
      if (filename?.match(/^\d+px-/)) {
        parts.pop(); // Remove thumbnail filename
        cleanedUrl = parts.join('/');
      }
    }

    // Ensure HTTPS
    cleanedUrl = cleanedUrl.replace(/^http:/, 'https:');

    // Handle protocol-relative URLs
    if (cleanedUrl.startsWith('//')) {
      cleanedUrl = 'https:' + cleanedUrl;
    }

    return cleanedUrl;
  }

  /**
   * Clean wiki markup and HTML from text
   * @param text - The text to clean
   * @returns Cleaned text
   */
  static cleanText(text: string | undefined): string {
    if (!text) return '';

    return text
      // Remove wiki links [[Link|Text]] -> Text
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      // Remove templates {{template}}
      .replace(/\{\{[^}]+\}\}/g, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove bold/italic markup
      .replace(/'{2,}/g, '')
      // Clean whitespace
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract text from element with fallbacks
   * @param $ - Cheerio API instance
   * @param element - Element to extract from
   * @param selectors - Array of selectors to try in order
   * @returns Extracted and cleaned text
   */
  static extractText($: CheerioAPI, element: AnyNode | Cheerio<AnyNode>, selectors: readonly string[]): string {
    for (const selector of selectors) {
      const text = $(element).find(selector).text().trim();
      if (text) return this.cleanText(text);
    }
    return '';
  }

  /**
   * Extract image URL with multiple fallback attributes
   * @param $ - Cheerio API instance
   * @param element - Element to extract from
   * @param selectors - Array of selectors to try in order
   * @returns Extracted and cleaned image URL
   */
  static extractImageUrl($: CheerioAPI, element: AnyNode | Cheerio<AnyNode>, selectors: readonly string[]): string {
    for (const selector of selectors) {
      const $img = $(element).find(selector).first();
      if ($img.length === 0) continue;

      // Try multiple attributes
      const attrs = ['src', 'data-src', 'data-original', 'data-image-url', 'data-lazy-src'];
      for (const attr of attrs) {
        const url = $img.attr(attr);
        if (url) return this.cleanImageUrl(url);
      }

      // Try parent link
      const parentLink = $img.parent('a').attr('href');
      if (parentLink && /\.(jpg|jpeg|png|gif|webp)/i.test(parentLink)) {
        return this.cleanImageUrl(parentLink);
      }
    }
    return '';
  }

  /**
   * Parse a number from text with fallbacks
   * @param text - The text to parse
   * @returns Parsed number or null if invalid
   */
  static parseNumber(text: string | undefined): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Split text by common separators
   * @param text - The text to split
   * @returns Array of cleaned items
   */
  static splitList(text: string | undefined): string[] {
    if (!text) return [];
    return text
      .split(/[,;、]/)
      .map(item => this.cleanText(item))
      .filter(Boolean);
  }
}
