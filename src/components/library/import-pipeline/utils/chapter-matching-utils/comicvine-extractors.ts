/**
 * ComicVine Metadata Extractors
 *
 * Functions for extracting chapter metadata from ComicVine API responses.
 *
 * @module components/library/import-pipeline/utils/chapter-matching-utils/comicvine-extractors
 */

import type { MetadataChapter } from '@/components/library/import-pipeline/types';
import type { ComicVineIssue, ComicVineMetadata } from '@/types/provider-metadata.types';

// ============================================================================
// Helper Functions
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeGetRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = obj[key];
  return isRecord(value) ? value : undefined;
}

function safeGetArray(obj: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = obj[key];
  return Array.isArray(value) ? value : undefined;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isComicVineMetadata(meta: unknown): meta is ComicVineMetadata {
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  return 'issues' in m || (typeof m['metadata'] === 'object' && m['metadata'] !== null);
}

// ============================================================================
// ComicVine Extraction
// ============================================================================

/**
 * Find ComicVine issues from nested metadata paths
 */
export function findComicVineIssuesFromMetadata(metadata: Record<string, unknown>): ComicVineIssue[] | null {
  const directIssues = safeGetArray(metadata, 'issues');
  if (directIssues && directIssues.length > 0) {
    return directIssues as ComicVineIssue[];
  }

  const comicvineData = safeGetRecord(metadata, 'comicvine');
  if (comicvineData) {
    const rawData = safeGetRecord(comicvineData, 'rawData');
    const issues = rawData ? safeGetArray(rawData, 'issues') : safeGetArray(comicvineData, 'issues');
    if (issues && issues.length > 0) {
      return issues as ComicVineIssue[];
    }
    const cvMetadata = safeGetRecord(comicvineData, 'metadata');
    if (cvMetadata) {
      const metaIssues = safeGetArray(cvMetadata, 'issues');
      if (metaIssues && metaIssues.length > 0) {
        return metaIssues as ComicVineIssue[];
      }
    }
  }

  const comicvineVolumes = safeGetRecord(metadata, 'comicvine_volumes');
  if (comicvineVolumes) {
    const issues = safeGetArray(comicvineVolumes, 'issues');
    if (issues && issues.length > 0) {
      return issues as ComicVineIssue[];
    }
    const cvMetadata = safeGetRecord(comicvineVolumes, 'metadata');
    if (cvMetadata) {
      const metaIssues = safeGetArray(cvMetadata, 'issues');
      if (metaIssues && metaIssues.length > 0) {
        return metaIssues as ComicVineIssue[];
      }
    }
  }

  return null;
}

/**
 * Extract and normalize chapters from ComicVine metadata
 */
export function extractComicVineChapters(metadata: ComicVineMetadata, provider: string): MetadataChapter[] {
  const chapters: MetadataChapter[] = [];
  const issues: ComicVineIssue[] = metadata.issues ?? metadata.metadata?.issues ?? [];

  for (const issue of issues) {
    const issueNumber = issue.issue_number ?? issue.issueNumber;
    if (issueNumber === undefined) continue;

    const title = issue.name ?? issue.title;
    const coverImage = issue.image?.medium_url ?? issue.image?.original_url ?? issue.image?.small_url;

    const chapter: MetadataChapter = {
      id: `${provider}-ch-${issueNumber}`,
      provider,
      number: issueNumber,
    };
    if (title) chapter.title = title;
    if (coverImage) chapter.coverImage = coverImage;

    chapters.push(chapter);
  }

  chapters.sort((a, b) => a.number - b.number);
  return chapters;
}
