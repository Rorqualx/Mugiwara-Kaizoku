/**
 * Metadata Extractor Utilities
 *
 * Helper functions, field mappings, and text processing utilities
 * for metadata extraction operations.
 *
 * Extracted from: MetadataExtractor.ts (lines 88-230, 588-808)
 */

import { isRecord, isString, isArray } from '@/utils/type-guards/index';

import type { ExtractedMetadata, FieldMapping } from './types';

/**
 * Clean title by removing wiki suffixes
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*\|.*$/, '') // Remove wiki pipe suffixes
    .replace(/\s*-\s*Wikipedia.*$/, '') // Remove Wikipedia suffix
    .replace(/\s*Wiki\s*$/, '') // Remove Wiki suffix
    .trim();
}

/**
 * Split names by common delimiters
 */
export function splitNames(value: string): string[] {
  return value
    .split(/[,;&]|\sand\s/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Split multi-value strings
 */
export function splitMultiValue(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Split genres by common delimiters
 */
export function splitGenres(value: string): string[] {
  return value
    .split(/[,;/]/)
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0);
}

/**
 * Clean publisher by removing parenthetical info
 */
export function cleanPublisher(value: string): string {
  return value.replace(/\([^)]+\)/g, '').trim();
}

/**
 * Normalize demographic value
 */
export function normalizeDemographic(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes('shonen') || lower.includes('shounen')) return 'Shounen';
  if (lower.includes('shojo') || lower.includes('shoujo')) return 'Shoujo';
  if (lower.includes('seinen')) return 'Seinen';
  if (lower.includes('josei')) return 'Josei';
  if (lower.includes('kodomo')) return 'Kodomomuke';
  return value;
}

/**
 * Normalize status value
 */
export function normalizeStatus(value: string): ExtractedMetadata['status'] {
  const lower = value.toLowerCase();
  if (lower.includes('ongoing') || lower.includes('running') || lower.includes('publishing')) {
    return 'ONGOING';
  }
  if (lower.includes('completed') || lower.includes('finished') || lower.includes('ended')) {
    return 'COMPLETED';
  }
  if (lower.includes('hiatus') || lower.includes('paused')) {
    return 'HIATUS';
  }
  if (lower.includes('cancelled') || lower.includes('canceled') || lower.includes('discontinued')) {
    return 'CANCELLED';
  }
  if (lower.includes('not yet') || lower.includes('upcoming') || lower.includes('announced')) {
    return 'NOT_YET_RELEASED';
  }
  return 'ONGOING';
}

/**
 * Normalize date value
 */
export function normalizeDate(value: string): string {
  // Handle date ranges - return as-is for now
  const rangeMatch = value.match(
    /(\d{4}|\w+\s+\d{4})\s*[-–]\s*(present|ongoing|\d{4}|\w+\s+\d{4})/i
  );
  if (rangeMatch) {
    return value;
  }
  return value;
}

/**
 * Extract date from value
 */
export function extractDate(value: string): string {
  // Try to extract year
  const yearMatch = value.match(/\d{4}/);
  if (yearMatch) {
    return yearMatch[0];
  }
  return value;
}

/**
 * Extract number from value
 */
export function extractNumber(value: string): number | undefined {
  const match = value.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return undefined;
}

/**
 * Extract URL from value
 */
export function extractUrl(value: string): string {
  const urlMatch = value.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/);
  if (urlMatch) {
    return urlMatch[0];
  }
  return value;
}

/**
 * Extract ISBNs from value
 */
export function extractISBNs(value: string): string[] {
  const isbns: string[] = [];
  const matches = value.matchAll(/[\d-]{10,17}/g);
  for (const match of matches) {
    const isbn = match[0].replace(/-/g, '');
    if (isbn.length === 10 || isbn.length === 13) {
      isbns.push(isbn);
    }
  }
  return isbns;
}

/**
 * Field mappings for different wiki formats
 */
export const fieldMappings: FieldMapping[] = [
  // Title mappings
  {
    fields: ['name', 'title', 'english', 'english title', 'english name'],
    target: 'title',
    processor: (value) => cleanTitle(value),
  },
  {
    fields: ['japanese', 'japanese title', 'kanji', '日本語'],
    target: 'japaneseTitle',
    processor: (value) => value.trim(),
  },
  {
    fields: ['romaji', 'rōmaji', 'romanized', 'romanization'],
    target: 'romajiTitle',
    processor: (value) => value.trim(),
  },
  {
    fields: ['also known as', 'other names', 'alternate names', 'alternative names'],
    target: 'alternativeTitles',
    processor: (value) => splitMultiValue(value),
    multi: true,
  },
  // Creator mappings
  {
    fields: ['author', 'writer', 'story', 'written by', 'story by', '作者', 'auteur', 'autor'],
    target: 'author',
    processor: (value) => splitNames(value),
    multi: true,
  },
  {
    fields: [
      'artist',
      'illustrator',
      'art',
      'illustrated by',
      'art by',
      'drawn by',
      '画家',
      'dessinateur',
    ],
    target: 'artist',
    processor: (value) => splitNames(value),
    multi: true,
  },
  {
    fields: ['original creator', 'original author', 'based on', 'original work'],
    target: 'originalCreator',
    processor: (value) => splitNames(value),
    multi: true,
  },
  // Publisher mappings
  {
    fields: ['publisher', 'published by', 'english publisher', 'us publisher', 'na publisher'],
    target: 'publisher',
    processor: (value) => cleanPublisher(value),
  },
  {
    fields: ['japanese publisher', 'jp publisher', 'original publisher'],
    target: 'japanesePublisher',
    processor: (value) => cleanPublisher(value),
  },
  {
    fields: ['magazine', 'serialized in', 'serialization', 'published in', 'magazine serialization'],
    target: 'magazine',
    processor: (value) => value.trim(),
  },
  {
    fields: ['imprint', 'label'],
    target: 'imprint',
    processor: (value) => value.trim(),
  },
  // Demographics & Genres
  {
    fields: ['demographic', 'target', 'target demographic', 'audience'],
    target: 'demographic',
    processor: (value) => normalizeDemographic(value),
  },
  {
    fields: ['genre', 'genres', 'category', 'categories'],
    target: 'genres',
    processor: (value) => splitGenres(value),
    multi: true,
  },
  {
    fields: ['theme', 'themes', 'tags'],
    target: 'themes',
    processor: (value) => splitMultiValue(value),
    multi: true,
  },
  // Status & Dates
  {
    fields: ['status', 'publication status', 'serialization status', 'state'],
    target: 'status',
    processor: (value) => normalizeStatus(value),
  },
  {
    fields: ['original run', 'published', 'publication date', 'run', 'aired', 'released'],
    target: 'originalRun',
    processor: (value) => normalizeDate(value),
  },
  {
    fields: ['start date', 'first published', 'began', 'started'],
    target: 'startDate',
    processor: (value) => extractDate(value),
  },
  {
    fields: ['end date', 'last published', 'ended', 'finished'],
    target: 'endDate',
    processor: (value) => extractDate(value),
  },
  // Counts
  {
    fields: ['volumes', 'no. of volumes', 'volume count', 'total volumes', 'tankōbon'],
    target: 'volumes',
    processor: (value) => extractNumber(value),
  },
  {
    fields: ['chapters', 'no. of chapters', 'chapter count', 'total chapters'],
    target: 'chapters',
    processor: (value) => extractNumber(value),
  },
  {
    fields: ['episodes', 'no. of episodes', 'episode count', 'total episodes'],
    target: 'episodes',
    processor: (value) => extractNumber(value),
  },
  // Additional
  {
    fields: ['website', 'official website', 'official site', 'web', 'url'],
    target: 'website',
    processor: (value) => extractUrl(value),
  },
  {
    fields: ['isbn', 'isbn-10', 'isbn-13', 'isbn number'],
    target: 'isbn',
    processor: (value) => extractISBNs(value),
    multi: true,
  },
  {
    fields: ['language', 'original language', 'lang'],
    target: 'language',
    processor: (value) => value.trim(),
  },
  {
    fields: ['country', 'country of origin', 'origin'],
    target: 'country',
    processor: (value) => value.trim(),
  },
];

/**
 * Find field mapping for a label
 */
export function findFieldMapping(label: string): FieldMapping | null {
  const normalizedLabel = label.toLowerCase().trim();
  for (const mapping of fieldMappings) {
    if (
      mapping.fields.some((field) => normalizedLabel === field || normalizedLabel.includes(field))
    ) {
      return mapping;
    }
  }
  return null;
}

/**
 * Extract persons from schema.org data (supports string, array, or object)
 */
export function extractPersons(data: unknown): string[] {
  if (isString(data)) {
    return splitNames(data);
  }
  if (isArray(data)) {
    return data
      .map((item: unknown) => {
        if (isString(item)) return item;
        if (isRecord(item)) {
          const name = item['name'];
          if (isString(name)) return name;
        }
        return '';
      })
      .filter((name) => name.length > 0);
  }
  if (isRecord(data)) {
    const name = data['name'];
    if (isString(name)) {
      return [name];
    }
  }
  return [];
}

/**
 * Clean text by removing wiki references and normalizing whitespace
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\[.*?]/g, '') // Remove wiki references
    .trim();
}

/**
 * Check if a status value is valid
 */
export function isValidStatus(status: string): boolean {
  return ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED', 'NOT_YET_RELEASED'].includes(status);
}

/**
 * Normalize genres to standard format
 */
export function normalizeGenres(genres: string[]): string[] {
  const normalizedSet = new Set<string>();
  const genreMap: Record<string, string> = {
    'sci-fi': 'Science Fiction',
    scifi: 'Science Fiction',
    'science fiction': 'Science Fiction',
    shonen: 'Shounen',
    shounen: 'Shounen',
    shojo: 'Shoujo',
    shoujo: 'Shoujo',
  };
  for (const genre of genres) {
    const lower = genre.toLowerCase().trim();
    const normalized =
      genreMap[lower] ??
      genre
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    if (!['N/A', 'TBD', 'Unknown Genre'].includes(normalized)) {
      normalizedSet.add(normalized);
    }
  }
  return Array.from(normalizedSet);
}

/**
 * Extract a number range from text (e.g., "1-10")
 */
export function extractNumberRange(text: string): { start: number; end: number } | null {
  const match = text.match(/(\d+)\s*-\s*(\d+)/);
  if (match?.[1] && match[2]) {
    return {
      start: parseInt(match[1], 10),
      end: parseInt(match[2], 10),
    };
  }
  return null;
}

/**
 * Validate metadata object and return only valid fields
 */
export function validateMetadata(metadata: unknown): ExtractedMetadata {
  const validated: ExtractedMetadata = {};

  if (!isRecord(metadata)) {
    return validated;
  }

  // Validate and copy only valid fields
  const title = metadata['title'];
  if (isString(title) && title.trim()) {
    validated.title = title;
  }

  const author = metadata['author'];
  if (isArray(author) && author.length > 0) {
    const validAuthors = author.filter(isString);
    if (validAuthors.length > 0) {
      validated.author = validAuthors;
    }
  }

  const volumes = metadata['volumes'];
  if (typeof volumes === 'number' && volumes > 0 && volumes < 10000) {
    validated.volumes = volumes;
  }

  const chapters = metadata['chapters'];
  if (typeof chapters === 'number' && chapters > 0 && chapters < 100000) {
    validated.chapters = chapters;
  }

  const status = metadata['status'];
  if (isString(status) && isValidStatus(status)) {
    validated.status = status as 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | 'NOT_YET_RELEASED';
  }

  return validated;
}

/**
 * Check if a date string is valid
 */
export function isValidDate(date: string): boolean {
  if (!date) return false;
  // Try to parse the date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return false;
  // Check if it's not in the future
  const now = new Date();
  if (parsed > now) return false;
  // Check if it's not too far in the past (e.g., before 1900)
  const minDate = new Date('1900-01-01');
  if (parsed < minDate) return false;
  return true;
}

/**
 * Parse original run string to extract start and end dates
 */
export function parseOriginalRun(run: string): { start?: string; end?: string } {
  const match = run.match(/(\d{4}|\w+\s+\d{4})\s*[-–]\s*(present|ongoing|\d{4}|\w+\s+\d{4})/i);
  if (match?.[1]) {
    const result: { start?: string; end?: string } = {};
    result.start = match[1];
    if (match[2] && !/(present|ongoing)/i.test(match[2])) {
      result.end = match[2];
    }
    return result;
  }
  return {};
}
