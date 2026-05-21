/**
 * Infobox Metadata Extractors
 *
 * Helper functions for extracting metadata fields from infobox data.
 * Each function returns a value instead of mutating a parameter,
 * eliminating no-param-reassign violations and reducing complexity.
 */

// ============================================================================
// Types
// ============================================================================

export interface InfoboxData {
  [key: string]: string | string[];
}

export type MangaStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED';

export interface ExtractedInfoboxMetadata {
  author?: string[];
  artist?: string[];
  publisher: string;
  magazine: string;
  demographic: string;
  genres?: string[];
  status?: MangaStatus;
  originalRun: string;
  volumes?: number;
  chapters?: number;
}

// ============================================================================
// Status Patterns
// ============================================================================

const STATUS_PATTERNS = {
  ongoing: /ongoing|current|serializ|active|present/i,
  completed: /complete|finish|end|conclude/i,
  hiatus: /hiatus|suspend|pause/i,
  cancelled: /cancel|discontinue|axe/i,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clean wiki markup and HTML from text
 */
function cleanText(text: string | undefined): string {
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
 * Split text by common separators
 */
function splitList(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/[,;、]/)
    .map(item => cleanText(item))
    .filter(Boolean);
}

/**
 * Parse a number from text with fallbacks
 */
function parseNumber(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Determine manga status from text
 */
function determineStatus(text: string): MangaStatus {
  const normalized = text.toLowerCase();
  if (STATUS_PATTERNS.completed.test(normalized)) return 'COMPLETED';
  if (STATUS_PATTERNS.hiatus.test(normalized)) return 'HIATUS';
  if (STATUS_PATTERNS.cancelled.test(normalized)) return 'CANCELLED';
  if (STATUS_PATTERNS.ongoing.test(normalized)) return 'ONGOING';
  return 'ONGOING'; // Default
}

// ============================================================================
// Extractor Functions
// ============================================================================

/**
 * Extract author information from infobox
 */
export function extractAuthorFromInfobox(infobox: InfoboxData): string[] | undefined {
  const keys = ['author', 'writer', 'story', 'written by'];
  for (const key of keys) {
    const value = infobox[key];
    if (value) {
      return splitList(value as string);
    }
  }
  return undefined;
}

/**
 * Extract artist information from infobox
 */
export function extractArtistFromInfobox(infobox: InfoboxData): string[] | undefined {
  const keys = ['artist', 'illustrator', 'art', 'illustrated by'];
  for (const key of keys) {
    const value = infobox[key];
    if (value) {
      return splitList(value as string);
    }
  }
  return undefined;
}

/**
 * Extract publisher-related information from infobox
 */
export function extractPublisherInfo(infobox: InfoboxData): {
  publisher: string;
  magazine: string;
  demographic: string;
} {
  return {
    publisher: (infobox['publisher'] ?? infobox['english publisher'] ?? '') as string,
    magazine: (infobox['magazine'] ?? infobox['serialized'] ?? '') as string,
    demographic: (infobox['demographic'] ?? '') as string,
  };
}

/**
 * Extract genres from infobox
 */
export function extractGenresFromInfobox(infobox: InfoboxData): string[] | undefined {
  const value = infobox['genre'] ?? infobox['genres'];
  return value ? splitList(value as string) : undefined;
}

/**
 * Extract status from infobox
 */
export function extractStatusFromInfobox(infobox: InfoboxData): MangaStatus | undefined {
  const statusValue = infobox['status'] ?? infobox['original run'] ?? '';
  if (!statusValue) return undefined;
  return determineStatus(statusValue as string);
}

/**
 * Extract volume and chapter counts from infobox
 */
export function extractCountsFromInfobox(infobox: InfoboxData): {
  volumes?: number;
  chapters?: number;
  originalRun: string;
} {
  const result: { volumes?: number; chapters?: number; originalRun: string } = {
    originalRun: (infobox['original run'] ?? infobox['published'] ?? '') as string,
  };

  const volumeValue = infobox['volumes'] ?? infobox['no. of volumes'];
  if (volumeValue) {
    const parsed = parseNumber(volumeValue as string);
    if (parsed !== null) {
      result.volumes = parsed;
    }
  }

  const chapterValue = infobox['chapters'] ?? infobox['no. of chapters'];
  if (chapterValue) {
    const parsed = parseNumber(chapterValue as string);
    if (parsed !== null) {
      result.chapters = parsed;
    }
  }

  return result;
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract all metadata from an infobox
 *
 * This function aggregates all extractor functions and returns
 * a complete metadata object instead of mutating a parameter.
 *
 * @param infobox - The infobox data to extract from
 * @returns Extracted metadata object
 */
export function extractMetadataFromInfobox(infobox: InfoboxData): ExtractedInfoboxMetadata {
  const publisherInfo = extractPublisherInfo(infobox);
  const counts = extractCountsFromInfobox(infobox);

  const author = extractAuthorFromInfobox(infobox);
  const artist = extractArtistFromInfobox(infobox);
  const genres = extractGenresFromInfobox(infobox);
  const status = extractStatusFromInfobox(infobox);

  return {
    ...(author !== undefined && { author }),
    ...(artist !== undefined && { artist }),
    publisher: publisherInfo.publisher,
    magazine: publisherInfo.magazine,
    demographic: publisherInfo.demographic,
    ...(genres !== undefined && { genres }),
    ...(status !== undefined && { status }),
    originalRun: counts.originalRun,
    ...(counts.volumes !== undefined && { volumes: counts.volumes }),
    ...(counts.chapters !== undefined && { chapters: counts.chapters }),
  };
}
