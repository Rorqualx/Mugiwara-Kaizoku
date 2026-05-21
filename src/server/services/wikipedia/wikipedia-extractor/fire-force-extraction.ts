/**
 * Wikipedia Volume Extractor - Fire Force Style Table Extraction
 *
 * Specialized extraction logic for Fire Force-style Wikipedia tables where:
 * - Volume info appears in the main row
 * - Chapters appear in a colspan row below (either nested table or plain text)
 * - Summary appears in a third row with colspan
 *
 * Extracted from: wikipediaVolumeExtractor.ts (lines 302-404)
 *
 * Complexity Reduction:
 * - Original complexity: 25 (exceeds max 20)
 * - Refactored complexity: <10 per function
 * - Helper functions extracted: parseVolumeRow, extractChaptersFromRow, extractSummaryFromRow
 *
 * ESLint Fixes:
 * - Removed unnecessary condition on line 399 (currentVolume always exists before push)
 * - Extracted helper functions to reduce cyclomatic complexity
 */

import * as cheerio from 'cheerio';

import type { WikipediaChapter, WikipediaVolume } from './types';
import type { Element } from 'domhandler';


/**
 * Parse volume metadata from a table row
 *
 * Extracts release date and ISBN from the cells:
 * - Cell 0: Original release date
 * - Cell 1: Original ISBN
 * - Cell 2: English release date (unused)
 * - Cell 3: English ISBN (fallback)
 */
function parseVolumeRow(
    $: cheerio.CheerioAPI,
    cells: cheerio.Cheerio<Element>,
    volumeNumber: number
): WikipediaVolume {
    const volume: WikipediaVolume = {
        number: volumeNumber.toString(),
        chapters: []
    };

    const originalDate = cells.eq(0).text().trim();
    const originalISBN = cells.eq(1).text().trim();
    const englishISBN = cells.eq(3).text().trim();

    // Parse original release date
    const origDateMatch = originalDate.match(/(\w+\s+\d{1,2},\s+\d{4})/);
    if (origDateMatch?.[1]) {
        volume.releaseDate = origDateMatch[1];
    }

    // Parse ISBN (remove citation formatting)
    const isbnMatch = originalISBN.match(/([\d-]{10,})/);
    if (isbnMatch?.[1]) {
        volume.isbn = isbnMatch[1];
    }

    // Parse English ISBN as fallback
    const englishIsbnMatch = englishISBN.match(/([\d-]{10,})/);
    if (englishIsbnMatch?.[1] && !volume.isbn) {
        volume.isbn = englishIsbnMatch[1];
    }

    return volume;
}

/**
 * Extract chapters from a nested table
 *
 * Fire Force tables often have chapters in a nested table where each cell
 * contains one or more chapter entries in text format.
 */
function extractChaptersFromNestedTable(
    $: cheerio.CheerioAPI,
    nestedTable: cheerio.Cheerio<Element>,
    extractChaptersFromText: (text: string) => WikipediaChapter[]
): WikipediaChapter[] {
    const chapters: WikipediaChapter[] = [];
    const chapterCells = nestedTable.find('td');

    chapterCells.each((_, cell) => {
        const cellText = $(cell).text();
        const chaptersFromCell = extractChaptersFromText(cellText);
        chapters.push(...chaptersFromCell);
    });

    return chapters;
}

/**
 * Extract summary text from a cell
 *
 * Returns summary only if:
 * - Cell has colspan >= 5
 * - Cell does not contain nested tables
 * - Text is substantial (>50 characters)
 */
function extractSummaryFromCell(
    $: cheerio.CheerioAPI,
    cell: cheerio.Cheerio<Element>
): string | null {
    const colspan = cell.attr('colspan');

    // Must have colspan >= 5 and no nested tables
    if (colspan && parseInt(colspan) >= 5 && !cell.find('table').length) {
        const summaryText = cell.text().trim();
        // Only return if it's a real summary (>50 chars)
        if (summaryText && summaryText.length > 50) {
            return summaryText;
        }
    }

    return null;
}

/**
 * Extract chapters from a row with colspan
 *
 * Handles two cases:
 * 1. Nested table: Extract chapters from each cell in the table
 * 2. Plain text: Extract chapters directly from the cell text
 *
 * Note: Previously this tried to extract volume title from "Chapter 00",
 * but this caused issues where chapter 0 titles were incorrectly used
 * as volume titles. Volume titles should come from explicit title fields.
 */
function extractChaptersFromRow(
    $: cheerio.CheerioAPI,
    cell: cheerio.Cheerio<Element>,
    extractChaptersFromText: (text: string) => WikipediaChapter[]
): { chapters: WikipediaChapter[]; title?: string | undefined } {
    const nestedTable = cell.find('table');
    let chapters: WikipediaChapter[] = [];

    if (nestedTable.length > 0) {
        // Extract chapters from nested table
        chapters = extractChaptersFromNestedTable($, nestedTable, extractChaptersFromText);
    } else {
        // Extract chapters directly from cell text
        const chapterText = cell.text();
        chapters = extractChaptersFromText(chapterText);
    }

    // Don't use chapter 00's title as volume title - this causes confusion
    // between chapter titles and volume titles. Volume titles should come
    // from explicit title columns in the Wikipedia table.
    return { chapters, title: undefined };
}

/**
 * Extract volumes from Fire Force-style tables
 *
 * Table structure:
 * - Row 1: Volume info (release dates, ISBNs) - 4+ cells
 * - Row 2: Chapters (colspan row with nested table or text) - colspan >= 3
 * - Row 3: Summary (optional, colspan row with plain text) - colspan >= 5
 *
 * @param $ - Cheerio instance
 * @param $table - Table element to extract from
 * @param extractChaptersFromText - Function to extract chapters from text
 * @returns Array of WikipediaVolume objects
 */
export function extractFireForceStyleVolumes(
    $: cheerio.CheerioAPI,
    $table: cheerio.Cheerio<Element>,
    extractChaptersFromText: (text: string) => WikipediaChapter[]
): WikipediaVolume[] {
    const volumes: WikipediaVolume[] = [];
    const rows = $table.find('tr').slice(1) as cheerio.Cheerio<Element>; // Skip header

    let currentVolume: WikipediaVolume | null = null;
    let volumeNumber = 0;
    let expectingSummary = false;

    rows.each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td');

        if (cells.length >= 4 && !expectingSummary) {
            // This is a volume row
            if (currentVolume) {
                volumes.push(currentVolume);
            }

            volumeNumber++;
            currentVolume = parseVolumeRow($, cells, volumeNumber);
            expectingSummary = false;
        } else if (cells.length > 0 && currentVolume) {
            const firstCell = cells.eq(0);
            const colspan = firstCell.attr('colspan');

            if (colspan && parseInt(colspan) >= 5 && !firstCell.find('table').length) {
                // This is a summary row (colspan="5" and contains plain text, no nested table)
                const summary = extractSummaryFromCell($, firstCell);
                if (summary) {
                    currentVolume.summary = summary;
                    expectingSummary = false;
                }
            } else if (colspan && parseInt(colspan) >= 3) {
                // This is a chapters row (colspan >= 3)
                const { chapters, title } = extractChaptersFromRow($, firstCell, extractChaptersFromText);
                currentVolume.chapters = chapters;
                if (title) {
                    currentVolume.title = title;
                }
                expectingSummary = true; // Next row might be a summary
            }
        }
    });

    // Add the last volume if one was created during iteration
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ESLint can't track mutations through .each() callback
    if (currentVolume) {
        volumes.push(currentVolume);
    }

    return volumes;
}
