/**
 * Training Data Sampler
 *
 * Loads training data from CSV and provides stratified sampling
 * for iterative labeling improvement.
 *
 * @module auto-labeling/sampler
 */

import { readFileSync } from 'fs';

import { createLogger } from '@/utils/logger';

import { isDiscoveredUrlType } from './types';

import type {
  TrainingDataRow,
  TrainingEntry,
  DiscoveredUrl,
  DiscoveredUrlType,
  SamplingFilters,
  SampledPage,
} from './types';

const logger = createLogger('auto-labeling:sampler');

// ============================================================================
// CSV Loading
// ============================================================================

/**
 * Load training data from CSV file.
 */
export function loadTrainingData(
  csvPath: string = 'ml-training-pages-full.csv'
): TrainingEntry[] {
  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length < 2) {
    logger.warn('CSV file is empty or has no data rows');
    return [];
  }

  // Parse header row
  const headerLine = lines[0];
  if (!headerLine) {
    logger.warn('CSV file has no header row');
    return [];
  }
  const headers = parseCSVLine(headerLine);

  // Build column index map
  const columnIndex: Record<string, number> = {};
  headers.forEach((header, idx) => {
    columnIndex[header.trim()] = idx;
  });

  // Parse data rows
  const entries: TrainingEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row = buildTrainingRow(values, columnIndex);
    const entry = parseTrainingRow(row);
    if (entry) {
      entries.push(entry);
    }
  }

  logger.info('Loaded training data', {
    totalEntries: entries.length,
    withAnilistId: entries.filter(e => e.anilistId !== null).length,
    withFandomUrls: entries.filter(e => e.fandomDiscoveredUrls.length > 0).length,
    withWikipediaUrls: entries.filter(e => e.wikipediaDiscoveredUrls.length > 0).length,
  });

  return entries;
}

/**
 * Parse a CSV line handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Build a TrainingDataRow from parsed values.
 */
function buildTrainingRow(values: string[], columnIndex: Record<string, number>): TrainingDataRow {
  const getColumn = (name: string): string => {
    const idx = columnIndex[name];
    return idx !== undefined ? (values[idx] ?? '') : '';
  };

  return {
    Title: getColumn('Title'),
    AniListID: getColumn('AniListID'),
    WikipediaURL: getColumn('WikipediaURL'),
    FandomURL: getColumn('FandomURL'),
    ComicVineID: getColumn('ComicVineID'),
    FandomDiscoveredURLs: getColumn('FandomDiscoveredURLs'),
    WikipediaDiscoveredURLs: getColumn('WikipediaDiscoveredURLs'),
    ComicVineDiscoveredURLs: getColumn('ComicVineDiscoveredURLs'),
  };
}

/**
 * Parse a single CSV row into a TrainingEntry.
 */
function parseTrainingRow(row: TrainingDataRow): TrainingEntry | null {
  try {
    const anilistId = parseAnilistId(row.AniListID);

    return {
      title: row.Title,
      anilistId,
      wikipediaUrl: parseOptionalUrl(row.WikipediaURL),
      fandomUrl: parseOptionalUrl(row.FandomURL),
      comicVineId: parseOptionalId(row.ComicVineID),
      fandomDiscoveredUrls: parseDiscoveredUrls(row.FandomDiscoveredURLs),
      wikipediaDiscoveredUrls: parseDiscoveredUrls(row.WikipediaDiscoveredURLs),
      comicVineDiscoveredUrls: parseDiscoveredUrls(row.ComicVineDiscoveredURLs),
    };
  } catch (error) {
    logger.warn('Failed to parse training row', { title: row.Title, error });
    return null;
  }
}

/**
 * Parse AniList ID from string.
 */
function parseAnilistId(value: string): number | null {
  if (!value || value === 'DOES_NOT_EXIST' || value.trim() === '') {
    return null;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse optional URL, returning null for non-existent URLs.
 */
function parseOptionalUrl(value: string): string | null {
  if (!value || value === 'DOES_NOT_EXIST' || value.trim() === '') {
    return null;
  }
  return value;
}

/**
 * Parse optional ID string.
 */
function parseOptionalId(value: string): string | null {
  if (!value || value === 'DOES_NOT_EXIST' || value.trim() === '') {
    return null;
  }
  return value;
}

// ============================================================================
// Discovered URL Parsing
// ============================================================================

/**
 * Parse discovered URLs string into structured format.
 * Format: TYPE1:url1|TYPE2:url2|CATEGORY:Name:url3
 */
export function parseDiscoveredUrls(urlsString: string): DiscoveredUrl[] {
  if (!urlsString || urlsString.trim() === '') {
    return [];
  }

  const urls: DiscoveredUrl[] = [];
  const parts = urlsString.split('|');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const parsed = parseDiscoveredUrlPart(trimmed);
    if (parsed) {
      urls.push(parsed);
    }
  }

  return urls;
}

/**
 * Parse a single discovered URL part.
 */
function parseDiscoveredUrlPart(part: string): DiscoveredUrl | null {
  // Handle CATEGORY:Name:url format
  if (part.startsWith('CATEGORY:')) {
    return parseCategoryUrl(part);
  }

  // Handle TYPE:url format
  return parseTypedUrl(part);
}

/**
 * Parse CATEGORY: format URLs.
 */
function parseCategoryUrl(part: string): DiscoveredUrl | null {
  const rest = part.substring('CATEGORY:'.length);
  const colonIndex = rest.indexOf(':http');

  if (colonIndex > 0) {
    return {
      type: 'CATEGORY',
      categoryName: rest.substring(0, colonIndex),
      url: rest.substring(colonIndex + 1),
    };
  }

  // Single colon - just CATEGORY:url
  const simpleColonIndex = rest.indexOf(':');
  if (simpleColonIndex > 0 && rest.substring(simpleColonIndex + 1).startsWith('http')) {
    return {
      type: 'CATEGORY',
      categoryName: rest.substring(0, simpleColonIndex),
      url: rest.substring(simpleColonIndex + 1),
    };
  }

  // Fallback: treat rest as URL
  if (rest.startsWith('http')) {
    return { type: 'CATEGORY', url: rest };
  }

  return null;
}

/**
 * Parse TYPE:url format URLs.
 * Handles both "TYPE:https://url" and plain "https://url" formats.
 */
function parseTypedUrl(part: string): DiscoveredUrl | null {
  // Check if this is a plain URL (starts with http:// or https://)
  if (part.startsWith('http://') || part.startsWith('https://')) {
    // Plain URL without type prefix - treat as MANGA_PAGE for main wiki URLs
    return { type: 'MANGA_PAGE', url: part };
  }

  const colonIndex = part.indexOf(':');

  if (colonIndex <= 0) {
    return null;
  }

  const typeStr = part.substring(0, colonIndex);
  const url = part.substring(colonIndex + 1);

  if (!url.startsWith('http')) {
    return null;
  }

  // Map type string to DiscoveredUrlType
  const type = mapToDiscoveredUrlType(typeStr);
  return { type, url };
}

/**
 * Map a type string to DiscoveredUrlType.
 */
function mapToDiscoveredUrlType(typeStr: string): DiscoveredUrlType {
  const normalized = typeStr.toUpperCase();
  if (isDiscoveredUrlType(normalized)) {
    return normalized;
  }
  // Handle variations
  if (normalized === 'CHAPTER') return 'CHAPTERS';
  if (normalized === 'VOLUME') return 'VOLUMES';
  if (normalized === 'ARC') return 'ARCS';
  if (normalized === 'GALLERY') return 'GALLERY_SECTION';
  return 'OTHER';
}

// ============================================================================
// Sampling
// ============================================================================

/**
 * Sample pages from training data with stratified sampling.
 */
export function samplePages(
  entries: TrainingEntry[],
  count: number,
  filters?: SamplingFilters,
  seed?: number
): SampledPage[] {
  // Apply filters
  const filtered = applyFilters(entries, filters);

  if (filtered.length === 0) {
    logger.warn('No entries match the sampling filters');
    return [];
  }

  // Convert to sampled pages (expand entries with multiple URLs)
  // Pass urlTypes filter to only expand URLs of the desired type
  const allPages = expandToPages(
    filtered,
    filters?.sources ?? ['fandom'],
    filters?.urlTypes
  );

  if (allPages.length === 0) {
    logger.warn('No pages available after expansion');
    return [];
  }

  // Shuffle with optional seed
  const shuffled = shuffleWithSeed(allPages, seed);

  // Take requested count
  const sampled = shuffled.slice(0, Math.min(count, shuffled.length));

  logger.info('Sampled pages', {
    requested: count,
    available: allPages.length,
    sampled: sampled.length,
  });

  return sampled;
}

/**
 * Apply filters to training entries.
 */
function applyFilters(entries: TrainingEntry[], filters?: SamplingFilters): TrainingEntry[] {
  if (!filters) return entries;

  return entries.filter(entry => matchesFilters(entry, filters));
}

/**
 * Check if an entry matches all filters.
 */
function matchesFilters(entry: TrainingEntry, filters: SamplingFilters): boolean {
  // Require AniList ID
  if (filters.requireAnilistId && entry.anilistId === null) {
    return false;
  }

  // Require Fandom URLs
  if (filters.requireFandomUrls && entry.fandomDiscoveredUrls.length === 0) {
    return false;
  }

  // Require Wikipedia URLs
  if (filters.requireWikipediaUrls && entry.wikipediaDiscoveredUrls.length === 0) {
    return false;
  }

  // Filter by URL types
  if (filters.urlTypes && filters.urlTypes.length > 0) {
    if (!hasMatchingUrlType(entry, filters.urlTypes)) {
      return false;
    }
  }

  // Exclude specific AniList IDs
  if (filters.excludeAnilistIds && entry.anilistId !== null) {
    if (filters.excludeAnilistIds.includes(entry.anilistId)) {
      return false;
    }
  }

  // Include ONLY specific AniList IDs (for targeted iterations)
  if (filters.includeAnilistIds && filters.includeAnilistIds.length > 0) {
    if (entry.anilistId === null || !filters.includeAnilistIds.includes(entry.anilistId)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if entry has any matching URL type.
 */
function hasMatchingUrlType(entry: TrainingEntry, urlTypes: DiscoveredUrlType[]): boolean {
  const allUrls = [
    ...entry.fandomDiscoveredUrls,
    ...entry.wikipediaDiscoveredUrls,
    ...entry.comicVineDiscoveredUrls,
  ];
  return allUrls.some(u => urlTypes.includes(u.type));
}

/**
 * Expand entries into individual sampled pages.
 * @param entries - Training entries to expand
 * @param sources - Sources to include
 * @param urlTypes - Optional URL types filter - only include URLs of these types
 */
function expandToPages(
  entries: TrainingEntry[],
  sources: Array<'fandom' | 'wikipedia' | 'comicvine'>,
  urlTypes?: DiscoveredUrlType[]
): SampledPage[] {
  const pages: SampledPage[] = [];

  for (const entry of entries) {
    if (entry.anilistId === null) continue;
    const entryPages = expandEntryToPages(entry, sources, urlTypes);
    pages.push(...entryPages);
  }

  return pages;
}

/**
 * Expand a single entry into sampled pages.
 */
function expandEntryToPages(
  entry: TrainingEntry,
  sources: Array<'fandom' | 'wikipedia' | 'comicvine'>,
  urlTypes?: DiscoveredUrlType[]
): SampledPage[] {
  if (entry.anilistId === null) return [];

  const pages: SampledPage[] = [];

  for (const source of sources) {
    const sourcePages = getSourcePages(entry, source, urlTypes);
    pages.push(...sourcePages);
  }

  return pages;
}

/**
 * Get pages for a specific source.
 * @param entry - Training entry
 * @param source - Source to get pages from
 * @param urlTypes - Optional URL types filter - only include URLs of these types
 */
function getSourcePages(
  entry: TrainingEntry,
  source: 'fandom' | 'wikipedia' | 'comicvine',
  urlTypes?: DiscoveredUrlType[]
): SampledPage[] {
  if (entry.anilistId === null) return [];

  const { discoveredUrls, baseUrl } = getSourceData(entry, source);

  // Filter discovered URLs by type if urlTypes filter is provided
  const filteredUrls = urlTypes && urlTypes.length > 0
    ? discoveredUrls.filter(u => urlTypes.includes(u.type))
    : discoveredUrls;

  return filteredUrls.map(discovered => ({
    id: `${entry.anilistId}-${source}-${discovered.type}`,
    title: entry.title,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Checked by filter before this function
    anilistId: entry.anilistId!,
    source,
    url: discovered.url,
    urlType: discovered.type,
    baseUrl,
  }));
}

/**
 * Get discovered URLs and base URL for a source.
 */
function getSourceData(
  entry: TrainingEntry,
  source: 'fandom' | 'wikipedia' | 'comicvine'
): { discoveredUrls: DiscoveredUrl[]; baseUrl: string | null } {
  switch (source) {
    case 'fandom':
      return { discoveredUrls: entry.fandomDiscoveredUrls, baseUrl: entry.fandomUrl };
    case 'wikipedia':
      return { discoveredUrls: entry.wikipediaDiscoveredUrls, baseUrl: entry.wikipediaUrl };
    case 'comicvine':
    default:
      return { discoveredUrls: entry.comicVineDiscoveredUrls, baseUrl: null };
  }
}

/**
 * Shuffle array with optional seed for reproducibility.
 */
function shuffleWithSeed<T>(array: T[], seed?: number): T[] {
  const shuffled = [...array];
  const rng = seed !== undefined ? createSeededRng(seed) : Math.random;

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    // Safe swap - indices are always valid for copied array
    const temp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp;
  }

  return shuffled;
}

/**
 * Create a seeded random number generator (Mulberry32).
 */
function createSeededRng(seed: number): () => number {
  let state = seed;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// Source Filtering
// ============================================================================

/**
 * Filter entries by source availability.
 */
export function filterBySource(
  entries: TrainingEntry[],
  source: 'fandom' | 'wikipedia' | 'comicvine'
): TrainingEntry[] {
  return entries.filter(entry => {
    switch (source) {
      case 'fandom':
        return entry.fandomDiscoveredUrls.length > 0;
      case 'wikipedia':
        return entry.wikipediaDiscoveredUrls.length > 0;
      case 'comicvine':
      default:
        return entry.comicVineDiscoveredUrls.length > 0;
    }
  });
}

/**
 * Get statistics about the training data.
 */
export function getTrainingDataStats(entries: TrainingEntry[]): {
  total: number;
  withAnilistId: number;
  withFandomUrls: number;
  withWikipediaUrls: number;
  withComicVineUrls: number;
  urlTypeDistribution: Record<DiscoveredUrlType, number>;
} {
  const urlTypeCounts = countUrlTypes(entries);

  return {
    total: entries.length,
    withAnilistId: entries.filter(e => e.anilistId !== null).length,
    withFandomUrls: entries.filter(e => e.fandomDiscoveredUrls.length > 0).length,
    withWikipediaUrls: entries.filter(e => e.wikipediaDiscoveredUrls.length > 0).length,
    withComicVineUrls: entries.filter(e => e.comicVineDiscoveredUrls.length > 0).length,
    urlTypeDistribution: urlTypeCounts,
  };
}

/**
 * Count URL types across all entries.
 */
function countUrlTypes(entries: TrainingEntry[]): Record<DiscoveredUrlType, number> {
  const counts: Record<DiscoveredUrlType, number> = {
    CHAPTERS: 0,
    VOLUMES: 0,
    CHAPTERS_VOLUMES: 0,
    MANGA_PAGE: 0,
    ARCS: 0,
    CATEGORY: 0,
    GALLERY_SECTION: 0,
    OTHER: 0,
  };

  for (const entry of entries) {
    const allUrls = [
      ...entry.fandomDiscoveredUrls,
      ...entry.wikipediaDiscoveredUrls,
      ...entry.comicVineDiscoveredUrls,
    ];
    for (const url of allUrls) {
      counts[url.type]++;
    }
  }

  return counts;
}

// ============================================================================
// Unique Page Sampling
// ============================================================================

/**
 * Sample unique manga titles, avoiding duplicates from multiple URL types.
 */
export function sampleUniqueTitles(
  entries: TrainingEntry[],
  count: number,
  filters?: SamplingFilters,
  seed?: number
): SampledPage[] {
  // Apply filters
  const filtered = applyFilters(entries, filters);
  if (filtered.length === 0) return [];

  // Shuffle entries (not pages) to ensure unique titles
  const shuffled = shuffleWithSeed(filtered, seed);

  // Take first N entries and convert to pages (preferring CHAPTERS_VOLUMES > VOLUMES > CHAPTERS)
  const sampled: SampledPage[] = [];
  const sources = filters?.sources ?? ['fandom'];

  for (const entry of shuffled) {
    if (sampled.length >= count) break;
    if (entry.anilistId === null) continue;

    // Find best URL for this entry
    const page = findBestPageForEntry(entry, sources);
    if (page) {
      sampled.push(page);
    }
  }

  return sampled;
}

/** Priority order for URL types. */
const URL_TYPE_PRIORITY: DiscoveredUrlType[] = [
  'CHAPTERS_VOLUMES',
  'VOLUMES',
  'CHAPTERS',
  'MANGA_PAGE',
  'CATEGORY',
  'ARCS',
  'GALLERY_SECTION',
  'OTHER',
];

/**
 * Find the best page for an entry based on URL type priority.
 */
function findBestPageForEntry(
  entry: TrainingEntry,
  sources: Array<'fandom' | 'wikipedia' | 'comicvine'>
): SampledPage | null {
  if (entry.anilistId === null) return null;

  for (const source of sources) {
    const page = findBestPageForSource(entry, source);
    if (page) return page;
  }

  return null;
}

/**
 * Find the best page for a specific source.
 */
function findBestPageForSource(
  entry: TrainingEntry,
  source: 'fandom' | 'wikipedia' | 'comicvine'
): SampledPage | null {
  if (entry.anilistId === null) return null;

  const { discoveredUrls, baseUrl } = getSourceData(entry, source);
  if (discoveredUrls.length === 0) return null;

  // Sort by priority and take best
  const sorted = [...discoveredUrls].sort((a, b) => {
    return URL_TYPE_PRIORITY.indexOf(a.type) - URL_TYPE_PRIORITY.indexOf(b.type);
  });

  const best = sorted[0];
  if (!best) return null;

  return {
    id: `${entry.anilistId}-${source}-${best.type}`,
    title: entry.title,
    anilistId: entry.anilistId,
    source,
    url: best.url,
    urlType: best.type,
    baseUrl,
  };
}
