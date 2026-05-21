/**
 * Post-Processing and Validation Module
 *
 * Handles post-processing of normalized data including:
 * - Inferring missing data from available information
 * - Setting defaults for cover images and totals
 * - Assigning chapters to volumes
 * - Validating dates and numbers
 * - Genre variant merging
 * - Cover image selection from images array
 * - Volume chapter map generation
 * - Statistics calculation
 *
 * Extracted from: DataNormalizer.ts (lines 585-720)
 */

import { MangaPublicationStatus } from './types';

import type {
  NormalizedMangaData,
  NormalizedChapter,
  NormalizedImage,
  NormalizationOptions,
} from './types';

// ============================================================================
// Post-Processing
// ============================================================================

/**
 * Apply cover processing (selection from images and volumes)
 */
function applyCoverProcessing(data: NormalizedMangaData, _options: NormalizationOptions): void {
  // Select best cover image from images array if not set from volumes
  if (!data.coverImage && data.images && data.images.length > 0) {
    const selectedCover = selectBestCoverImage(data.images);
    if (selectedCover) {
      // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
      data.coverImage = selectedCover;
    }
  }

  // Set cover image from first volume if still not set
  // FIX: Simplified condition - removed unnecessary !== null check (coverImage is string | undefined)
  if (!data.coverImage && data.volumes.length > 0) {
    const firstVolumeWithCover = data.volumes.find(v => v.coverImage);
    if (firstVolumeWithCover?.coverImage) {
      // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
      data.coverImage = firstVolumeWithCover.coverImage;
    }
  }
}

/**
 * Apply volume and chapter processing
 */
function applyVolumeChapterProcessing(data: NormalizedMangaData, options: NormalizationOptions): void {
  // Set total counts if not set
  if (!data.totalVolumes && data.volumes.length > 0) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
    data.totalVolumes = Math.max(...data.volumes.map(v => v.number));
  }

  if (!data.totalChapters && data.chapters.length > 0) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
    data.totalChapters = Math.max(...data.chapters.map(ch => ch.number));
  }

  // Assign chapters to volumes if not assigned
  assignChaptersToVolumes(data);

  // Generate volume chapter map if requested
  if (options.groupChaptersByVolume) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
    data.volumeChapterMap = generateVolumeChapterMap(data);
  }

  // Extract volume covers if available
  if (data.volumes.length > 0) {
    const volumeCovers = extractVolumeCovers(data);
    if (Object.keys(volumeCovers).length > 0) {
      // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
      data.volumeCovers = volumeCovers;
    }
  }
}

/**
 * Apply metrics calculation (statistics and quality score)
 */
function applyMetricsCalculation(data: NormalizedMangaData, options: NormalizationOptions): void {
  // Calculate statistics if requested
  if (options.calculateStats) {
    const stats = calculateStatistics(data);
    if (stats) {
      // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
      data.statistics = stats;
    }
  }

  // Calculate quality score if requested
  if (options.calculateQuality) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
    data.quality = calculateQualityScore(data);
  }
}

/**
 * Post-process normalized data
 *
 * Note: This function intentionally mutates the data parameter for efficiency.
 * This is a controlled mutation pattern used in data normalization pipelines
 * where the data flows through a series of transformations.
 */
export function postProcess(data: NormalizedMangaData, options: NormalizationOptions): void {
  // Infer missing data if requested
  if (options.inferMissingData) {
    inferMissingData(data);
  }

  // Merge genre variants if requested
  if (options.mergeVariants && data.genres) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
    data.genres = mergeGenreVariants(data.genres);
  }

  // Apply cover processing
  applyCoverProcessing(data, options);

  // Apply volume and chapter processing
  applyVolumeChapterProcessing(data, options);

  // Apply metrics calculation
  applyMetricsCalculation(data, options);

  // Clean URLs if requested
  if (options.cleanUrls) {
    cleanDataUrls(data);
  }
}

// ============================================================================
// Data Inference
// ============================================================================

/**
 * Infer missing data from available information
 *
 * Note: This function intentionally mutates the data parameter as part of
 * the data normalization pipeline where in-place modification is expected.
 */
export function inferMissingData(data: NormalizedMangaData): void {
  // Infer status from dates
  if (data.status === MangaPublicationStatus.UNKNOWN) {
    if (data.endDate) {
      // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
      data.status = MangaPublicationStatus.COMPLETED;
    } else if (data.startDate) {
      const monthsAgo = (Date.now() - data.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsAgo < 3) {
        // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
        data.status = MangaPublicationStatus.ONGOING;
      }
    }
  }

  // Infer release pattern from chapters
  if (data.chapters.length > 1) {
    const sortedChapters = [...data.chapters].sort((a, b) => a.number - b.number);
    const releaseDates = sortedChapters
      .filter((ch): ch is NormalizedChapter & { releaseDate: Date } => ch.releaseDate !== undefined)
      .map(ch => ch.releaseDate.getTime());

    if (releaseDates.length > 2) {
      // Calculate average release interval
      const intervals: number[] = [];
      for (let i = 1; i < releaseDates.length; i++) {
        const currentDate = releaseDates[i];
        const prevDate = releaseDates[i - 1];
        if (currentDate !== undefined && prevDate !== undefined) {
          intervals.push(currentDate - prevDate);
        }
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const daysInterval = avgInterval / (1000 * 60 * 60 * 24);

      // Use this to infer publication type
      if (daysInterval < 10) {
        // Weekly release
        if (!data.magazine) {
          // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
          data.magazine = 'Weekly Publication';
        }
      } else if (daysInterval < 35) {
        // Monthly release
        if (!data.magazine) {
          // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
          data.magazine = 'Monthly Publication';
        }
      }
    }
  }
}

// ============================================================================
// Chapter-Volume Assignment
// ============================================================================

/**
 * Assign chapters to their corresponding volumes
 *
 * Note: This function mutates volume.chapters arrays by adding chapter numbers
 * and sorting them. This is intentional for the data normalization pipeline.
 */
export function assignChaptersToVolumes(data: NormalizedMangaData): void {
  for (const chapter of data.chapters) {
    if (chapter.volumeNumber) {
      const volume = data.volumes.find(v => v.number === chapter.volumeNumber);
      if (volume && !volume.chapters.includes(chapter.number)) {
        volume.chapters.push(chapter.number);
      }
    }
  }

  // Sort chapter numbers in volumes
  for (const volume of data.volumes) {
    volume.chapters.sort((a, b) => a - b);
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate required fields and populate validation result
 */
function validateRequiredFields(data: NormalizedMangaData, options: NormalizationOptions): void {
  if (!options.required || options.required.length === 0) return;

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of options.required) {
    const value = data[field as keyof NormalizedMangaData];
    // Check for missing or default "Unknown" value
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Need null check for runtime safety
    if (value === undefined || value === null ||
        (typeof value === 'string' && (value === '' || (field === 'title' && value === 'Unknown')))) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
  data.validation = {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate data types and convert/null invalid values
 */
function validateDataTypes(data: NormalizedMangaData): void {
  // Validate totalVolumes is a number
  if (data.totalVolumes !== undefined && typeof data.totalVolumes !== 'number') {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation to fix invalid type
    delete data.totalVolumes;
  }

  // Validate totalChapters is a number
  if (data.totalChapters !== undefined && typeof data.totalChapters !== 'number') {
    // Type assertion is safe here since we're checking the type
    const totalChaptersValue = data.totalChapters as unknown;
    if (typeof totalChaptersValue === 'string') {
      const parsed = parseInt(totalChaptersValue, 10);
      if (!isNaN(parsed)) {
        // eslint-disable-next-line no-param-reassign -- Intentional mutation to convert type
        data.totalChapters = parsed;
      } else {
        // eslint-disable-next-line no-param-reassign -- Intentional mutation to fix invalid type
        delete data.totalChapters;
      }
    }
  }
}

/**
 * Validate URLs and filter out invalid/dangerous ones
 */
function validateUrls(data: NormalizedMangaData): void {
  // URL validation regex - checks for valid http/https URLs
  const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

  // Validate and filter images
  if (data.images) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation to remove invalid URLs
    data.images = data.images.filter(img => {
      // Filter out javascript: and other dangerous protocols
      if (img.url.startsWith('javascript:') || img.url.startsWith('data:')) {
        return false;
      }
      // Filter out invalid URLs
      return urlPattern.test(img.url) || img.url.startsWith('//') || img.url.startsWith('/');
    });
  }

  // Validate cover image
  if (data.coverImage) {
    if (data.coverImage.startsWith('javascript:') || !urlPattern.test(data.coverImage)) {
      // eslint-disable-next-line no-param-reassign -- Intentional mutation to remove invalid URL
      delete data.coverImage;
    }
  }
}

/**
 * Validate normalized data
 *
 * Note: This function intentionally mutates the data parameter to fix
 * validation issues (e.g., swapping incorrect date order, removing invalid entries).
 * This is a controlled mutation pattern in the data normalization pipeline.
 */
export function validate(data: NormalizedMangaData, options: NormalizationOptions): void {
  // Validate required fields
  if (options.validate && options.required) {
    validateRequiredFields(data, options);
  }

  // Validate data types
  if (options.validateDates) {
    validateDataTypes(data);
  }

  // Validate URLs
  if (options.validateUrls) {
    validateUrls(data);
  }

  // Validate dates
  if (options.validateDates) {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      // Swap dates using destructuring
      // eslint-disable-next-line no-param-reassign -- Intentional mutation to fix invalid date order
      [data.startDate, data.endDate] = [data.endDate, data.startDate];
    }

    // Remove future dates
    const now = new Date();
    for (const volume of data.volumes) {
      if (volume.releaseDate && volume.releaseDate > now) {
        delete volume.releaseDate;
      }
    }

    for (const chapter of data.chapters) {
      if (chapter.releaseDate && chapter.releaseDate > now) {
        delete chapter.releaseDate;
      }
    }
  }

  // Validate numbers
  if (options.validateNumbers) {
    // Remove invalid volume/chapter numbers (allow Volume 0 for prequels like JJK 0)
    if (options.removeInvalid) {
      // eslint-disable-next-line no-param-reassign -- Intentional mutation to remove invalid entries
      data.volumes = data.volumes.filter(v => v.number >= 0 && v.number < 1000);
      // eslint-disable-next-line no-param-reassign -- Intentional mutation to remove invalid entries
      data.chapters = data.chapters.filter(ch => ch.number >= 0 && ch.number < 10000);
    }
  }
}

// ============================================================================
// Genre Variant Merging
// ============================================================================

/**
 * Genre variant mapping for normalization
 * Maps common variants to their canonical form
 */
const GENRE_VARIANTS: Record<string, string> = {
  // Science Fiction variants
  'sci-fi': 'Science Fiction',
  'scifi': 'Science Fiction',
  'sf': 'Science Fiction',
  'science fiction': 'Science Fiction',

  // Romance variants
  'rom-com': 'Romantic Comedy',
  'romcom': 'Romantic Comedy',

  // Slice of Life variants
  'sol': 'Slice of Life',
  'slice-of-life': 'Slice of Life',
  'slice of life': 'Slice of Life',

  // Comedy variants
  'gag': 'Comedy',
  'humor': 'Comedy',
  'humour': 'Comedy',

  // Horror variants
  'scary': 'Horror',
  'terror': 'Horror',

  // Fantasy variants
  'high fantasy': 'Fantasy',
  'dark fantasy': 'Dark Fantasy',

  // Martial Arts variants
  'martial-arts': 'Martial Arts',
  'kungfu': 'Martial Arts',
  'kung fu': 'Martial Arts',

  // Psychological variants
  'psych': 'Psychological',
  'psychological thriller': 'Psychological',

  // Sports variants
  'sport': 'Sports',

  // Supernatural variants
  'paranormal': 'Supernatural',
};

/**
 * Merge genre variants into their canonical forms
 * Removes duplicates after normalization
 */
export function mergeGenreVariants(genres: string[]): string[] {
  const normalizedGenres = new Map<string, string>();

  for (const genre of genres) {
    if (!genre || typeof genre !== 'string') continue;

    const trimmed = genre.trim();
    if (!trimmed) continue;

    const lowercase = trimmed.toLowerCase();

    // Check if this is a known variant
    const canonical = GENRE_VARIANTS[lowercase];
    if (canonical) {
      // Use the canonical form
      normalizedGenres.set(canonical.toLowerCase(), canonical);
    } else {
      // Capitalize first letter of each word for consistency
      const normalized = trimmed
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      normalizedGenres.set(normalized.toLowerCase(), normalized);
    }
  }

  return Array.from(normalizedGenres.values());
}

// ============================================================================
// Cover Image Selection
// ============================================================================

/**
 * Select the best cover image from an array of images
 * Prefers cover type images, then larger images
 */
export function selectBestCoverImage(images: NormalizedImage[]): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive runtime check
  if (!images || images.length === 0) return undefined;

  // Filter to cover images first
  const coverImages = images.filter(img => img.type === 'cover');

  if (coverImages.length > 0) {
    // Return the first cover image (they're already normalized)
    return coverImages[0]?.url;
  }

  // Fall back to first image of any type
  return images[0]?.url;
}

// ============================================================================
// Volume Chapter Map Generation
// ============================================================================

/**
 * Generate a map of volume numbers to chapter numbers
 */
export function generateVolumeChapterMap(data: NormalizedMangaData): Record<number, number[]> {
  const volumeChapterMap: Record<number, number[]> = {};

  // First, collect chapters from volume data (allow Volume 0 for prequels like JJK 0)
  for (const volume of data.volumes) {
    if (volume.number >= 0) {
      volumeChapterMap[volume.number] = [...volume.chapters];
    }
  }

  // Then, add chapters that reference volumes (allow Volume 0 for prequels)
  for (const chapter of data.chapters) {
    if (chapter.volumeNumber !== undefined && chapter.volumeNumber >= 0) {
      const volNum = chapter.volumeNumber;
      const existingChapters = volumeChapterMap[volNum];
      if (!existingChapters) {
        volumeChapterMap[volNum] = [];
      }
      const chapterList = volumeChapterMap[volNum];
      if (chapterList && !chapterList.includes(chapter.number)) {
        chapterList.push(chapter.number);
      }
    }
  }

  // Sort chapter numbers within each volume
  for (const volumeNum of Object.keys(volumeChapterMap)) {
    const numKey = parseInt(volumeNum, 10);
    const chapters = volumeChapterMap[numKey];
    if (chapters) {
      volumeChapterMap[numKey] = chapters.sort((a, b) => a - b);
    }
  }

  return volumeChapterMap;
}

// ============================================================================
// Volume Covers Extraction
// ============================================================================

/**
 * Extract volume cover images into a map
 */
export function extractVolumeCovers(data: NormalizedMangaData): Record<number, string> {
  const volumeCovers: Record<number, string> = {};

  // Allow Volume 0 for prequels like JJK 0
  for (const volume of data.volumes) {
    if (volume.coverImage && volume.number >= 0) {
      volumeCovers[volume.number] = volume.coverImage;
    }
  }

  // Also check images array for volume-specific images (allow Volume 0 for prequels)
  if (data.images) {
    for (const image of data.images) {
      if (image.volumeNumber !== undefined && image.volumeNumber >= 0 && !volumeCovers[image.volumeNumber]) {
        volumeCovers[image.volumeNumber] = image.url;
      }
    }
  }

  return volumeCovers;
}

// ============================================================================
// Statistics Calculation
// ============================================================================

/**
 * Calculate statistics from normalized data
 */
export function calculateStatistics(data: NormalizedMangaData): NormalizedMangaData['statistics'] {
  const totalVolumes = data.volumes.length;
  const totalChapters = data.chapters.length;

  // Build result object conditionally to satisfy exactOptionalPropertyTypes
  const result: NonNullable<NormalizedMangaData['statistics']> = {
    totalVolumes,
    totalChapters
  };

  // Calculate average chapters per volume
  if (totalVolumes > 0 && totalChapters > 0) {
    result.averageChaptersPerVolume = Math.round((totalChapters / totalVolumes) * 10) / 10;
  }

  // Calculate average release interval (in days)
  if (data.chapters.length > 1) {
    const sortedChapters = [...data.chapters]
      .filter((ch): ch is NormalizedChapter & { releaseDate: Date } => ch.releaseDate !== undefined)
      .sort((a, b) => a.releaseDate.getTime() - b.releaseDate.getTime());

    if (sortedChapters.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedChapters.length; i++) {
        const current = sortedChapters[i];
        const prev = sortedChapters[i - 1];
        if (current && prev) {
          const diffMs = current.releaseDate.getTime() - prev.releaseDate.getTime();
          intervals.push(diffMs / (1000 * 60 * 60 * 24)); // Convert to days
        }
      }
      if (intervals.length > 0) {
        result.averageReleaseInterval = Math.round((intervals.reduce((a, b) => a + b, 0) / intervals.length) * 10) / 10;
      }
    }
  }

  // Calculate total pages if available
  const volumesWithPages = data.volumes.filter(v => v.pageCount !== undefined);
  if (volumesWithPages.length > 0) {
    result.totalPages = volumesWithPages.reduce((sum, v) => sum + (v.pageCount ?? 0), 0);
  }

  // Calculate completion percentage (if we know totals)
  if (data.totalChapters !== undefined && data.totalChapters > 0) {
    result.completionPercentage = Math.round((totalChapters / data.totalChapters) * 100);
  }

  return result;
}

// ============================================================================
// Quality Score Calculation
// ============================================================================

/**
 * Score basic fields (title, cover, author)
 */
function scoreBasicFields(data: NormalizedMangaData): number {
  let score = 0;
  // Title (10 points)
  if (data.title && data.title !== 'Unknown') {
    score += 10;
  }
  // Cover image (10 points)
  if (data.coverImage) {
    score += 10;
  }
  // Author (10 points)
  if (data.author && data.author.length > 0) {
    score += 10;
  }
  return score;
}

/**
 * Score description and metadata fields
 */
function scoreDescriptionAndMetadata(data: NormalizedMangaData): number {
  let score = 0;
  // Description (10 points)
  if (data.description && data.description.length > 50) {
    score += 10;
  } else if (data.description) {
    score += 5;
  }
  // Genres (10 points)
  if (data.genres && data.genres.length > 0) {
    score += Math.min(10, data.genres.length * 2);
  }
  // Status (5 points)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive runtime check
  if (data.status && data.status !== MangaPublicationStatus.UNKNOWN) {
    score += 5;
  }
  return score;
}

/**
 * Score content completeness (volumes and chapters)
 */
function scoreContentCompleteness(data: NormalizedMangaData): number {
  let score = 0;
  // Volumes (15 points)
  if (data.volumes.length > 0) {
    score += 10;
    // Bonus for volumes with complete data
    const volumesWithTitles = data.volumes.filter(v => v.title).length;
    if (volumesWithTitles > 0) {
      score += Math.min(5, (volumesWithTitles / data.volumes.length) * 5);
    }
  }
  // Chapters (15 points)
  if (data.chapters.length > 0) {
    score += 10;
    // Bonus for chapters with complete data
    const chaptersWithTitles = data.chapters.filter(ch => ch.title).length;
    if (chaptersWithTitles > 0) {
      score += Math.min(5, (chaptersWithTitles / data.chapters.length) * 5);
    }
  }
  return score;
}

/**
 * Calculate a quality score based on data completeness
 * Score from 0 to 1 representing how complete the data is
 */
export function calculateQualityScore(data: NormalizedMangaData): number {
  const basicScore = scoreBasicFields(data);
  const metadataScore = scoreDescriptionAndMetadata(data);
  const dateScore = (data.startDate ? 5 : 0) + (data.endDate ? 5 : 0);
  const contentScore = scoreContentCompleteness(data);
  const externalScore = (data.externalLinks && data.externalLinks.length > 0) ? 5 : 0;

  const totalScore = basicScore + metadataScore + dateScore + contentScore + externalScore;
  const maxScore = 30 + 25 + 10 + 30 + 5; // 100 total

  return Math.round((totalScore / maxScore) * 100) / 100;
}

// ============================================================================
// URL Cleaning
// ============================================================================

/**
 * Clean URLs in the normalized data
 * - Converts protocol-relative URLs (//example.com) to HTTPS
 * - Ensures HTTP URLs are upgraded to HTTPS where safe
 */
export function cleanDataUrls(data: NormalizedMangaData): void {
  // Clean cover image
  if (data.coverImage) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
    data.coverImage = cleanUrl(data.coverImage);
  }

  // Clean banner image
  if (data.bannerImage) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation in data normalization pipeline
    data.bannerImage = cleanUrl(data.bannerImage);
  }

  // Clean images array
  if (data.images) {
    for (const image of data.images) {
      image.url = cleanUrl(image.url);
    }
  }

  // Clean volume cover images
  for (const volume of data.volumes) {
    if (volume.coverImage) {
      volume.coverImage = cleanUrl(volume.coverImage);
    }
  }

  // Clean chapter URLs
  for (const chapter of data.chapters) {
    if (chapter.url) {
      chapter.url = cleanUrl(chapter.url);
    }
  }

  // Clean external links
  if (data.externalLinks) {
    for (const link of data.externalLinks) {
      link.url = cleanUrl(link.url);
    }
  }
}

/**
 * Clean a single URL
 */
function cleanUrl(url: string): string {
  if (!url) return url;

  // Handle protocol-relative URLs
  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  // Upgrade HTTP to HTTPS for known safe domains
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  return url;
}
