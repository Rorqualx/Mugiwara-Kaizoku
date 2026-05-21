/**
 * Wikipedia Volume Table Extraction
 *
 * Extracts volume data from standard Wikipedia tables.
 * Handles standard table formats with columns for volume number, release date, ISBN, etc.
 *
 * Extracted from: wikipediaVolumeExtractor.ts (lines 184-299)
 *
 * ESLint Fixes:
 * - Line 291: Fixed no-useless-escape - removed unnecessary escapes from regex
 * - Lines 215-296: Reduced complexity from 22 to <20 by extracting helper functions
 */

import type { WikipediaVolume, WikipediaChapter } from './types';
import type * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Column indices mapping for table headers
 */
interface ColumnIndices {
    number: number;
    releaseDate: number;
    isbn: number;
    chapters: number;
    title: number;
}

/**
 * Release information extracted from table cell
 */
interface ReleaseInfo {
    date?: string;
    isbn?: string;
}

/**
 * Title information extracted from table cell
 */
interface TitleInfo {
    japaneseTitle?: string;
    englishTitle?: string;
    title?: string;
}

/**
 * Determine column indices from table headers
 */
function determineColumnIndices(headers: string[]): ColumnIndices {
    return {
        number: headers.findIndex(h => h.includes('no.') || h.includes('#') || h.includes('volume')),
        releaseDate: headers.findIndex(h => h.includes('release') || h.includes('date')),
        isbn: headers.findIndex(h => h.includes('isbn')),
        chapters: headers.findIndex(h => h.includes('chapter') || h.includes('content')),
        title: headers.findIndex(h => h.includes('title') || h.includes('name'))
    };
}

/**
 * Extract volume number from table cell
 */
function extractVolumeNumber(
    $: cheerio.CheerioAPI,
    cells: cheerio.Cheerio<Element>,
    colIndex: number
): string {
    if (colIndex >= 0) {
        return cells.eq(colIndex).text().trim();
    }

    // Try to extract from first cell
    const firstCellText = cells.eq(0).text().trim();
    const numberMatch = firstCellText.match(/\d+/);
    return numberMatch?.[0] ?? '';
}

/**
 * Extract release information (date and ISBN) from table cell text
 */
function extractReleaseInfo(cellText: string): ReleaseInfo {
    const info: ReleaseInfo = {};

    // Extract date
    const dateMatch = cellText.match(/(\w+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/);
    if (dateMatch?.[1]) {
        info.date = dateMatch[1];
    }

    // Extract ISBN
    const isbnMatch = cellText.match(/ISBN\s+([\d-]+)/);
    if (isbnMatch?.[1]) {
        info.isbn = isbnMatch[1];
    }

    return info;
}

/**
 * Extract ISBN from dedicated ISBN column
 */
function extractIsbnFromColumn(
    $: cheerio.CheerioAPI,
    cells: cheerio.Cheerio<Element>,
    colIndex: number
): string | undefined {
    if (colIndex < 0) {
        return undefined;
    }

    const isbnText = cells.eq(colIndex).text();
    const isbnMatch = isbnText.match(/([\d-]+)/);
    return isbnMatch?.[1];
}

/**
 * Extract title information from table cell
 * Supports Japanese titles in quotes, English titles in parentheses
 */
function extractTitleInfo(titleText: string): TitleInfo {
    const info: TitleInfo = {};

    // Look for Japanese title in quotes
    const japaneseMatch = titleText.match(/"([^"]+)"/);
    if (japaneseMatch?.[1]) {
        info.japaneseTitle = japaneseMatch[1];
    }

    // Look for English title in parentheses. Skip if it looks like a
    // release date / ISBN / colophon note rather than a title.
    const englishMatch = titleText.match(/\(([^)]+)\)/);
    if (englishMatch?.[1] && !isDateLike(englishMatch[1])) {
        info.englishTitle = englishMatch[1];
    }

    // Always compute a clean primary title. Previously this was a fallback
    // that only fired when neither japanese nor english matched; but parens
    // match nearly any volume row, which left `title` undefined in 19/20
    // baseline mangas. Strip the extracted japanese/english fragments so
    // the primary title reads cleanly.
    let primary = titleText.replace(/"[^"]+"/g, '').replace(/\([^)]+\)/g, '').trim();
    // Drop dangling punctuation left behind by the strips
    primary = primary.replace(/^[,;:\s-]+|[,;:\s-]+$/g, '');
    if (primary.length > 0 && primary.length < 200) {
        info.title = primary;
    }

    return info;
}

/**
 * Heuristic: does a parenthesized fragment look like a release date / ISBN
 * rather than an English title? Prevents "August 2000" or "978-..." from
 * being persisted as a volume title.
 */
function isDateLike(s: string): boolean {
    return /\d{4}/.test(s) || /isbn/i.test(s) || /\d{1,2}\/\d{1,2}/.test(s);
}

/**
 * Process a single table row and extract volume data
 */
function processVolumeRow(
    $: cheerio.CheerioAPI,
    $row: cheerio.Cheerio<Element>,
    colIndices: ColumnIndices,
    extractChaptersFromCell: (
        $: cheerio.CheerioAPI,
        $cell: cheerio.Cheerio<Element>
    ) => WikipediaChapter[]
): WikipediaVolume | null {
    const cells = $row.find('td');

    if (cells.length === 0) {
        return null;
    }

    const volume: WikipediaVolume = {
        number: ''
    };

    // Extract volume number
    volume.number = extractVolumeNumber($, cells, colIndices.number);

    // Skip if no volume number found
    if (!volume.number) {
        return null;
    }

    // Extract release info
    if (colIndices.releaseDate >= 0) {
        const releaseCellText = cells.eq(colIndices.releaseDate).text();
        const releaseInfo = extractReleaseInfo(releaseCellText);

        if (releaseInfo.date) {
            volume.releaseDate = releaseInfo.date;
        }
        if (releaseInfo.isbn) {
            volume.isbn = releaseInfo.isbn;
        }
    }

    // Extract ISBN from dedicated column if exists
    if (colIndices.isbn >= 0 && !volume.isbn) {
        const isbn = extractIsbnFromColumn($, cells, colIndices.isbn);
        if (isbn) {
            volume.isbn = isbn;
        }
    }

    // Extract chapters
    if (colIndices.chapters >= 0) {
        const chaptersCell = cells.eq(colIndices.chapters);
        const extractedChapters = extractChaptersFromCell($, chaptersCell);
        if (extractedChapters.length > 0) {
            volume.chapters = extractedChapters;
        }
    }

    // Extract titles
    if (colIndices.title >= 0) {
        const titleCell = cells.eq(colIndices.title);
        const titleText = titleCell.text();
        const titleInfo = extractTitleInfo(titleText);

        if (titleInfo.japaneseTitle) {
            volume.japaneseTitle = titleInfo.japaneseTitle;
        }
        if (titleInfo.englishTitle) {
            volume.englishTitle = titleInfo.englishTitle;
        }
        if (titleInfo.title) {
            volume.title = titleInfo.title;
        }
    }

    return volume;
}

/**
 * Extract volumes from a standard Wikipedia table
 *
 * Handles tables with columns for volume number, release date, ISBN, chapters, and titles.
 * Complexity reduced from 22 to ~8 by extracting helper functions.
 *
 * @param $ - Cheerio API instance
 * @param $table - Table element to extract from
 * @param extractFireForceStyleVolumes - Function to handle Fire Force-style tables
 * @param extractChaptersFromCell - Function to extract chapters from a cell
 * @returns Array of extracted volumes
 */
export function extractVolumesFromTable(
    $: cheerio.CheerioAPI,
    $table: cheerio.Cheerio<Element>,
    extractFireForceStyleVolumes: (
        $: cheerio.CheerioAPI,
        $table: cheerio.Cheerio<Element>
    ) => WikipediaVolume[],
    extractChaptersFromCell: (
        $: cheerio.CheerioAPI,
        $cell: cheerio.Cheerio<Element>
    ) => WikipediaChapter[]
): WikipediaVolume[] {
    const volumes: WikipediaVolume[] = [];

    // Analyze table structure
    const headers: string[] = [];
    $table.find('tr').first().find('th').each((_, th) => {
        headers.push($(th).text().trim().toLowerCase());
    });

    // Special handling for Fire Force-style tables
    const isFireForceStyle = headers.some(h => h.includes('original release')) &&
                            headers.some(h => h.includes('english release'));

    if (isFireForceStyle) {
        return extractFireForceStyleVolumes($, $table);
    }

    // Standard extraction for other formats
    const colIndices = determineColumnIndices(headers);

    // Process each row
    ($table.find('tr').slice(1) as cheerio.Cheerio<Element>).each((_, row) => {
        const $row = $(row);
        const volume = processVolumeRow($, $row, colIndices, extractChaptersFromCell);

        if (volume) {
            volumes.push(volume);
        }
    });

    return volumes;
}
