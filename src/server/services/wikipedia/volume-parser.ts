// @file-size-justified: Cohesive Wikipedia parsing with multiple table format handlers - splitting reduces discoverability
/* eslint-disable max-lines */
/**
 * Wikipedia Volume Parser Module
 *
 * HTML parsing for volume extraction from Wikipedia pages.
 * Handles multiple table formats and chapter extraction patterns.
 */

import * as cheerio from 'cheerio';

import {
    extractDateString,
    extractAllISBNs,
    containsWikipediaArtifacts,
    isChapterListText,
    filterToMainSeriesContent,
} from '@/server/services/shared/parsing-utils';
import { DEFAULT_PARSER_CONFIG } from '@/server/services/wikipedia/parser-config';
import { logger } from '@/utils/logger';

// Use configurable values
const { chapters: chapterConfig } = DEFAULT_PARSER_CONFIG;

/**
 * Chapter information extracted from Wikipedia
 */
export interface WikipediaChapter {
    number: string | number;
    title?: string;
    volumeNumber?: number;
    releaseDate?: string;
    pages?: number;
}

/**
 * Volume information from Wikipedia
 */
export interface WikipediaVolume {
    number: number;
    title?: string;
    alternativeTitles?: string[];
    chapters: WikipediaChapter[];
    originalReleaseDate?: string;
    englishReleaseDate?: string;
    isbn?: string;
    isbn13?: string;
    chapterRange?: string;
    description?: string;
    summary?: string;
}

/**
 * Strip HTML tags from text
 *
 * @param html - HTML string
 * @returns Plain text
 */
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Clean chapter title by removing common artifacts
 *
 * @param title - Raw chapter title
 * @returns Cleaned title
 */
function cleanChapterTitle(title: string): string {
    return title
        .replace(/^["''""]|["''""]$/g, '') // Remove surrounding quotes
        .replace(/\s*\([^)]*\)$/g, '') // Remove trailing parenthetical (Japanese text)
        .replace(/^Chapter\s+\d+:\s*/i, '') // Remove "Chapter N:" prefix
        .replace(/^Episode\s+\d+:\s*/i, '') // Remove "Episode N:" prefix
        .replace(/^Part\s+\d+:\s*/i, '') // Remove "Part N:" prefix
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/Japanese-language text/gi, '') // Remove placeholder text
        .replace(/^(ja|en|jp|ko|zh)$/i, '') // Remove language codes
        .trim();
}

/**
 * Parse volume table from HTML
 *
 * Uses shared utilities for date and ISBN extraction.
 *
 * @param html - HTML content containing volume table
 * @returns Array of volumes
 */
export function parseVolumeTable(html: string): WikipediaVolume[] {
    const volumes: WikipediaVolume[] = [];
    // Find all volume rows in tables
    // Pattern for volume number in first column
    const volumeRowPattern = /<tr[^>]*>.*?<t[hd][^>]*>(\d+)<\/t[hd]>.*?<\/tr>/gs;
    const volumeRows = [...html.matchAll(volumeRowPattern)];
    logger.info(`[WIKIPEDIA] Found ${volumeRows.length} potential volume rows`);
    volumeRows.forEach((rowMatch) => {
        const row = rowMatch[0];
        const volNum = rowMatch[1];
        if (!volNum)
            return;
        const volumeNumber = parseInt(volNum, 10);
        // Extract title (usually in second column)
        const titleMatch = row.match(/<td[^>]*>.*?<i>([^<]+)<\/i>/);
        // Extract alternative titles (Japanese title, romanization)
        const altTitleMatch = row.match(/<i>([^<]+)<\/i>.*?\(([^)]+)\)/);

        // Extract dates using shared utility
        const datePattern = /(\w+\s+\d+,\s+\d{4})/g;
        const dateMatches = [...row.matchAll(datePattern)];
        const dates = dateMatches
            .map(m => extractDateString(m[0]))
            .filter((d): d is string => d !== null);

        // Extract ISBNs using shared utility
        const isbns = extractAllISBNs(row);

        if (volumeNumber) {
            const volume: WikipediaVolume = {
                number: volumeNumber,
                chapters: []
            };

            const title = titleMatch?.[1];
            if (title)
                volume.title = title;

            if (altTitleMatch?.[2]) {
                const altTitle = stripHtml(altTitleMatch[2]);
                if (altTitle && !altTitle.includes('<')) {
                    volume.alternativeTitles = [altTitle];
                }
            }

            if (dates[0])
                volume.originalReleaseDate = dates[0];

            if (dates[1])
                volume.englishReleaseDate = dates[1];

            // Get first ISBN (prefer ISBN-10 for backwards compatibility)
            const isbn10 = isbns.find(i => i.isbn10)?.isbn10;
            const isbn13 = isbns.find(i => i.isbn13)?.isbn13;
            const firstIsbn = isbn10 ?? isbn13;

            if (firstIsbn)
                volume.isbn = firstIsbn;

            // Get second ISBN-13 if available
            if (isbns.length > 1 && isbns[1]?.isbn13)
                volume.isbn13 = isbns[1].isbn13;

            volumes.push(volume);
        }
    });
    logger.info(`[WIKIPEDIA] Parsed ${volumes.length} volumes`);
    return volumes;
}

// ============================================================================
// Helper Functions for parseVolumeTableWithDescriptions
// ============================================================================

/**
 * Extract dates from volume content
 *
 * Uses shared date extraction utility for consistent parsing.
 *
 * @param volumeContent - HTML content of volume row
 * @returns Object containing original and English release dates
 */
function extractDatesFromContent(volumeContent: string): {
    originalReleaseDate: string | undefined;
    englishReleaseDate: string | undefined;
} {
    // Use shared utility - extract first two dates found
    const datePattern = /(\w+\s+\d+,\s+\d{4})/g;
    const matches = [...volumeContent.matchAll(datePattern)];

    // Extract dates using shared utility for validation
    const dates = matches
        .map(m => extractDateString(m[0]))
        .filter((d): d is string => d !== null);

    return {
        originalReleaseDate: dates[0],
        englishReleaseDate: dates[1]
    };
}

/**
 * Extract ISBNs from volume content
 *
 * Uses shared ISBN extraction utility for comprehensive pattern matching.
 *
 * @param volumeContent - HTML content of volume row
 * @returns Object containing ISBN and ISBN-13
 */
function extractIsbnsFromContent(volumeContent: string): {
    isbn: string | undefined;
    isbn13: string | undefined;
} {
    // Use shared utility for comprehensive ISBN extraction
    const isbns = extractAllISBNs(volumeContent);

    // Separate ISBN-10 and ISBN-13
    const isbn10 = isbns.find(i => i.isbn10)?.isbn10;
    const isbn13 = isbns.find(i => i.isbn13)?.isbn13;

    return {
        isbn: isbn10 ?? isbn13,
        isbn13: isbn13 ?? (isbns.length > 1 ? isbns[1]?.isbn13 : undefined)
    };
}

/**
 * Check if Pattern 4 matches are spurious (dates, ISBNs, etc. rather than real chapters).
 * Validates that matched chapter numbers form a roughly consecutive sequence (max gap of 3).
 */
function isSpuriousPattern4(matches: RegExpMatchArray[]): boolean {
    const nums = matches
        .map(m => parseInt(m[1] ?? '', 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

    if (nums.length < 2) return true;

    const hasReasonableSequence = nums.every((n, i) => {
        if (i === 0) return true;
        const prev = nums[i - 1];
        return prev !== undefined && (n - prev) <= 3;
    });

    return !hasReasonableSequence;
}

/**
 * Extract individual chapters from volume content
 *
 * Uses shared pattern for chapter matching (supports up to 5 digits for manga like One Piece).
 *
 * @param volumeContent - HTML content of volume row
 * @param volumeNumber - Volume number for chapter association
 * @returns Array of extracted chapters
 */
function extractIndividualChapters(volumeContent: string, volumeNumber: number): WikipediaChapter[] {
    // Use pattern that supports up to 5 digits (One Piece has 1100+ chapters)
    // Handle all quote types: standard ", curly "", and HTML &quot;
    // Also handle optional HTML tags around the title
    const patterns = [
        // Pattern 1: Standard quotes - NN. "Title"
        /(\d{1,5})\.\s*"([^"]+)"/g,
        // Pattern 2: Curly quotes - NN. "Title"
        /(\d{1,5})\.\s*[""]([^""]+)[""]?/g,
        // Pattern 3: HTML entities - NN. &quot;Title&quot;
        /(\d{1,5})\.\s*&quot;([^&]+)&quot;/g,
        // Pattern 4: With HTML italic tags - NN. "<i>Title</i>" or NN. <i>"Title"</i>
        /(\d{1,5})\.\s*(?:<[^>]+>)?\s*[""]?([^<""]+)[""]?\s*(?:<\/[^>]+>)?/g,
    ];

    let individualChapters: RegExpMatchArray[] = [];

    // Try each pattern until we find chapters
    for (const pattern of patterns) {
        const matches = [...volumeContent.matchAll(pattern)];
        // Filter out matches that look like dates or other numeric patterns
        const validMatches = matches.filter(m => {
            const title = m[2]?.trim();
            // Skip if title is too short, empty, or looks like a date/ISBN
            return title &&
                   title.length > 2 &&
                   !title.match(/^\d{4}/) && // Not a year
                   !title.match(/^978-/);    // Not an ISBN
        });

        // Pattern 4 (loose catch-all): validate that matches form a reasonable chapter sequence
        // to avoid false positives from dates, ISBNs, and other numeric text
        if (patterns.indexOf(pattern) === 3 && validMatches.length > 0) {
            const isSpurious = isSpuriousPattern4(validMatches);
            if (isSpurious) {
                continue; // Skip Pattern 4 — matches are spurious
            }
        }

        if (validMatches.length > 0) {
            individualChapters = validMatches;
            logger.info(`[WIKIPEDIA] extractIndividualChapters found ${validMatches.length} chapters using pattern ${patterns.indexOf(pattern) + 1}`);
            break;
        }
    }

    const chapters: WikipediaChapter[] = [];

    if (individualChapters.length === 0) {
        return chapters;
    }

    individualChapters.forEach((match) => {
        const chNum = match[1];
        const chTitle = match[2];

        if (!chNum || !chTitle) {
            return;
        }

        const chapterNum = parseInt(chNum, 10);
        const chapterTitle = cleanChapterTitle(chTitle);

        // Use shared utility for artifact detection
        if (containsWikipediaArtifacts(chapterTitle)) {
            return;
        }

        chapters.push({
            number: chapterNum,
            title: chapterTitle || `Chapter ${chapterNum}`,
            volumeNumber: volumeNumber
        });
    });

    return chapters;
}

/**
 * Calculate chapter range from chapter numbers
 *
 * @param chapters - Array of chapters
 * @returns Chapter range string or undefined
 */
function calculateChapterRange(chapters: WikipediaChapter[]): string | undefined {
    if (chapters.length === 0) {
        return undefined;
    }

    const chapterNumbers = chapters
        .map(ch => typeof ch.number === 'number' ? ch.number : parseInt(String(ch.number), 10))
        .filter(num => !isNaN(num));

    if (chapterNumbers.length === 0) {
        return undefined;
    }

    const minChapter = Math.min(...chapterNumbers);
    const maxChapter = Math.max(...chapterNumbers);

    return minChapter === maxChapter ? `${minChapter}` : `${minChapter}-${maxChapter}`;
}

/**
 * Extract chapters from range pattern
 *
 * @param volumeContent - HTML content of volume row
 * @param volumeNumber - Volume number for chapter association
 * @returns Object containing chapters and chapter range
 */
/** Build chapters array from a start–end range */
function buildChaptersFromRange(
    startChapter: number,
    endChapter: number,
    volumeNumber: number,
): { chapters: WikipediaChapter[]; chapterRange: string } {
    const chapters: WikipediaChapter[] = [];
    for (let i = startChapter; i <= endChapter; i++) {
        chapters.push({ number: i, title: `Chapter ${i}`, volumeNumber });
    }
    return { chapters, chapterRange: `${startChapter}-${endChapter}` };
}

/** Chapter range regex patterns covering common Wikipedia formats */
const CHAPTER_RANGE_PATTERNS = [
    /Chapters?\s*:?\s*(\d+)\s*[–\-−—]\s*(\d+)/i,       // "Chapter: 1-5", "Chapters 1–5"
    /Ch(?:s|apter)?\.?\s*(\d+)\s*[–\-−—]\s*(\d+)/i,     // "Ch. 1-5", "Chs. 1-5"
    /(?:^|\s|>)(\d+)\s*[–\-−—]\s*(\d+)(?:\s|<|$)/,      // Bare "1-5" in a cell (last resort)
];

/**
 * Extract chapters from range pattern
 *
 * @param volumeContent - HTML content of volume row
 * @param volumeNumber - Volume number for chapter association
 * @returns Object containing chapters and chapter range
 */
function extractChaptersFromRange(volumeContent: string, volumeNumber: number): {
    chapters: WikipediaChapter[];
    chapterRange: string | undefined;
} {
    for (const pattern of CHAPTER_RANGE_PATTERNS) {
        const match = volumeContent.match(pattern);
        const startStr = match?.[1];
        const endStr = match?.[2];
        if (!startStr || !endStr) continue;

        const startChapter = parseInt(startStr, 10);
        const endChapter = parseInt(endStr, 10);

        // Sanity check: range should be reasonable
        if (endChapter <= startChapter || (endChapter - startChapter) >= 50) continue;

        logger.info(`[WIKIPEDIA] extractChaptersFromRange found ${startChapter}-${endChapter} for vol ${volumeNumber}`);
        return buildChaptersFromRange(startChapter, endChapter, volumeNumber);
    }

    return { chapters: [], chapterRange: undefined };
}

/**
 * Validate chapter title for inclusion
 *
 * @param title - Chapter title to validate
 * @returns True if valid, false otherwise
 */
function isValidChapterTitle(title: string): boolean {
    return title.length > 0 &&
        !title.includes(':') &&
        !title.includes(';') &&
        !title.includes('{') &&
        !title.includes('cite_ref') &&
        !title.includes('reference') &&
        !title.match(/^\d+$/) && // Skip pure numbers
        !title.startsWith('/wiki/') && // Wiki URL paths
        !title.startsWith('#') && // Fragment links
        !title.includes('%') && // URL-encoded strings
        !containsWikipediaArtifacts(title) && // CSS classes, DOM metadata, language tags
        title.length > 1 &&
        title.length < 100;
}

/**
 * Extract chapters from list items
 *
 * @param descContent - Description content HTML
 * @param volumeNumber - Volume number for chapter association
 * @param fallbackStartChapter - Running chapter count from previous volumes (used when ol start is missing)
 * @returns Array of extracted chapters
 */
function extractChaptersFromListItems(
    descContent: string,
    volumeNumber: number,
    fallbackStartChapter?: number,
): WikipediaChapter[] {
    const listItemPattern = /<li>"([^"<]+)"<\/li>/g;
    const listMatches = [...descContent.matchAll(listItemPattern)];

    if (listMatches.length === 0) {
        return [];
    }

    const olStartMatch = descContent.match(/<ol\s+start="(\d+)"/);
    const startNum = olStartMatch?.[1];
    let chapterNum = startNum ? parseInt(startNum, 10) : 1;

    if (!olStartMatch && volumeNumber > 1) {
        // Use accumulated chapter count from previous volumes instead of heuristic formula
        chapterNum = fallbackStartChapter ?? (volumeNumber - 1) * chapterConfig.avgChaptersPerVolume + 1;
    }

    const chapters: WikipediaChapter[] = [];
    listMatches.forEach((match) => {
        const matchTitle = match[1];
        if (!matchTitle) {
            return;
        }

        const title = cleanChapterTitle(matchTitle);
        if (title && title !== '0' && !containsWikipediaArtifacts(title)) {
            chapters.push({
                number: chapterNum++,
                title: title,
                volumeNumber: volumeNumber
            });
        }
    });

    return chapters;
}

/**
 * Extract chapters from quoted patterns
 *
 * @param descContent - Description content HTML
 * @param volumeNumber - Volume number for chapter association
 * @param fallbackStartChapter - Running chapter count from previous volumes (used instead of heuristic)
 * @returns Array of extracted chapters
 */
function extractChaptersFromQuotedPatterns(
    descContent: string,
    volumeNumber: number,
    fallbackStartChapter?: number,
): WikipediaChapter[] {
    // Strip HTML tags first — quote patterns must match TEXT content, not HTML
    // attribute values like title="Coming-of-age story" or alt="Inio Asano"
    const textContent = stripHtml(descContent);

    const patterns = [
        /"([^"]+)"/g, // Standard quotes
        /&quot;([^&]+)&quot;/g, // HTML entity quotes
        /『([^』]+)』/g, // Japanese quotes
        /「([^」]+)」/g // Alternative Japanese quotes
    ];

    let chapterMatches: RegExpMatchArray[] = [];
    for (const pattern of patterns) {
        const matches = [...textContent.matchAll(pattern)];
        if (matches.length > 0) {
            chapterMatches = matches;
            break;
        }
    }

    // Also try list items from the original HTML (these are structural, not attribute values)
    if (chapterMatches.length === 0) {
        const listPattern = /<li>([^<]+)<\/li>/g;
        const listMatches = [...descContent.matchAll(listPattern)];
        if (listMatches.length > 0) {
            chapterMatches = listMatches;
        }
    }

    if (chapterMatches.length === 0) {
        return [];
    }

    // Use accumulated chapter count from previous volumes instead of heuristic formula
    let chapterNum = volumeNumber > 1
        ? (fallbackStartChapter ?? (volumeNumber - 1) * chapterConfig.avgChaptersPerVolume + 1)
        : 1;
    const chapters: WikipediaChapter[] = [];

    chapterMatches.forEach((match) => {
        const matchTitle = match[1];
        if (!matchTitle) {
            return;
        }

        const title = cleanChapterTitle(matchTitle);
        if (title && isValidChapterTitle(title)) {
            chapters.push({
                number: chapterNum++,
                title: title,
                volumeNumber: volumeNumber
            });
        }
    });

    return chapters;
}

/**
 * Extract description from volume content
 *
 * Handles multiple Wikipedia HTML formats:
 * 1. td colspan pattern (Kaiju No. 8 style)
 * 2. Paragraph-based descriptions
 * 3. Summary class elements
 * 4. Text after chapter lists
 *
 * @param volumeContent - HTML content of volume row
 * @param volumeNumber - Volume number for chapter association
 * @returns Object containing chapters and description
 */
// eslint-disable-next-line complexity -- HTML parsing requires checking multiple patterns and element types
function extractDescriptionAndChapters(
    volumeContent: string,
    volumeNumber: number,
    fallbackStartChapter?: number,
): {
    chapters: WikipediaChapter[];
    description: string | undefined;
} {
    let description: string | undefined;
    let chapters: WikipediaChapter[] = [];

    // Strip infobox content — infobox HTML attributes contain publisher names,
    // author names, genres, and magazine names that get misextracted as chapter titles
    const cleanedContent = volumeContent
        .replace(/<table[^>]*class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '')
        .replace(/<div[^>]*class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

    // Debug logging for first volume
    if (volumeNumber === 1) {
        logger.info('[WIKIPEDIA] Volume 1 content analysis:', {
            contentLength: cleanedContent.length,
            hasTdColspan: cleanedContent.includes('colspan'),
            hasParagraph: cleanedContent.includes('<p'),
            hasSummaryClass: cleanedContent.includes('summary') || cleanedContent.includes('plot'),
            first300chars: cleanedContent.substring(0, 300).replace(/\s+/g, ' ')
        });
    }

    // Pattern 1: td colspan (Kaiju No. 8 style) - most common
    const colspanPattern = /<td[^>]*colspan=["']?\d+["']?[^>]*>([\s\S]*?)<\/td>/gi;
    const colspanMatches = [...cleanedContent.matchAll(colspanPattern)];

    for (const match of colspanMatches) {
        if (!match[1]) continue;
        const text = stripHtml(match[1]).trim();
        // Skip if it's just chapter listings or too short
        if (text.length >= 50 && !isChapterListOnly(text)) {
            description = text;
            // Also extract chapters from this content
            chapters = extractChaptersFromListItems(match[1], volumeNumber, fallbackStartChapter);
            if (chapters.length === 0) {
                chapters = extractChaptersFromQuotedPatterns(match[1], volumeNumber, fallbackStartChapter);
            }
            break;
        }
    }

    // Pattern 2: Paragraph with substantial text (after chapter list)
    if (!description) {
        // Look for paragraphs that contain narrative text
        const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        const paragraphMatches = [...cleanedContent.matchAll(paragraphPattern)];

        for (const match of paragraphMatches) {
            if (!match[1]) continue;
            const text = stripHtml(match[1]).trim();
            // Look for narrative text (at least 50 chars, no "Chapter" headers)
            if (text.length >= 50 && !isChapterListOnly(text)) {
                description = text;
                break;
            }
        }
    }

    // Pattern 3: Look for plot/summary sections
    if (!description) {
        const summaryPattern = /<(?:div|span|td)[^>]*class=["'][^"']*(?:summary|plot|synopsis)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|td)>/gi;
        const summaryMatches = [...cleanedContent.matchAll(summaryPattern)];

        for (const match of summaryMatches) {
            if (!match[1]) continue;
            const text = stripHtml(match[1]).trim();
            if (text.length >= 50) {
                description = text;
                break;
            }
        }
    }

    // Pattern 4: Look for text that starts with narrative indicators
    if (!description) {
        // Common narrative starters in manga volume descriptions
        const narrativePattern = /<(?:td|p|div)[^>]*>([\s\S]*?(?:joins|begins|continues|follows|discovers|battles|fights|learns|meets|faces)[^<]*[\s\S]*?)<\/(?:td|p|div)>/gi;
        const narrativeMatches = [...cleanedContent.matchAll(narrativePattern)];

        for (const match of narrativeMatches) {
            if (!match[1]) continue;
            const text = stripHtml(match[1]).trim();
            if (text.length >= 50 && text.length < 2000) {
                description = text;
                break;
            }
        }
    }

    // If we found a description but no chapters yet, try to extract them
    if (description && chapters.length === 0) {
        chapters = extractChaptersFromListItems(cleanedContent, volumeNumber, fallbackStartChapter);
        if (chapters.length === 0) {
            chapters = extractChaptersFromQuotedPatterns(cleanedContent, volumeNumber, fallbackStartChapter);
        }
    }

    // Debug log result
    if (volumeNumber <= 3) {
        logger.info(`[WIKIPEDIA] Volume ${volumeNumber} extraction result:`, {
            hasDescription: !!description,
            descriptionLength: description?.length ?? 0,
            descriptionPreview: description?.substring(0, 100),
            chapterCount: chapters.length
        });
    }

    return { chapters, description };
}

/**
 * Check if text is primarily chapter listings (not a description)
 *
 * Uses shared utility for consistent detection across parsers.
 */
function isChapterListOnly(text: string): boolean {
    // Use shared utility for chapter list detection
    return isChapterListText(text);
}

/**
 * Parse simple volume row (Berserk style)
 *
 * Uses shared utilities for date and ISBN extraction.
 *
 * @param match - Regex match for volume row
 * @returns Volume object or undefined
 */
function parseSimpleVolumeRow(match: RegExpMatchArray): WikipediaVolume | undefined {
    const volNum = match[1];
    if (!volNum) {
        return undefined;
    }

    const volumeNumber = parseInt(volNum, 10);
    // Allow Volume 0 for prequels (e.g., JJK 0)
    if (volumeNumber < 0 || volumeNumber >= 200) {
        return undefined;
    }

    const rowContent = match[0];

    // Extract dates using shared utility
    const datePattern = /(\w+\s+\d+,\s+\d{4})/g;
    const dateMatches = [...rowContent.matchAll(datePattern)];
    const dates = dateMatches
        .map(m => extractDateString(m[0]))
        .filter((d): d is string => d !== null);

    // Extract ISBNs using shared utility
    const isbns = extractAllISBNs(rowContent);

    const volume: WikipediaVolume = {
        number: volumeNumber,
        chapters: []
    };

    if (dates[0]) {
        volume.originalReleaseDate = dates[0];
    }

    if (dates[1]) {
        volume.englishReleaseDate = dates[1];
    }

    const isbnVal = isbns[0]?.isbn10 ?? isbns[0]?.isbn13;
    if (isbnVal) {
        volume.isbn = isbnVal;
    }

    return volume;
}

/**
 * Options for building a volume object
 */
interface BuildVolumeObjectOptions {
    volumeNumber: number;
    chapters: WikipediaChapter[];
    chapterRange?: string | undefined;
    description?: string | undefined;
    dates: {
        originalReleaseDate: string | undefined;
        englishReleaseDate: string | undefined;
    };
    isbns: {
        isbn: string | undefined;
        isbn13: string | undefined;
    };
}

/**
 * Build volume object from extracted data
 *
 * @param options - Volume building options
 * @returns Complete volume object
 */
function buildVolumeObject(options: BuildVolumeObjectOptions): WikipediaVolume {
    const { volumeNumber, chapters, chapterRange, description, dates, isbns } = options;

    const volume: WikipediaVolume = {
        number: volumeNumber,
        chapters
    };

    if (chapterRange) {
        volume.chapterRange = chapterRange;
    }
    if (description) {
        volume.description = description;
    }
    if (dates.originalReleaseDate) {
        volume.originalReleaseDate = dates.originalReleaseDate;
    }
    if (dates.englishReleaseDate) {
        volume.englishReleaseDate = dates.englishReleaseDate;
    }
    if (isbns.isbn) {
        volume.isbn = isbns.isbn;
    }
    if (isbns.isbn13) {
        volume.isbn13 = isbns.isbn13;
    }

    return volume;
}

/**
 * Deduplicate volumes by number, keeping the entry with the richest data
 *
 * Some Wikipedia pages have multiple tables (manga, novels, guidebooks) each
 * with their own id="volN" markers, producing duplicate volume numbers.
 * Keeps the entry with the most chapters, or if tied, the one with a description.
 *
 * @param volumes - Array of volumes (may contain duplicates)
 * @returns Deduplicated array
 */
function deduplicateVolumes(volumes: WikipediaVolume[]): WikipediaVolume[] {
    const bestByNumber = new Map<number, WikipediaVolume>();

    for (const vol of volumes) {
        const existing = bestByNumber.get(vol.number);
        if (!existing) {
            bestByNumber.set(vol.number, vol);
            continue;
        }
        // Keep the entry with more chapters, or with a description
        const existingScore = existing.chapters.length + (existing.description ? 1 : 0);
        const newScore = vol.chapters.length + (vol.description ? 1 : 0);
        if (newScore > existingScore) {
            bestByNumber.set(vol.number, vol);
        }
    }

    return [...bestByNumber.values()].sort((a, b) => a.number - b.number);
}

/**
 * Parse volume table that includes descriptions and chapter ranges
 *
 * @param html - HTML content containing volume table
 * @returns Array of volumes with descriptions
 */
export function parseVolumeTableWithDescriptions(html: string): WikipediaVolume[] {
    const volumes: WikipediaVolume[] = [];

    // Look for volume rows with id="volN" pattern (Kaiju No. 8 style)
    const volumePattern = /<tr[^>]*>.*?<th[^>]*id="vol(\d+)"[^>]*>.*?<\/tr>(.*?)(?=<tr[^>]*>.*?<th[^>]*id="vol\d+"|$)/gs;
    const volumeMatches = [...html.matchAll(volumePattern)];

    // Track running chapter count across volumes for accurate fallback numbering
    let runningChapterNum = 1;

    for (const match of volumeMatches) {
        const volNum = match[1];
        if (!volNum) {
            continue;
        }

        const volumeNumber = parseInt(volNum, 10);
        const rawVolContent = match[0] + (match[2] ?? '');

        // The volume row regex can capture far too much content (e.g., 30KB for vol1
        // on main-article pages where the infobox sits between vol1 and vol2 rows).
        // Strip everything before the wikitable data cells and remove non-table content.
        const cleanedVolContent = rawVolContent
            .replace(/<table[^>]*class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '')
            .replace(/<div[^>]*class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<div[^>]*class="[^"]*plainlist[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<div[^>]*class="[^"]*reflist[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

        // Extract dates and ISBNs (use raw content — dates/ISBNs can be in infobox)
        const dates = extractDatesFromContent(rawVolContent);
        const isbns = extractIsbnsFromContent(rawVolContent);

        // Try range pattern first (more reliable — e.g., "Chapters 1–5")
        const rangeResult = extractChaptersFromRange(cleanedVolContent, volumeNumber);
        let chapters = rangeResult.chapters;
        let chapterRange = rangeResult.chapterRange;

        // If no range found, try individual chapter listings (e.g., "1. Title")
        if (chapters.length === 0) {
            chapters = extractIndividualChapters(cleanedVolContent, volumeNumber);
            chapterRange = calculateChapterRange(chapters);
        }

        // Extract description and additional chapters (pass running count as fallback).
        // Skip if content is unreasonably large (>10KB) — the volume row regex captured
        // too much content (e.g., entire page between vol1 and vol2 on main-article pages).
        // Quote-matching on such large content extracts review text, genre names, etc.
        const descResult = cleanedVolContent.length <= 10000
            ? extractDescriptionAndChapters(cleanedVolContent, volumeNumber, runningChapterNum)
            : { chapters: [] as WikipediaChapter[], description: undefined };
        if (chapters.length === 0 && descResult.chapters.length > 0) {
            chapters = descResult.chapters;
        }

        // Update running chapter count based on chapters found in this volume
        if (chapters.length > 0) {
            const maxChNum = Math.max(
                ...chapters.map(ch => typeof ch.number === 'number' ? ch.number : parseInt(String(ch.number), 10))
            );
            if (!isNaN(maxChNum)) {
                runningChapterNum = maxChNum + 1;
            }
        }

        const volume = buildVolumeObject({
            volumeNumber,
            chapters,
            chapterRange: chapterRange ?? calculateChapterRange(chapters),
            description: descResult.description,
            dates,
            isbns
        });

        volumes.push(volume);
    }

    // If no volumes found, try simpler approach (Berserk style)
    if (volumes.length === 0) {
        const simpleVolumePattern = /<tr[^>]*>.*?id="vol(\d+)".*?<\/tr>/gs;
        const simpleMatches = [...html.matchAll(simpleVolumePattern)];

        simpleMatches.forEach((match) => {
            const volume = parseSimpleVolumeRow(match);
            if (volume) {
                volumes.push(volume);
            }
        });
    }

    // Deduplicate volumes by number — some pages (e.g., Attack on Titan) have
    // multiple tables (manga, novels, guidebooks) each with id="volN" markers.
    // Keep the entry with the richest data (most chapters or has description).
    return deduplicateVolumes(volumes);
}

/**
 * Parse volume table with filtering for main series only
 *
 * Filters out sequel/spinoff series (e.g., Tokyo Ghoul:re) and anime episodes
 * before parsing the volume table.
 *
 * @param html - HTML content containing volume table
 * @param seriesTitle - Main series title for filtering context
 * @returns Array of volumes from main series only
 */
export function parseVolumeTableFiltered(html: string, seriesTitle?: string): WikipediaVolume[] {
    const filteredHtml = filterToMainSeriesContent(html, seriesTitle);
    return parseVolumeTable(filteredHtml);
}

/**
 * Parse volume table with descriptions, filtering for main series only
 *
 * Filters out sequel/spinoff series and anime episodes before parsing.
 *
 * @param html - HTML content containing volume table
 * @param seriesTitle - Main series title for filtering context
 * @returns Array of volumes with descriptions from main series only
 */
export function parseVolumeTableWithDescriptionsFiltered(
    html: string,
    seriesTitle?: string
): WikipediaVolume[] {
    const filteredHtml = filterToMainSeriesContent(html, seriesTitle);
    return parseVolumeTableWithDescriptions(filteredHtml);
}

/**
 * Extract embedded volume information from main manga page
 *
 * Uses shared utilities for date and ISBN extraction.
 *
 * @param html - HTML content of main page
 * @returns Array of volumes
 */
export function extractEmbeddedVolumes(html: string): WikipediaVolume[] {
    const volumes: WikipediaVolume[] = [];
    const $ = cheerio.load(html);
    // Look for volume rows with id="volN" pattern
    $('tr th[id^="vol"]').each((_i, elem) => {
        const $th = $(elem);
        const id = $th.attr('id');
        if (!id)
            return;
        const volMatch = id.match(/vol(\d+)/);
        if (!volMatch?.[1])
            return;
        const volumeNumber = parseInt(volMatch[1], 10);
        const $row = $th.closest('tr');
        const rowText = $row.text();

        // Extract dates using shared utility
        const datePattern = /(\w+\s+\d+,\s+\d{4})/g;
        const rawDates = [...rowText.matchAll(datePattern)];
        const dates = rawDates
            .map(m => extractDateString(m[0]))
            .filter((d): d is string => d !== null);

        // Extract ISBNs using shared utility
        const isbns = extractAllISBNs(rowText);

        const originalReleaseDate = dates[0];
        const englishReleaseDate = dates[1];
        const originalISBN = isbns[0]?.isbn13 ?? isbns[0]?.isbn10;
        const englishISBN = isbns[1]?.isbn13 ?? isbns[1]?.isbn10;

        if (originalReleaseDate ?? originalISBN) {
            const volume: WikipediaVolume = {
                number: volumeNumber,
                chapters: []
            };
            if (originalReleaseDate)
                volume.originalReleaseDate = originalReleaseDate;
            if (englishReleaseDate)
                volume.englishReleaseDate = englishReleaseDate;
            if (originalISBN)
                volume.isbn = originalISBN;
            if (englishISBN)
                volume.isbn13 = englishISBN;

            volumes.push(volume);
        }
    });
    // Also look for volume tables with specific class
    $('.wikitable tr').each((_i, elem) => {
        const $row = $(elem);
        const text = $row.text();
        // Check if this looks like a volume row
        const volMatch = text.match(/Volume\s+(\d+)/i);
        if (volMatch?.[1]) {
            const volNumStr = volMatch[1];
            const volumeNumber = parseInt(volNumStr, 10);
            if (volumes.some((v) => v.number === volumeNumber))
                return;
            // Extract dates using shared utility
            const releaseDate = extractDateString(text);
            const volume: WikipediaVolume = {
                number: volumeNumber,
                chapters: []
            };
            if (releaseDate)
                volume.originalReleaseDate = releaseDate;

            volumes.push(volume);
        }
    });
    if (volumes.length > 0) {
        logger.info(`[WIKIPEDIA] Found ${volumes.length} embedded volumes in main page`);
    }
    return volumes.sort((a, b) => a.number - b.number);
}
