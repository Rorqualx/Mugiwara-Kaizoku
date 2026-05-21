/**
 * Wiki Metadata Extractor
 *
 * Handles extraction of metadata from wiki pages.
 * Uses PatternLibraryBridge for standardized pattern matching.
 */

import * as cheerio from 'cheerio';

import { normalizeFormat } from '@/server/shared/source-knowledge/normalizers/format-normalizer';
import { logger } from '@/utils/logger';

import { patternLibraryBridge } from '../patterns';
import { extractBestImageUrl, getFullSizeImageUrl } from '../utils/imageUtils';

import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

export interface WikiMetadata {
  title: string;
  alternativeTitles?: string[];
  author?: string;
  artist?: string;
  publisher?: string;
  demographic?: string;
  genres?: string[];
  format?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  coverImage?: string;
  // Dynamic description fields
  descriptions?: {
    [key: string]: string; // e.g., synopsis, plot, summary, background, trivia, etc.
  };
}

export class WikiMetadataExtractor {
  private log = logger.child('WikiMetadataExtractor', { service: 'WikiMetadataExtractor' });

  /**
   * Extract metadata from a wiki page
   */
  extractMetadata(html: string, pageTitle: string): WikiMetadata {
    const $ = cheerio.load(html);
    const metadata: WikiMetadata = {
      title: pageTitle
    };

    // Try to find infobox (portable-infobox or regular infobox)
    let infobox: cheerio.Cheerio<Element> = $('.portable-infobox, .infobox').first() as cheerio.Cheerio<Element>;

    // If no infobox found, look for metadata table (Fire Force wiki style)
    if (infobox.length === 0) {
      infobox = this.findMetadataTable($);
    }

    if (infobox.length > 0) {
      this.extractFromInfobox($, infobox, metadata);
    }

    // Extract alternative titles
    metadata.alternativeTitles = this.extractAlternativeTitles($);

    // Extract all description sections dynamically
    metadata.descriptions = this.extractDescriptionSections($);

    // Also set main description for backwards compatibility
    metadata.description = metadata.descriptions["synopsis"] ??
                          metadata.descriptions["summary"] ??
                          metadata.descriptions["plot"] ??
                          this.extractDescription($);

    return metadata;
  }

  /**
   * Find metadata table if no infobox is present
   */
  private findMetadataTable($: CheerioAPI): cheerio.Cheerio<Element> {
    let foundTable: cheerio.Cheerio<Element> = $() as cheerio.Cheerio<Element>;

    const tables = $('table');
    tables.each((_: number, table: Element) => {
      const $table = $(table) as cheerio.Cheerio<Element>;
      const text = $table.text();
      // Check if this table contains metadata fields
      if (text.includes('Author') || text.includes('Publisher') || text.includes('Demographic')) {
        foundTable = $table;
        return false; // break the loop
      }
    });

    return foundTable;
  }

  /**
   * Extract metadata from infobox
   */
  private extractFromInfobox(
    $: CheerioAPI,
    infobox: cheerio.Cheerio<Element>,
    metadata: WikiMetadata
  ): void {
    // Extract cover image
    const coverImage = this.extractInfoboxImage($, infobox);
    const coverImageUpdate = coverImage !== undefined ? { coverImage } : {};

    // Extract key-value pairs from infobox/table
    const infoData = this.extractInfoboxData($, infobox);

    // Extract metadata using new return-based methods
    const basicMetadata = this.extractBasicMetadata(infoData);
    const formatMetadata = this.extractFormat(infoData);
    const datesStatusMetadata = this.extractDatesAndStatus(infoData);
    const genresMetadata = this.extractGenres(infoData);

    // Merge all updates into metadata
    Object.assign(metadata, coverImageUpdate, basicMetadata, formatMetadata, datesStatusMetadata, genresMetadata);
  }

  /**
   * Extract basic metadata fields
   */
  private extractBasicMetadata(infoData: Record<string, string>): Partial<WikiMetadata> {
    const updates: Partial<WikiMetadata> = {};

    const author = infoData["author"] ?? infoData['written by'] ?? infoData["creator"];
    const artist = infoData["artist"] ?? infoData['illustrated by'];
    const publisher = infoData["publisher"] ?? infoData['published by'];
    const demographic = infoData["demographic"] ?? infoData["genre"];

    if (author !== undefined) updates.author = author;
    if (artist !== undefined) updates.artist = artist;
    if (publisher !== undefined) updates.publisher = publisher;
    if (demographic !== undefined) updates.demographic = demographic;

    return updates;
  }

  /**
   * Extract and normalize format
   */
  private extractFormat(infoData: Record<string, string>): Partial<WikiMetadata> {
    const updates: Partial<WikiMetadata> = {};
    const formatText = infoData["format"] ?? infoData["type"] ?? infoData['media type'] ?? infoData["media"];

    if (formatText) {
      updates.format = this.normalizeFormat(formatText);
    } else {
      // Default to MANGA if not specified
      updates.format = 'MANGA';
    }

    return updates;
  }

  /**
   * Normalize format to standard values.
   * Delegates to shared normalizer.
   */
  private normalizeFormat(formatText: string): string {
    return normalizeFormat(formatText);
  }

  /**
   * Extract dates and publication status using PatternLibraryBridge
   */
  private extractDatesAndStatus(infoData: Record<string, string>): Partial<WikiMetadata> {
    const updates: Partial<WikiMetadata> = {};
    const originalRun = infoData['original run'] ?? infoData["published"] ?? infoData['first released'];

    if (originalRun) {
      // Use PatternLibraryBridge for date extraction
      const dateResult = patternLibraryBridge.extractDate(originalRun);
      if (dateResult) {
        updates.startDate = dateResult.date;
      }

      // Try to parse date range format: "Month DD, YYYY – Month DD, YYYY" or "Month DD, YYYY – present"
      const dateMatch = originalRun.match(/(\w+\s+\d{1,2},?\s+\d{4})\s*[-–—]\s*(\w+\s+\d{1,2},?\s+\d{4}|present|ongoing)?/i);

      if (dateMatch?.[1]) {
        updates.startDate = dateMatch[1];
        if (dateMatch[2] && !['present', 'ongoing'].includes(dateMatch[2].toLowerCase())) {
          updates.endDate = dateMatch[2];
          updates.status = 'COMPLETED';
        } else {
          // Use PatternLibraryBridge for status extraction from infoData
          const statusText = infoData["status"] ?? originalRun;
          const normalizedStatus = patternLibraryBridge.extractStatus(statusText);
          updates.status = normalizedStatus ?? 'ONGOING';
        }
      } else {
        // Fallback: use date result and extract status
        if (!updates.startDate) {
          updates.startDate = originalRun;
        }
        const statusText = infoData["status"];
        if (statusText !== undefined) {
          const normalizedStatus = patternLibraryBridge.extractStatus(statusText);
          updates.status = normalizedStatus ?? statusText;
        }
      }
    } else {
      // No original run date, just extract status
      const statusText = infoData["status"];
      if (statusText !== undefined) {
        const normalizedStatus = patternLibraryBridge.extractStatus(statusText);
        updates.status = normalizedStatus ?? statusText;
      }
    }

    return updates;
  }

  /**
   * Extract genres using PatternLibraryBridge as fallback
   */
  private extractGenres(infoData: Record<string, string>): Partial<WikiMetadata> {
    const updates: Partial<WikiMetadata> = {};
    const genresText = infoData["genres"] ?? infoData["genre"];

    if (genresText) {
      // First try splitting by comma/semicolon
      const splitGenres = genresText.split(/[,;]/).map((g: string) => g.trim()).filter(Boolean);

      if (splitGenres.length > 0) {
        updates.genres = splitGenres;
      } else {
        // Fallback: use PatternLibraryBridge to extract genres from text
        const extractedGenres = patternLibraryBridge.extractGenres(genresText);
        if (extractedGenres.length > 0) {
          updates.genres = extractedGenres;
        }
      }
    }
    return updates;
  }

  /**
   * Extract cover image from infobox
   */
  private extractInfoboxImage($: CheerioAPI, infobox: cheerio.Cheerio<Element>): string | undefined {
    const img = infobox.find('img').first();
    return this.extractImageUrl(img);
  }

  /**
   * Extract image URL from cheerio element
   */
  private extractImageUrl(img: cheerio.Cheerio<Element>): string | undefined {
    if (!img.length) return undefined;

    // Use the enhanced image extraction utilities
    const imgUrl = extractBestImageUrl(img);
    if (imgUrl) {
      return getFullSizeImageUrl(imgUrl);
    }

    return undefined;
  }

  /**
   * Extract key-value data from infobox
   */
  private extractInfoboxData($: CheerioAPI, infobox: cheerio.Cheerio<Element>): Record<string, string> {
    const data: Record<string, string> = {};

    // Format 1: Portable infobox with pi-data
    this.extractPortableInfoboxData($, infobox, data);

    // Format 2: <h3> label with <div> value
    this.extractH3LabelData($, infobox, data);

    // Format 3: <tr> with <th> and <td>
    this.extractTableRowData($, infobox, data);

    return data;
  }

  /**
   * Extract data from portable infobox format
   */
  private extractPortableInfoboxData(
    $: CheerioAPI,
    infobox: cheerio.Cheerio<Element>,
    data: Record<string, string>
  ): void {
    const updates: Record<string, string> = {};

    infobox.find('.pi-data, .pi-item').each((_: number, item: Element) => {
      const $item = $(item);
      const label = $item.find('.pi-data-label, .pi-label').text().trim();
      const value = $item.find('.pi-data-value, .pi-value').text().trim();

      if (label && value) {
        // Store both original and lowercase versions
        updates[label] = value;
        updates[label.toLowerCase()] = value;

        // Handle specific fields
        const specialFields = this.mapSpecialFields(label, value);
        Object.assign(updates, specialFields);
      }
    });

    // Merge updates into data (single mutation point)
    Object.assign(data, updates);
  }

  /**
   * Map special field names to standard keys
   * Uses PatternLibraryBridge for enhanced pattern matching
   */
  private mapSpecialFields(label: string, value: string): Record<string, string> {
    const labelLower = label.toLowerCase();
    const specialFields: Record<string, string> = {};

    if (labelLower.includes('author') || labelLower.includes('written')) {
      specialFields["author"] = value;
    }
    if (labelLower.includes('genre')) {
      specialFields["genres"] = value;
    }
    if (labelLower.includes('volume')) {
      // Use PatternLibraryBridge to extract volume number if present
      const volumeResult = patternLibraryBridge.extractVolumeNumber(value);
      if (volumeResult) {
        specialFields["volumes"] = String(volumeResult.volumeNumber);
      } else {
        specialFields["volumes"] = value;
      }
    }
    if (labelLower.includes('chapter')) {
      // Use PatternLibraryBridge to extract chapter number if present
      const chapterResult = patternLibraryBridge.extractChapterNumber(value);
      if (chapterResult) {
        specialFields["chapters"] = String(chapterResult.chapterNumber);
      } else {
        specialFields["chapters"] = value;
      }
    }
    if (labelLower.includes('original run') || labelLower.includes('published')) {
      specialFields['original run'] = value;
    }
    if (labelLower.includes('status')) {
      // Use PatternLibraryBridge for normalized status extraction
      const normalizedStatus = patternLibraryBridge.extractStatus(value);
      specialFields["status"] = normalizedStatus ?? value;
    }

    return specialFields;
  }

  /**
   * Extract data from h3 label format
   */
  private extractH3LabelData(
    $: CheerioAPI,
    infobox: cheerio.Cheerio<Element>,
    data: Record<string, string>
  ): void {
    const updates: Record<string, string> = {};

    infobox.find('h3.pi-data-label').each((_: number, label: Element) => {
      const $label = $(label);
      const key = $label.text().trim();
      const value = $label.next('.pi-data-value').text().trim();
      if (key && value) {
        updates[key] = value;
        updates[key.toLowerCase()] = value;
      }
    });

    Object.assign(data, updates);
  }

  /**
   * Extract data from table row format
   */
  private extractTableRowData(
    $: CheerioAPI,
    infobox: cheerio.Cheerio<Element>,
    data: Record<string, string>
  ): void {
    const updates: Record<string, string> = {};

    infobox.find('tr').each((_: number, row: Element) => {
      const $row = $(row);
      let key = $row.find('th').text().trim();
      let value = $row.find('td').text().trim();

      // For Fire Force wiki style: <td><b>Author</b></td><td>Value</td>
      if (!key && $row.find('td').length >= 2) {
        const cells = $row.find('td');
        const firstCell = cells.eq(0);
        const secondCell = cells.eq(1);

        // Check if first cell has a bold label
        const boldLabel = firstCell.find('b').text().trim();
        if (boldLabel) {
          key = boldLabel;
          value = secondCell.text().trim();
        }
      }

      if (key && value) {
        updates[key] = value;
        updates[key.toLowerCase()] = value;
      }
    });

    Object.assign(data, updates);
  }

  /**
   * Extract alternative titles
   */
  private extractAlternativeTitles($: CheerioAPI): string[] {
    const titles: string[] = [];

    // For portable infoboxes with data-source attributes
    const portableSelectors = [
      '.pi-item[data-source="romaji"] .pi-data-value',
      '.pi-item[data-source="kanji"] .pi-data-value',
      '.pi-item[data-source="english"] .pi-data-value',
      '.pi-item[data-source="japanese"] .pi-data-value'
    ];

    for (const selector of portableSelectors) {
      ($(selector) as cheerio.Cheerio<Element>).each((_: number, el: Element) => {
        const title = $(el).text().trim();
        if (title && !titles.includes(title) && !['Romaji', 'Kanji', 'English', 'Japanese'].includes(title)) {
          titles.push(title);
        }
      });
    }

    // For table-based infoboxes (Fire Force style)
    const tableTitles = this.extractTitleFromTable($);
    for (const title of tableTitles) {
      if (!titles.includes(title)) {
        titles.push(title);
      }
    }

    return titles;
  }

  /**
   * Extract alternative titles from table format
   */
  private extractTitleFromTable($: CheerioAPI): string[] {
    const newTitles: string[] = [];

    $('tr').each((_: number, row: Element) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length >= 2) {
        const firstCell = cells.eq(0);
        const secondCell = cells.eq(1);

        // Check if first cell contains a label like "Romaji", "English", etc.
        const label = firstCell.text().trim();
        const value = secondCell.text().trim();

        if (['Romaji', 'English', 'Japanese', 'Kanji'].some(l => label.includes(l))) {
          if (value && !['Romaji', 'Kanji', 'English', 'Japanese'].includes(value)) {
            newTitles.push(value);
          }
        }
      }
    });

    return newTitles;
  }

  /**
   * Extract main description
   */
  private extractDescription($: CheerioAPI): string {
    // Try to find synopsis/description
    const selectors = [
      '#Synopsis', '#Plot', '#Summary',
      'h2:contains("Synopsis") + p',
      'h2:contains("Plot") + p',
      'h2:contains("Summary") + p',
      '.mw-parser-output > p:first'
    ];

    for (const selector of selectors) {
      const desc = $(selector).first();
      if (desc.length && desc.text().length > 50) {
        return desc.text().trim();
      }
    }

    // Fallback: get first substantial paragraph
    const firstPara = $('.mw-parser-output p').filter((_, p) =>
      $(p).text().length > 100
    ).first();

    return firstPara.text().trim() || '';
  }

  /**
   * Extract all description sections dynamically
   */
  private extractDescriptionSections($: CheerioAPI): Record<string, string> {
    const sections: Record<string, string> = {};

    // Common section headers to look for
    const sectionHeaders = [
      'Synopsis', 'Plot', 'Summary', 'Story', 'Background',
      'History', 'Reception', 'Trivia', 'Notes', 'Overview',
      'Description', 'Production', 'Development', 'Premise',
      'Setting', 'Themes', 'Publication', 'Serialization'
    ];

    // Find all h2 and h3 headers
    $('h2, h3').each((_: number, heading: Element) => {
      const $heading = $(heading);
      const headingText = $heading.find('.mw-headline').text().trim() ||
                         $heading.text().trim();

      // Check if this is one of our target sections
      const matchedSection = sectionHeaders.find(section =>
        new RegExp(section, 'i').test(headingText)
      );

      if (matchedSection ?? headingText) {
        const sectionKey = matchedSection ?
          matchedSection.toLowerCase() :
          headingText.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // Get content until next heading
        const content = this.extractSectionContent($, $heading);

        // Only add if we found substantial content
        if (content.trim().length > 50) {
          sections[sectionKey] = content.trim();
        }
      }
    });

    // Also try to extract from elements with specific IDs
    this.extractFromIdSelectors($, sections);

    return sections;
  }

  /**
   * Extract content from a section
   */
  private extractSectionContent($: CheerioAPI, $heading: cheerio.Cheerio<Element>): string {
    let content = '';
    let $current = $heading.next();

    while ($current.length && !$current.is('h1, h2, h3')) {
      // Skip navigation boxes, galleries, and other non-content elements
      if (!$current.hasClass('navbox') &&
          !$current.hasClass('gallery') &&
          !$current.hasClass('toc') &&
          !$current.is('table.infobox')) {

        const text = $current.text().trim();
        if (text && text.length > 10) {
          content += text + '\n\n';
        }
      }
      $current = $current.next();
    }

    return content;
  }

  /**
   * Extract descriptions from elements with specific IDs
   */
  private extractFromIdSelectors($: CheerioAPI, sections: Record<string, string>): void {
    const idSelectors = [
      '#Synopsis', '#Plot', '#Summary', '#Story', '#Background',
      '#History', '#Reception', '#Trivia', '#Overview'
    ];

    for (const selector of idSelectors) {
      const $section = $(selector);
      if ($section.length) {
        const sectionKey = selector.substring(1).toLowerCase();

        // Get the parent container and extract text
        let content = '';
        let $current = $section.parent().next();

        while ($current.length && !$current.is('h1, h2, h3')) {
          const text = $current.text().trim();
          if (text && text.length > 10) {
            content += text + '\n\n';
          }
          $current = $current.next();
        }

        if (content.trim().length > 50 && !sections[sectionKey]) {
          const trimmedContent = content.trim();
          Object.assign(sections, { [sectionKey]: trimmedContent });
        }
      }
    }
  }
}
