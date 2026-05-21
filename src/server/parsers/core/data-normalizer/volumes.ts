/**
 * Volume Normalization Module
 *
 * Processes and normalizes volume data from extracted content.
 * Handles deduplication, merging variants, sorting, and gap filling.
 *
 * Extracted from: DataNormalizer.ts (lines 379-445)
 */

import type {
  NormalizedVolume,
  NormalizationOptions,
  VolumeData,
} from './types';

// ============================================================================
// Helper Functions (will be moved to utils.ts in a future extraction)
// ============================================================================

/**
 * Normalize volume number from string or number
 */
function normalizeVolumeNumber(num: number | string): number {
  if (typeof num === 'number') return num;
  const parsed = parseFloat(num.toString());
  return isNaN(parsed) ? 0 : Math.floor(parsed);
}

/**
 * Normalize chapter number from string or number
 */
function normalizeChapterNumber(num: string | number): number {
  if (typeof num === 'number') return num;
  const parsed = parseFloat(num.toString());
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalize text by cleaning whitespace and quotes
 */
function normalizeText(text: string, options: NormalizationOptions): string {
  if (!options.normalizeText) return text;

  return text
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .trim();
}

/**
 * Parse date string into Date object
 */
function parseDate(dateStr: string): Date | undefined {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // Try alternative parsing
    const match = dateStr.match(/(\d{4})/);
    if (match?.[1]) {
      return new Date(parseInt(match[1], 10), 0, 1);
    }
    return undefined;
  }
  return date;
}

/**
 * Merge volume data from two sources
 */
function mergeVolumeData(existing: NormalizedVolume, newData: VolumeData): NormalizedVolume {
  const merged = { ...existing };

  if (!merged.title && newData.title) {
    merged.title = newData.title;
  }

  if (!merged.coverImage && newData.coverImage) {
    merged.coverImage = newData.coverImage;
  }

  if (!merged.isbn && newData.isbn) {
    merged.isbn = newData.isbn;
  }

  if (!merged.releaseDate && newData.releaseDate) {
    const releaseDate = parseDate(newData.releaseDate);
    if (releaseDate !== undefined) {
      merged.releaseDate = releaseDate;
    }
  }

  // Merge chapters
  const newChapters = newData.chapters.map(ch => normalizeChapterNumber(ch.chapterNumber));
  merged.chapters = Array.from(new Set([...merged.chapters, ...newChapters]));

  return merged;
}

/**
 * Fill gaps in volume sequence
 */
function fillVolumeGaps(volumes: NormalizedVolume[]): void {
  if (volumes.length < 2) return;

  const minVolume = Math.min(...volumes.map(v => v.number));
  const maxVolume = Math.max(...volumes.map(v => v.number));

  for (let i = minVolume; i <= maxVolume; i++) {
    if (!volumes.find(v => v.number === i)) {
      volumes.push({
        number: i,
        chapters: []
      });
    }
  }

  volumes.sort((a, b) => a.number - b.number);
}

/**
 * Detect omnibus volumes from title
 * Returns volume range if it's an omnibus, undefined otherwise
 */
function detectOmnibus(title?: string): { start: number; end: number } | undefined {
  if (!title) return undefined;

  // Match patterns like "Omnibus 1-3", "Volumes 1-3", "Vol. 1-3"
  const omnibusPattern = /(?:omnibus|volumes?|vol\.?)\s+(\d+)[-–—]\s*(\d+)/i;
  const match = title.match(omnibusPattern);

  if (match?.[1] && match[2]) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!isNaN(start) && !isNaN(end) && start < end) {
      return { start, end };
    }
  }

  return undefined;
}

/**
 * Detect edition type from volume title
 * Returns edition string if detected, undefined otherwise
 */
function detectEdition(title?: string): string | undefined {
  if (!title) return undefined;

  const lowerTitle = title.toLowerCase();

  // Match edition patterns: "Limited Edition", "Collector's Edition", etc.
  const editionPattern = /(limited|collector'?s?|deluxe|omnibus|digital|special)\s*edition/i;
  const match = title.match(editionPattern);

  if (match?.[1]) {
    // Capitalize first letter and return
    const edition = match[1];
    return edition.charAt(0).toUpperCase() + edition.slice(1).toLowerCase().replace("'s", '');
  }

  // Fallback to simple keyword detection
  if (lowerTitle.includes('omnibus')) {
    return 'Omnibus';
  }

  if (lowerTitle.includes('deluxe')) {
    return 'Deluxe';
  }

  if (lowerTitle.includes('collector')) {
    return 'Collector';
  }

  if (lowerTitle.includes('digital')) {
    return 'Digital';
  }

  if (lowerTitle.includes('limited')) {
    return 'Limited';
  }

  return undefined;
}

// ============================================================================
// Volume Normalization
// ============================================================================

/**
 * Normalize volume data array
 *
 * Processes raw volume data into normalized format with:
 * - Volume number normalization
 * - Duplicate detection and merging
 * - Optional field processing (title, cover, ISBN, release date)
 * - Sorting by volume number
 * - Gap filling for missing volumes
 *
 * @param volumes - Array of raw volume data
 * @param options - Normalization options
 * @returns Array of normalized volumes
 */
export function normalizeVolumes(
  volumes: VolumeData[] | undefined,
  options: NormalizationOptions
): NormalizedVolume[] {
  // Handle undefined volumes gracefully
  if (!volumes || !Array.isArray(volumes)) {
    return [];
  }

  const normalized: NormalizedVolume[] = [];
  const volumeMap = new Map<number, NormalizedVolume>();

  for (const volume of volumes) {
    const volumeNumber = normalizeVolumeNumber(volume.volumeNumber);

    // Check for duplicates
    if (volumeMap.has(volumeNumber)) {
      if (options.mergeVariants) {
        // Merge data
        const existing = volumeMap.get(volumeNumber);
        if (existing) {
          const merged = mergeVolumeData(existing, volume);
          volumeMap.set(volumeNumber, merged);
        }
      }
      continue;
    }

    const normalizedVolume: NormalizedVolume = {
      number: volumeNumber,
      chapters: volume.chapters.map(ch => normalizeChapterNumber(ch.chapterNumber))
    };

    // Add optional fields only if they have values
    if (volume.title) {
      const title = normalizeText(volume.title, options);
      if (title) {
        normalizedVolume.title = title;

        // Detect omnibus
        const omnibusRange = detectOmnibus(title);
        if (omnibusRange) {
          normalizedVolume.isOmnibus = true;
          normalizedVolume.volumeRange = omnibusRange;

          // Calculate chapter range from chapters array
          // eslint-disable-next-line max-depth
          if (normalizedVolume.chapters.length > 0) {
            const sortedChapters = [...normalizedVolume.chapters].sort((a, b) => a - b);
            const firstChapter = sortedChapters[0];
            const lastChapter = sortedChapters[sortedChapters.length - 1];
            // eslint-disable-next-line max-depth
            if (firstChapter !== undefined && lastChapter !== undefined) {
              normalizedVolume.chapterRange = { start: firstChapter, end: lastChapter };
            }
          }
        }

        // Detect edition
        const edition = detectEdition(title);
        if (edition) {
          normalizedVolume.edition = edition;
        }
      }
    }

    if (volume.coverImage) {
      normalizedVolume.coverImage = volume.coverImage;
    }

    if (volume.isbn) {
      normalizedVolume.isbn = volume.isbn;
    }

    if (volume.releaseDate) {
      const releaseDate = parseDate(volume.releaseDate);
      if (releaseDate !== undefined) {
        normalizedVolume.releaseDate = releaseDate;
      }
    }

    volumeMap.set(volumeNumber, normalizedVolume);
    normalized.push(normalizedVolume);
  }

  // Sort if requested
  if (options.sortVolumes) {
    normalized.sort((a, b) => a.number - b.number);
  }

  // Fill gaps if requested
  if (options.fillGaps) {
    fillVolumeGaps(normalized);
  }

  return normalized;
}
