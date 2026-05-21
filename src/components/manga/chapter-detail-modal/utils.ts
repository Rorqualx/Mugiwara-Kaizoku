/**
 * Chapter Detail Modal - Utility Functions
 *
 * Formatting and display utility functions used across
 * chapter-detail-modal components.
 *
 * Extracted from: ChapterDetailModal.tsx (lines 264-320)
 */

import type { ChapterEntity } from './types';

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format age from publish date to human-readable string
 *
 * @param publishDate - ISO date string
 * @returns Human-readable age string (e.g., "2 days ago", "3 weeks ago")
 */
export function formatAge(publishDate: string): string {
  const now = new Date();
  const published = new Date(publishDate);
  const diffMs = now.getTime() - published.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Format date to locale string
 *
 * @param date - Date object, ISO string, null, or undefined
 * @returns Formatted date string (e.g., "January 15, 2025")
 */
export function formatDateString(date: Date | string | null | undefined): string {
  if (date === null || date === undefined) return 'Unknown';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format date with time
 *
 * @param date - Date object, ISO string, null, or undefined
 * @returns Formatted date-time string (e.g., "Jan 15, 2025, 02:30 PM")
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (date === null || date === undefined) return 'Unknown';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================================================================
// Status Display
// ============================================================================

/**
 * Get badge color based on chapter download status
 *
 * @param chapter - Chapter entity or null
 * @returns Mantine color string for Badge component
 */
export function getStatusColor(chapter: ChapterEntity | null): string {
  switch (chapter?.downloadStatus) {
    case 'COMPLETED': return 'green';
    case 'DOWNLOADING': return 'blue';
    case 'PENDING': return 'yellow';
    case 'ERROR': return 'red';
    case 'DELETED': return 'gray';
    default: return 'gray';
  }
}

/**
 * Get text label based on chapter download status
 *
 * @param chapter - Chapter entity or null
 * @returns Human-readable status text
 */
export function getStatusText(chapter: ChapterEntity | null): string {
  switch (chapter?.downloadStatus) {
    case 'COMPLETED': return 'Downloaded';
    case 'DOWNLOADING': return 'Downloading';
    case 'PENDING': return 'Not Downloaded';
    case 'ERROR': return 'Error';
    case 'DELETED': return 'Deleted';
    default: return 'Unknown';
  }
}
