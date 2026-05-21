/**
 * Blocklist Table Utilities
 *
 * Shared helper functions for the BlocklistTable component.
 * Extracted from BlocklistTable.tsx to reduce complexity and improve reusability.
 *
 * @module components/wanted/blocklist-utils
 */

import { ReleaseBlocklistReason } from '@prisma/client';

import type { BlocklistEntry } from './BlocklistTable';

/**
 * Sort field options
 */
export type SortField = 'title' | 'reason' | 'dateAdded' | 'mangaTitle' | 'group';

/**
 * Sort direction options
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Format reason to human-readable label
 */
export function formatReason(reason: ReleaseBlocklistReason): string {
  const labels: Record<ReleaseBlocklistReason, string> = {
    QUALITY_POOR: 'Poor Quality',
    WRONG_LANGUAGE: 'Wrong Language',
    INCOMPLETE: 'Incomplete',
    WATERMARKED: 'Watermarked',
    DUPLICATE: 'Duplicate',
    CORRUPTED: 'Corrupted',
    WRONG_CONTENT: 'Wrong Content',
    RELEASE_GROUP: 'Release Group',
    USER_PREFERENCE: 'User Preference',
    AUTO_QUALITY: 'Auto Quality',
    DMCA: 'DMCA',
    DOWNLOAD_FAILED: 'Download Failed',
    OTHER: 'Other'
  };
  return labels[reason] || reason;
}

/**
 * Get color for reason badge
 */
export function getReasonColor(reason: ReleaseBlocklistReason): string {
  const colors: Record<ReleaseBlocklistReason, string> = {
    QUALITY_POOR: 'orange',
    WRONG_LANGUAGE: 'blue',
    INCOMPLETE: 'yellow',
    WATERMARKED: 'red',
    DUPLICATE: 'grape',
    CORRUPTED: 'red',
    WRONG_CONTENT: 'red',
    RELEASE_GROUP: 'pink',
    USER_PREFERENCE: 'cyan',
    AUTO_QUALITY: 'teal',
    DMCA: 'red',
    DOWNLOAD_FAILED: 'orange',
    OTHER: 'gray'
  };
  return colors[reason] || 'gray';
}

/**
 * Filter options interface
 */
export interface FilterOptions {
  searchTerm: string;
  reasonFilter: ReleaseBlocklistReason[];
  showInactive: boolean;
}

/**
 * Filter blocklist items based on search term, reason filter, and active status
 */
export function filterBlocklistItems(
  items: BlocklistEntry[],
  options: FilterOptions
): BlocklistEntry[] {
  const { searchTerm, reasonFilter, showInactive } = options;
  let filtered = items;

  // Filter by active status
  if (!showInactive) {
    filtered = filtered.filter(item => item.isActive);
  }

  // Filter by search term
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(item =>
      item.title?.toLowerCase().includes(term) ||
      item.group?.toLowerCase().includes(term) ||
      item.details?.toLowerCase().includes(term) ||
      item.manga?.title.toLowerCase().includes(term)
    );
  }

  // Filter by reason
  if (reasonFilter.length > 0) {
    filtered = filtered.filter(item => reasonFilter.includes(item.reason));
  }

  return filtered;
}

/**
 * Extract sortable value from blocklist entry based on field
 */
function extractSortValue(entry: BlocklistEntry, sortField: SortField): string | number {
  switch (sortField) {
    case 'title':
      return entry.title?.toLowerCase() ?? '';
    case 'reason':
      return entry.reason;
    case 'dateAdded':
      return new Date(entry.dateAdded).getTime();
    case 'mangaTitle':
      return entry.manga?.title.toLowerCase() ?? '';
    case 'group':
      return entry.group?.toLowerCase() ?? '';
    default:
      return new Date(entry.dateAdded).getTime();
  }
}

/**
 * Compare two values with direction awareness
 */
function compareValues(a: string | number, b: string | number, direction: SortDirection): number {
  if (direction === 'asc') {
    return a > b ? 1 : a < b ? -1 : 0;
  } else {
    return a < b ? 1 : a > b ? -1 : 0;
  }
}

/**
 * Sort blocklist items based on field and direction
 */
export function sortBlocklistItems(
  items: BlocklistEntry[],
  sortField: SortField,
  sortDirection: SortDirection
): BlocklistEntry[] {
  return [...items].sort((a, b) => {
    const aVal = extractSortValue(a, sortField);
    const bVal = extractSortValue(b, sortField);
    return compareValues(aVal, bVal, sortDirection);
  });
}

/**
 * Get reason options for filter dropdown
 */
export function getReasonOptions(): Array<{ value: ReleaseBlocklistReason; label: string }> {
  return Object.values(ReleaseBlocklistReason).map(reason => ({
    value: reason,
    label: formatReason(reason)
  }));
}
