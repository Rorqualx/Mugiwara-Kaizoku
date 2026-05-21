/**
 * Pattern Detector
 *
 * Enhanced filename pattern detection for manga content.
 * Supports multiple naming conventions and languages.
 *
 * @module content-classifier/pattern-detector
 */

import type { PatternMatch } from './types';

/**
 * Volume detection patterns in priority order
 * Higher priority patterns are more specific and reliable
 */
const VOLUME_PATTERNS: Array<{ pattern: RegExp; confidence: number; name: string }> = [
  // English patterns
  { pattern: /\bVol(?:ume)?[\s._-]*(\d+)/i, confidence: 0.95, name: 'Volume N' },
  { pattern: /\bV(\d{2,})/i, confidence: 0.85, name: 'VNN' },
  { pattern: /\bV\.?(\d+)\b/i, confidence: 0.80, name: 'V.N' },
  // Japanese/Romanized patterns
  { pattern: /\b(?:Tome|Tomo)[\s._-]*(\d+)/i, confidence: 0.90, name: 'Tome N' },
  { pattern: /\b巻[\s._-]*(\d+)/i, confidence: 0.95, name: 'Japanese' },
  // Bracketed patterns
  { pattern: /\[Vol(?:ume)?[\s._-]*(\d+)\]/i, confidence: 0.95, name: '[Volume N]' },
  { pattern: /\(Vol(?:ume)?[\s._-]*(\d+)\)/i, confidence: 0.90, name: '(Volume N)' },
  // Separator patterns
  { pattern: /[\s._-]v(\d+)[\s._-]/i, confidence: 0.75, name: '_vN_' },
];

/**
 * Chapter detection patterns in priority order
 */
const CHAPTER_PATTERNS: Array<{ pattern: RegExp; confidence: number; name: string }> = [
  // Explicit chapter patterns
  { pattern: /\bCh(?:apter)?[\s._-]*(\d+(?:\.\d+)?)/i, confidence: 0.95, name: 'Chapter N' },
  { pattern: /\bCh\.?(\d+(?:\.\d+)?)\b/i, confidence: 0.85, name: 'Ch.N' },
  { pattern: /\bC(\d+(?:\.\d+)?)\b/i, confidence: 0.75, name: 'CN' },
  // Japanese patterns
  { pattern: /\b話[\s._-]*(\d+(?:\.\d+)?)/i, confidence: 0.95, name: 'Japanese' },
  { pattern: /\b第[\s._-]*(\d+(?:\.\d+)?)[\s._-]*話/i, confidence: 0.95, name: 'Japanese formal' },
  // Bracketed patterns
  { pattern: /\[Ch(?:apter)?[\s._-]*(\d+(?:\.\d+)?)\]/i, confidence: 0.95, name: '[Chapter N]' },
  { pattern: /\(Ch(?:apter)?[\s._-]*(\d+(?:\.\d+)?)\)/i, confidence: 0.90, name: '(Chapter N)' },
  // Separator patterns with leading zeros
  { pattern: /[\s._-]c(\d{3,4})[\s._-]/i, confidence: 0.85, name: '_cNNN_' },
  { pattern: /[\s._-](\d{3,4})[\s._-]/i, confidence: 0.70, name: '_NNN_' },
  // Episode/Part patterns (common in some releases)
  { pattern: /\bEp(?:isode)?[\s._-]*(\d+(?:\.\d+)?)/i, confidence: 0.80, name: 'Episode N' },
  { pattern: /\bPart[\s._-]*(\d+)/i, confidence: 0.70, name: 'Part N' },
  // Trailing number (lowest confidence)
  { pattern: /[\s._-](\d{1,3})$/i, confidence: 0.60, name: 'trailing' },
];

/**
 * Release group patterns (in brackets)
 */
const GROUP_PATTERNS: Array<{ pattern: RegExp; confidence: number; name: string }> = [
  { pattern: /\[([^\]]+)\]/, confidence: 0.90, name: '[Group]' },
  { pattern: /\(([A-Za-z][A-Za-z0-9\s-]+)\)/, confidence: 0.75, name: '(Group)' },
];

/**
 * Language indicator patterns
 */
const LANGUAGE_PATTERNS: Array<{ pattern: RegExp; language: string; confidence: number }> = [
  { pattern: /\b(?:English|ENG?)\b/i, language: 'en', confidence: 0.95 },
  { pattern: /\b(?:Japanese|JPN?)\b/i, language: 'ja', confidence: 0.95 },
  { pattern: /\b(?:Spanish|SPA?|ESP)\b/i, language: 'es', confidence: 0.95 },
  { pattern: /\b(?:French|FRE?|FRA)\b/i, language: 'fr', confidence: 0.95 },
  { pattern: /\b(?:German|GER?|DEU)\b/i, language: 'de', confidence: 0.95 },
  { pattern: /\b(?:Chinese|CHI?|ZH)\b/i, language: 'zh', confidence: 0.95 },
  { pattern: /\b(?:Korean|KOR?|KO)\b/i, language: 'ko', confidence: 0.95 },
  { pattern: /\b(?:Portuguese|POR?|PT)\b/i, language: 'pt', confidence: 0.95 },
  { pattern: /\b(?:Italian|ITA?)\b/i, language: 'it', confidence: 0.95 },
  { pattern: /\b(?:Russian|RUS?)\b/i, language: 'ru', confidence: 0.95 },
];

/**
 * Quality/Format indicator patterns
 */
const QUALITY_PATTERNS: RegExp[] = [
  /\b(?:HQ|High[\s-]?Quality)\b/i,
  /\b(?:LQ|Low[\s-]?Quality)\b/i,
  /\b(?:Digital|Scan|Raw)\b/i,
  /\b(?:Official|Fan[\s-]?Trans(?:lation)?)\b/i,
  /\b(?:Colored?|B&W|Black[\s-]?(?:and[\s-]?)?White)\b/i,
  /\b(?:Tankobon|Magazine|Web[\s-]?Rip)\b/i,
];

/**
 * Extract volume number from filename
 */
export function extractVolumeNumber(filename: string): PatternMatch | null {
  for (const { pattern, confidence, name } of VOLUME_PATTERNS) {
    const match = pattern.exec(filename);
    if (match?.[1]) {
      return {
        type: 'VOLUME',
        value: parseInt(match[1], 10),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        pattern: name,
        confidence,
      };
    }
  }
  return null;
}

/**
 * Extract chapter number from filename
 */
export function extractChapterNumber(filename: string): PatternMatch | null {
  for (const { pattern, confidence, name } of CHAPTER_PATTERNS) {
    const match = pattern.exec(filename);
    if (match?.[1]) {
      return {
        type: 'CHAPTER',
        value: parseFloat(match[1]),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        pattern: name,
        confidence,
      };
    }
  }
  return null;
}

/**
 * Extract release group from filename
 */
export function extractGroup(filename: string): PatternMatch | null {
  for (const { pattern, confidence, name } of GROUP_PATTERNS) {
    const match = pattern.exec(filename);
    if (match?.[1]) {
      // Filter out common false positives
      const group = match[1].trim();
      const falsePositives = ['Vol', 'Volume', 'Ch', 'Chapter', 'v', 'c', 'Digital', 'HQ', 'LQ'];
      if (falsePositives.some(fp => group.toLowerCase().startsWith(fp.toLowerCase()))) {
        continue;
      }
      return {
        type: 'GROUP',
        value: group,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        pattern: name,
        confidence,
      };
    }
  }
  return null;
}

/**
 * Extract language indicator from filename
 */
export function extractLanguage(filename: string): PatternMatch | null {
  for (const { pattern, language, confidence } of LANGUAGE_PATTERNS) {
    const match = pattern.exec(filename);
    if (match) {
      return {
        type: 'LANGUAGE',
        value: language,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        pattern: language,
        confidence,
      };
    }
  }
  return null;
}

/**
 * Extract title from filename by removing known patterns
 */
export function extractTitle(filename: string): PatternMatch | null {
  // Remove file extension
  let title = filename.replace(/\.[^.]+$/, '');

  // Remove bracketed content (groups, quality, etc.)
  title = title.replace(/\[[^\]]+\]/g, '');
  title = title.replace(/\([^)]+\)/g, '');

  // Remove volume/chapter patterns
  for (const { pattern } of VOLUME_PATTERNS) {
    title = title.replace(pattern, '');
  }
  for (const { pattern } of CHAPTER_PATTERNS) {
    title = title.replace(pattern, '');
  }

  // Remove quality patterns
  for (const pattern of QUALITY_PATTERNS) {
    title = title.replace(pattern, '');
  }

  // Clean up separators and whitespace
  title = title
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (title.length < 2) {
    return null;
  }

  return {
    type: 'TITLE',
    value: title,
    startIndex: 0,
    endIndex: filename.length,
    pattern: 'extracted',
    confidence: 0.70,
  };
}

/**
 * Parse all patterns from a filename
 */
export function parseFilename(filename: string): PatternMatch[] {
  const matches: PatternMatch[] = [];

  const volumeMatch = extractVolumeNumber(filename);
  if (volumeMatch) matches.push(volumeMatch);

  const chapterMatch = extractChapterNumber(filename);
  if (chapterMatch) matches.push(chapterMatch);

  const groupMatch = extractGroup(filename);
  if (groupMatch) matches.push(groupMatch);

  const languageMatch = extractLanguage(filename);
  if (languageMatch) matches.push(languageMatch);

  const titleMatch = extractTitle(filename);
  if (titleMatch) matches.push(titleMatch);

  return matches;
}

/**
 * Check if filename indicates a volume (multi-chapter archive)
 */
export function isLikelyVolume(filename: string, fileSize: number): { isVolume: boolean; confidence: number } {
  const volumeMatch = extractVolumeNumber(filename);
  const chapterMatch = extractChapterNumber(filename);

  // If explicit volume pattern found without chapter
  if (volumeMatch && !chapterMatch) {
    return { isVolume: true, confidence: volumeMatch.confidence };
  }

  // If both volume and chapter, it's a specific chapter in a volume
  if (volumeMatch && chapterMatch) {
    return { isVolume: false, confidence: 0.85 };
  }

  // Size-based heuristic: volumes are typically > 50MB
  const SIZE_THRESHOLD = 50 * 1024 * 1024; // 50MB
  if (fileSize > SIZE_THRESHOLD && !chapterMatch) {
    return { isVolume: true, confidence: 0.70 };
  }

  // If only chapter pattern, not a volume
  if (chapterMatch) {
    return { isVolume: false, confidence: chapterMatch.confidence };
  }

  // Unknown
  return { isVolume: false, confidence: 0.50 };
}

/**
 * Check if path indicates a folder structure
 */
export function detectFolderStructure(paths: string[]): 'VOLUME_FOLDERS' | 'CHAPTER_FOLDERS' | 'FLAT_FILES' | 'NESTED_MIXED' {
  const volumeFolders = new Set<number>();
  const chapterFolders = new Set<number>();
  let hasNestedFolders = false;

  for (const path of paths) {
    const parts = path.split(/[/\\]/);

    for (const part of parts) {
      const volumeMatch = extractVolumeNumber(part);
      if (volumeMatch) {
        volumeFolders.add(volumeMatch.value as number);
      }

      const chapterMatch = extractChapterNumber(part);
      if (chapterMatch) {
        chapterFolders.add(chapterMatch.value as number);
      }
    }

    if (parts.length > 2) {
      hasNestedFolders = true;
    }
  }

  if (volumeFolders.size > 1) {
    return 'VOLUME_FOLDERS';
  }

  if (chapterFolders.size > 1) {
    return 'CHAPTER_FOLDERS';
  }

  if (hasNestedFolders) {
    return 'NESTED_MIXED';
  }

  return 'FLAT_FILES';
}

/**
 * Group files by detected volume number
 */
export function groupByVolume(files: Array<{ path: string; filename: string }>): Map<number, typeof files> {
  const groups = new Map<number, typeof files>();

  for (const file of files) {
    // Check path for volume indicator
    const pathParts = file.path.split(/[/\\]/);
    let volumeNumber: number | null = null;

    for (const part of pathParts) {
      const match = extractVolumeNumber(part);
      if (match) {
        volumeNumber = match.value as number;
        break;
      }
    }

    // Fallback to filename
    if (volumeNumber === null) {
      const filenameMatch = extractVolumeNumber(file.filename);
      if (filenameMatch) {
        volumeNumber = filenameMatch.value as number;
      }
    }

    // Default to volume 0 (unassigned)
    const vol = volumeNumber ?? 0;

    if (!groups.has(vol)) {
      groups.set(vol, []);
    }
    const volGroup = groups.get(vol);
    if (volGroup) {
      volGroup.push(file);
    }
  }

  return groups;
}

/**
 * Group files by detected chapter number
 */
export function groupByChapter(files: Array<{ path: string; filename: string }>): Map<number, typeof files> {
  const groups = new Map<number, typeof files>();

  for (const file of files) {
    // Check path for chapter indicator
    const pathParts = file.path.split(/[/\\]/);
    let chapterNumber: number | null = null;

    for (const part of pathParts) {
      const match = extractChapterNumber(part);
      if (match) {
        chapterNumber = match.value as number;
        break;
      }
    }

    // Fallback to filename
    if (chapterNumber === null) {
      const filenameMatch = extractChapterNumber(file.filename);
      if (filenameMatch) {
        chapterNumber = filenameMatch.value as number;
      }
    }

    // Default to chapter 0 (unassigned)
    const ch = chapterNumber ?? 0;

    if (!groups.has(ch)) {
      groups.set(ch, []);
    }
    const chGroup = groups.get(ch);
    if (chGroup) {
      chGroup.push(file);
    }
  }

  return groups;
}
