/**
 * Volume Detail Modal Utilities
 *
 * Utility functions for formatting and display in the VolumeDetailModal.
 *
 * Extracted from: VolumeDetailModal.tsx
 */

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format a publish date as a relative age string
 * @param publishDate - ISO date string
 * @returns Human-readable age string (e.g., "3 days ago")
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
 * Format a date for display
 * @param date - Date object or ISO string
 * @returns Formatted date string (e.g., "November 18, 2025")
 */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return 'Unknown';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
