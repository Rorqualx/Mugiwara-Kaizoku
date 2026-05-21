/**
 * Wikipedia Volume Extractor - Chapter Extraction
 *
 * Extracts chapter information from Wikipedia text content and HTML table cells.
 * Handles multiple chapter naming patterns including numbered chapters, special chapters,
 * prologues, epilogues, and Japanese titles.
 *
 * Extracted from: wikipediaVolumeExtractor.ts (lines 406-562)
 * Complexity reduced: extractChaptersFromText split into 6 helper functions
 */

import type { WikipediaChapter } from './types';
import type * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Parse Japanese title from parenthetical text
 * Handles format: (Japanese, Romaji)
 */
function parseJapaneseTitle(matchText: string): string | null {
    const japaneseMatch = matchText.match(/([^,]+),\s*(.+)/);
    return japaneseMatch?.[1]?.trim() ?? null;
}

/**
 * Extract numbered chapters matching pattern: 00. "Title" (Japanese, Romaji)
 * Pattern 1: Standard numbered format
 */
function extractNumberedChapters(text: string): WikipediaChapter[] {
    const chapters: WikipediaChapter[] = [];
    const pattern = /(\d{2,3})\.\s*"([^"]+)"(?:\s*\(([^)]+)\))?/g;

    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[2]) {
            const chapter: WikipediaChapter = {
                number: match[1],
                title: match[2]
            };

            // Extract Japanese title if present
            if (match[3]) {
                const japaneseTitle = parseJapaneseTitle(match[3]);
                if (japaneseTitle) {
                    chapter.japaneseTitle = japaneseTitle;
                }
            }

            chapters.push(chapter);
        }
    }

    return chapters;
}

/**
 * Extract special chapters with quoted titles
 * Pattern 2: Epilogue/Prologue/Intro X: "Title"
 */
function extractSpecialChapters(text: string): WikipediaChapter[] {
    const chapters: WikipediaChapter[] = [];
    const pattern = /(Epilogue|Prologue|Introduction|Intro|Final Chapter|Special|Extra|Omake|Bonus)\s*(\d*)\s*:?\s*"([^"]+)"(?:\s*\(([^)]+)\))?/gi;

    let match;
    while ((match = pattern.exec(text)) !== null) {
        const chapterType = match[1];
        const chapterNum = match[2] ?? '';
        const chapterTitle = match[3];

        if (chapterType && chapterTitle) {
            const chapter: WikipediaChapter = {
                number: chapterNum ? `${chapterType} ${chapterNum}` : chapterType,
                title: chapterTitle
            };

            // Extract Japanese title if present
            if (match[4]) {
                const japaneseTitle = parseJapaneseTitle(match[4]);
                if (japaneseTitle) {
                    chapter.japaneseTitle = japaneseTitle;
                }
            }

            chapters.push(chapter);
        }
    }

    return chapters;
}

/**
 * Check if chapter already exists in the list to prevent duplicates
 */
function isDuplicateChapter(
    chapters: WikipediaChapter[],
    chapterType: string,
    chapterNum: string,
    chapterTitle: string
): boolean {
    return chapters.some(ch =>
        ch.title === chapterTitle ||
        (chapterType && ch.number.includes(chapterType) && (chapterNum ? ch.number.includes(chapterNum) : true))
    );
}

/**
 * Extract alternative special chapter format without quotes
 * Pattern 3: Epilogue/Prologue X: Title (no quotes)
 */
function extractAlternativeSpecialChapters(
    text: string,
    existingChapters: WikipediaChapter[]
): WikipediaChapter[] {
    const chapters: WikipediaChapter[] = [];
    const pattern = /(Epilogue|Prologue|Introduction|Intro|Final Chapter|Special|Extra)\s*(\d*)\s*:?\s*([^\n"]+?)(?:\s*\(([^)]+)\))?$/gim;

    let match;
    while ((match = pattern.exec(text)) !== null) {
        const chapterType = match[1];
        const chapterNum = match[2] ?? '';
        const chapterTitle = match[3] ? match[3].trim() : '';

        // Skip if already captured or invalid
        if (!chapterType) continue;
        if (!chapterTitle || chapterTitle.includes('<')) continue;

        const alreadyExists = isDuplicateChapter(existingChapters, chapterType, chapterNum, chapterTitle);
        if (alreadyExists) continue;

        const chapter: WikipediaChapter = {
            number: chapterNum ? `${chapterType} ${chapterNum}` : chapterType,
            title: chapterTitle
        };

        if (match[4]) {
            const japaneseTitle = parseJapaneseTitle(match[4]);
            if (japaneseTitle) {
                chapter.japaneseTitle = japaneseTitle;
            }
        }

        chapters.push(chapter);
    }

    return chapters;
}

/**
 * Extract simple chapter format as fallback
 * Pattern 4: Simple Chapter X: Title
 */
function extractSimpleChapters(text: string): WikipediaChapter[] {
    const chapters: WikipediaChapter[] = [];
    const pattern = /Chapter\s+(\d+):\s*([^\n]+)/g;

    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[2]) {
            chapters.push({
                number: match[1],
                title: match[2].trim()
            });
        }
    }

    return chapters;
}

/**
 * Extract chapters from text content
 * Tries multiple patterns in order of specificity
 *
 * Complexity reduced from 30 to <20 by extracting helper functions
 */
export function extractChaptersFromText(text: string): WikipediaChapter[] {
    let chapters: WikipediaChapter[] = [];

    // Pattern 1: Numbered chapters - 00. "Title" (Japanese, Romaji)
    chapters = extractNumberedChapters(text);

    // Pattern 2: Special chapters - Epilogue/Prologue/Intro X: "Title"
    const specialChapters = extractSpecialChapters(text);
    chapters.push(...specialChapters);

    // Pattern 3: Alternative special format without quotes
    const altSpecialChapters = extractAlternativeSpecialChapters(text, chapters);
    chapters.push(...altSpecialChapters);

    // If no matches yet, try simpler patterns
    if (chapters.length === 0) {
        chapters = extractSimpleChapters(text);
    }

    return chapters;
}

/**
 * Extract chapters from a table cell
 * Tries multiple patterns in order of specificity
 */
export function extractChaptersFromCell(
    $: cheerio.CheerioAPI,
    $cell: cheerio.Cheerio<Element>
): WikipediaChapter[] {
    const chapters: WikipediaChapter[] = [];
    const cellText = $cell.text();

    // Try different chapter patterns
    // Pattern 1: 01. "Title" (pages)
    const pattern1 = /(\d+)\.\s*"([^"]+)"(?:\s*\(([^)]+)\))?/g;
    let match;
    while ((match = pattern1.exec(cellText)) !== null) {
        if (match[1] && match[2]) {
            const chapter: WikipediaChapter = {
                number: match[1],
                title: match[2]
            };
            if (match[3]) {
                const pages = parseInt(match[3], 10);
                if (!isNaN(pages)) {
                    chapter.pages = pages;
                }
            }
            chapters.push(chapter);
        }
    }

    // Pattern 2: Chapter 1: Title
    if (chapters.length === 0) {
        const pattern2 = /Chapter\s+(\d+):\s*([^\n]+)/g;
        while ((match = pattern2.exec(cellText)) !== null) {
            if (match[1] && match[2]) {
                chapters.push({
                    number: match[1],
                    title: match[2].trim()
                });
            }
        }
    }

    // Pattern 3: Simple numbered list
    if (chapters.length === 0) {
        const pattern3 = /(\d+)\.\s+([^\n]+)/g;
        while ((match = pattern3.exec(cellText)) !== null) {
            if (match[1] && match[2]) {
                chapters.push({
                    number: match[1],
                    title: match[2].trim()
                });
            }
        }
    }

    return chapters;
}
