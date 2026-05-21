/**
 * ReviewStage Helpers
 *
 * Pure utility functions extracted from ReviewStage.tsx to keep that file
 * under the 500-line ceiling.
 *
 * @module components/library/import-pipeline/stages/review-stage-helpers
 */

export interface MatchMetadata {
  coverImage: string | null;
  year: string | null;
  issueCount: number | null;
  volumeCount: number | null;
  publisher: string | null;
  status: string | null;
  genres: string[];
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] ?? 'B'}`;
}

export function extractPublisher(publisher: unknown): string | null {
  if (typeof publisher === 'string') return publisher;
  if (publisher && typeof publisher === 'object') {
    const pubObj = publisher as Record<string, unknown>;
    return typeof pubObj['name'] === 'string' ? pubObj['name'] : null;
  }
  return null;
}

export function extractMetadata(metadata: unknown): MatchMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return { coverImage: null, year: null, issueCount: null, volumeCount: null, publisher: null, status: null, genres: [] };
  }
  const meta = metadata as Record<string, unknown>;

  const coverImage = meta['coverImage'] ?? meta['cover'] ?? meta['image'];
  const startYear = meta['startYear'];
  const year = meta['year'];
  const issueCount = meta['issueCount'] ?? meta['count_of_issues'] ?? meta['chapters'];
  const volumeCount = meta['volumes'] ?? meta['volumeCount'];
  const status = meta['status'];
  const genres = meta['genres'];

  return {
    coverImage: typeof coverImage === 'string' ? coverImage : null,
    year: startYear?.toString() ?? year?.toString() ?? null,
    issueCount: typeof issueCount === 'number' ? issueCount : null,
    volumeCount: typeof volumeCount === 'number' ? volumeCount : null,
    publisher: extractPublisher(meta['publisher']),
    status: typeof status === 'string' ? status : null,
    genres: Array.isArray(genres) ? genres.filter((g): g is string => typeof g === 'string') : [],
  };
}
