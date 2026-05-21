/**
 * Utility functions for MangaMetadataViewer
 * @module components/manga/MangaMetadataViewer/utils
 */

/**
 * Type-safe property access helper
 */
export function getProperty<T>(obj: unknown, key: string, defaultValue?: T): T | undefined {
  return obj && typeof obj === 'object' && key in obj
    ? (obj as Record<string, unknown>)[key] as T
    : defaultValue;
}

/**
 * Get status badge color based on manga status
 */
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'ongoing':
    case 'publishing':
      return 'blue';
    case 'completed':
    case 'finished':
      return 'green';
    case 'hiatus':
      return 'yellow';
    case 'cancelled':
    case 'canceled':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'Unknown';
  }
}

/**
 * Extracted metadata structure for type safety
 */
export interface ExtractedMetadata {
  title: string;
  status: string | undefined;
  cover: string | undefined;
  description: string | undefined;
  format: string;
  score: number | undefined;
  chapters: number | undefined;
  volumes: number | undefined;
  alternativeTitles: string[];
  genres: string[];
  authors: string[];
  artists: string[];
  startDate: string | Date | undefined;
  endDate: string | Date | undefined;
  externalLinks: Record<string, string>;
}

/**
 * Extract metadata properties safely
 */
export function extractMetadata(metadata: unknown, fallbackTitle?: string): ExtractedMetadata {
  return {
    title: getProperty<string>(metadata, 'title') ?? fallbackTitle ?? 'Unknown Title',
    status: getProperty<string>(metadata, 'status'),
    cover: getProperty<string>(metadata, 'cover') ?? getProperty<string>(metadata, 'coverUrl'),
    description: getProperty<string>(metadata, 'description'),
    format: getProperty<string>(metadata, 'format') ?? getProperty<string>(metadata, 'type') ?? 'Manga',
    score: getProperty<number>(metadata, 'score') ?? getProperty<number>(metadata, 'rating'),
    chapters: getProperty<number>(metadata, 'chapters'),
    volumes: getProperty<number>(metadata, 'volumes'),
    alternativeTitles: getProperty<string[]>(metadata, 'alternativeTitles') ?? [],
    genres: getProperty<string[]>(metadata, 'genres') ?? [],
    authors: getProperty<string[]>(metadata, 'authors') ?? [],
    artists: getProperty<string[]>(metadata, 'artists') ?? [],
    startDate: getProperty<string | Date>(metadata, 'startDate'),
    endDate: getProperty<string | Date>(metadata, 'endDate'),
    externalLinks: getProperty<Record<string, string>>(metadata, 'externalLinks') ?? {}
  };
}
