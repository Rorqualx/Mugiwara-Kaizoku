/**
 * Chapter Extraction Utilities
 *
 * Provides shared chapter number extraction using naming conventions.
 * Supports standard chapters (Chapter 1, Ch. 1), special chapters (Epilogue, Prologue),
 * and alternative naming conventions (Stage, Mission, Episode, Round, Case, Act).
 *
 * @module metadata/utils/fandom-table-parser/chapter-extraction
 */

import {
  NAMING_CONVENTIONS,
  CHAPTER_CONVENTION,
  extractChapterNumberFromText,
} from '@/server/parsers/patterns/naming-conventions';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ChapterExtractionResult {
  number: number;
  conventionName: string;
  isSpecial: boolean;
}

interface ConventionLike {
  name: string;
  displayName: string;
  patterns: RegExp[];
}

// ============================================================================
// Special Chapter Patterns
// ============================================================================

/**
 * Special chapter types that should be parsed (e.g., Epilogue, Prologue)
 * Maps chapter type prefix to a base offset for numbering
 */
const SPECIAL_CHAPTER_PATTERNS: Array<{ pattern: RegExp; name: string; baseOffset: number }> = [
  { pattern: /Epilogue\s*(\d+)/i, name: 'epilogue', baseOffset: 1000 },
  { pattern: /^Epilogue$/i, name: 'epilogue', baseOffset: 1001 },
  { pattern: /Prologue\s*(\d+)/i, name: 'prologue', baseOffset: -100 },
  { pattern: /^Prologue$/i, name: 'prologue', baseOffset: 0 },
  { pattern: /Final\s*Chapter\s*(\d+)/i, name: 'final', baseOffset: 2000 },
  { pattern: /Final\s*Chapter/i, name: 'final', baseOffset: 2001 },
  { pattern: /Extra\s*(\d+)/i, name: 'extra', baseOffset: 3000 },
  { pattern: /Special\s*(\d+)/i, name: 'special', baseOffset: 4000 },
];

// ============================================================================
// Main Extraction Functions
// ============================================================================

/**
 * Extract chapter number from text using all known patterns
 */
export function extractChapterNumber(text: string): ChapterExtractionResult | null {
  const zeroChapterResult = extractZeroChapterNumber(text);
  if (zeroChapterResult) return zeroChapterResult;

  const standardResult = extractStandardChapterNumber(text);
  if (standardResult) return standardResult;

  // Try numbered title format: "001: Title", "01. Title", etc.
  const numberedTitleResult = extractNumberedTitleFormat(text);
  if (numberedTitleResult) return numberedTitleResult;

  const conventionResult = extractConventionChapterNumber(text);
  if (conventionResult) return conventionResult;

  const specialResult = extractSpecialChapterNumber(text);
  if (specialResult) return specialResult;

  return null;
}

/**
 * Extract chapter number specifically for special chapters
 */
export function extractSpecialChapterNumberOnly(text: string): number | undefined {
  const result = extractSpecialChapterNumber(text);
  return result?.number;
}

// ============================================================================
// Pattern-Specific Extractors
// ============================================================================

/**
 * Extract Volume 0 prequel format: "Chapter 0-1", "000-1" -> 0.1
 */
function extractZeroChapterNumber(text: string): ChapterExtractionResult | null {
  const patterns = [
    /chapter\s*0+-(\d+)/i,
    /^0+-(\d+)(?:\.|$|\s)/,
    /\b0+-(\d+)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return { number: parseFloat(`0.${match[1]}`), conventionName: 'chapter', isSpecial: false };
    }
  }

  return null;
}

/**
 * Extract standard chapter patterns: "Chapter 1", "Ch. 1", "#1"
 */
function extractStandardChapterNumber(text: string): ChapterExtractionResult | null {
  const match = text.match(/Chapter\s+(\d+(?:\.\d+)?)|Ch\.?\s*(\d+(?:\.\d+)?)|#(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const numberStr = match[1] ?? match[2] ?? match[3];
  if (!numberStr) return null;

  return { number: parseFloat(numberStr), conventionName: 'chapter', isSpecial: false };
}

/**
 * Extract numbered title format: "001: Title", "01: Title", "1: Title"
 * Also handles "001. Title" and "001 - Title" patterns
 * Common in wikis like Sakamoto Days that use simple number prefixes
 */
function extractNumberedTitleFormat(text: string): ChapterExtractionResult | null {
  // Match number at start followed by separator (: . -) and title
  // Handles: "001: Title", "01. Title", "1 - Title"
  const match = text.match(/^(\d{1,4})(?:\s*[:.\-–—]\s*|\s+)/);
  if (!match?.[1]) return null;

  const num = parseInt(match[1], 10);
  if (isNaN(num)) return null;

  logger.debug(`[chapter-extraction] Found numbered title format: "${text}" -> ${num}`);
  return { number: num, conventionName: 'numbered', isSpecial: false };
}

/**
 * Extract chapter number using naming conventions (Stage, Mission, Episode, etc.)
 */
function extractConventionChapterNumber(text: string): ChapterExtractionResult | null {
  const allConventions = [...NAMING_CONVENTIONS, CHAPTER_CONVENTION];

  for (const convention of allConventions) {
    if (convention.name === 'chapter') continue;

    const result = tryConventionMatch(text, convention);
    if (result) return result;
  }

  const sharedResult = extractChapterNumberFromText(text);
  if (sharedResult !== null) {
    return { number: sharedResult, conventionName: 'unknown', isSpecial: false };
  }

  return null;
}

/**
 * Try to match a single convention against text
 */
function tryConventionMatch(text: string, convention: ConventionLike): ChapterExtractionResult | null {
  const patternResult = tryPatternBasedMatch(text, convention);
  if (patternResult) return patternResult;

  const prefixNumber = tryPrefixMatch(text, convention);
  if (prefixNumber !== null) {
    logger.debug(`[chapter-extraction] Found ${convention.name} (prefix): "${text}" -> ${prefixNumber}`);
    return { number: prefixNumber, conventionName: convention.name, isSpecial: false };
  }

  return null;
}

/**
 * Try pattern-based matching for a convention
 */
function tryPatternBasedMatch(text: string, convention: ConventionLike): ChapterExtractionResult | null {
  for (const pattern of convention.patterns) {
    const result = matchSinglePattern(text, pattern, convention.name);
    if (result) return result;
  }
  return null;
}

/**
 * Match a single pattern against text
 */
function matchSinglePattern(text: string, pattern: RegExp, conventionName: string): ChapterExtractionResult | null {
  const regex = new RegExp(pattern.source, pattern.flags.replace('g', ''));
  const match = regex.exec(text);
  if (!match) return null;

  const number = extractNumberFromMatch(match);
  if (number === null) return null;

  logger.debug(`[chapter-extraction] Found ${conventionName}: "${text}" -> ${number}`);
  return { number, conventionName, isSpecial: false };
}

/**
 * Try prefix-based matching for a convention
 */
function tryPrefixMatch(text: string, convention: { displayName: string }): number | null {
  const prefix = convention.displayName.toLowerCase();
  const lowerText = text.toLowerCase();

  if (!lowerText.startsWith(prefix)) return null;

  const afterPrefix = text.slice(convention.displayName.length).trim();
  const numberMatch = afterPrefix.match(/^(\d+(?:\.\d+)?)/);

  return numberMatch?.[1] ? parseFloat(numberMatch[1]) : null;
}

/**
 * Extract number from regex match groups
 */
function extractNumberFromMatch(match: RegExpExecArray): number | null {
  for (let i = 1; i < match.length; i++) {
    const group = match[i];
    if (group && /^\d+(?:\.\d+)?$/.test(group)) {
      return parseFloat(group);
    }
  }

  const numberMatch = match[0].match(/(\d+(?:\.\d+)?)/);
  return numberMatch?.[1] ? parseFloat(numberMatch[1]) : null;
}

/**
 * Extract special chapter patterns (Epilogue, Prologue, etc.)
 */
function extractSpecialChapterNumber(text: string): ChapterExtractionResult | null {
  for (const { pattern, name, baseOffset } of SPECIAL_CHAPTER_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;

    const numStr = match[1];
    const num = numStr ? parseInt(numStr, 10) : 0;
    const result = baseOffset + num;

    logger.info(`[chapter-extraction] Found special chapter: "${text}" -> ${result}`);
    return { number: result, conventionName: name, isSpecial: true };
  }

  return null;
}

// ============================================================================
// URL-Based Extraction
// ============================================================================

/**
 * Extract chapter number from URL/href
 */
export function extractChapterNumberFromUrl(href: string): ChapterExtractionResult | null {
  const zeroMatch = href.match(/Chapter_0+-(\d+)/i);
  if (zeroMatch?.[1]) {
    return { number: parseFloat(`0.${zeroMatch[1]}`), conventionName: 'chapter', isSpecial: false };
  }

  const standardMatch = href.match(/Chapter_(\d+(?:_\d+)?)/i);
  if (standardMatch?.[1]) {
    return { number: parseFloat(standardMatch[1].replace('_', '.')), conventionName: 'chapter', isSpecial: false };
  }

  const specialResult = extractSpecialChapterFromUrl(href);
  if (specialResult) return specialResult;

  return extractConventionFromUrl(href);
}

/**
 * Extract special chapters (Epilogue, Prologue) from URL
 */
function extractSpecialChapterFromUrl(href: string): ChapterExtractionResult | null {
  const epilogueMatch = href.match(/Epilogue_?(\d*)/i);
  if (epilogueMatch) {
    const num = epilogueMatch[1] ? parseInt(epilogueMatch[1], 10) : 1;
    return { number: 1000 + num, conventionName: 'epilogue', isSpecial: true };
  }

  const prologueMatch = href.match(/Prologue_?(\d*)/i);
  if (prologueMatch) {
    const num = prologueMatch[1] ? parseInt(prologueMatch[1], 10) : 0;
    return { number: -100 + num, conventionName: 'prologue', isSpecial: true };
  }

  return null;
}

/**
 * Extract naming convention chapter from URL
 */
function extractConventionFromUrl(href: string): ChapterExtractionResult | null {
  for (const convention of NAMING_CONVENTIONS) {
    const urlPattern = new RegExp(`${convention.displayName}_?(\\d+)`, 'i');
    const match = href.match(urlPattern);
    if (match?.[1]) {
      return { number: parseFloat(match[1]), conventionName: convention.name, isSpecial: false };
    }
  }

  return null;
}

// ============================================================================
// Title Cleaning
// ============================================================================

/**
 * Clean chapter title by removing the chapter prefix
 */
export function cleanChapterTitle(title: string, conventionName?: string): string {
  let cleaned = title.replace(/^(Chapter|Ch\.?)\s*\d+\s*[-:.]?\s*/i, '');

  if (conventionName && conventionName !== 'chapter') {
    const convention = NAMING_CONVENTIONS.find((c) => c.name === conventionName);
    if (convention) {
      const prefixPattern = new RegExp(`^${convention.displayName}\\s*\\d+\\s*[-:.]?\\s*`, 'i');
      cleaned = cleaned.replace(prefixPattern, '');
    }
  }

  cleaned = cleaned.replace(/^(Epilogue|Prologue|Final\s*Chapter|Extra|Special)\s*\d*\s*[-:.]?\s*/i, '');

  return cleaned.trim();
}
