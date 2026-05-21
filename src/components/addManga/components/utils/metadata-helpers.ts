/**
 * Metadata Helper Functions
 *
 * Utilities for working with metadata fields and status mapping
 */

import { formatDateForDisplay as formatDateUtil } from '@/utils/formatters/date-formatter';
import { mapToMangaStatus } from '@/utils/status-mapper';

/**
 * Fixed status mapping function
 * Handles various status formats from different providers
 */
export function mapProviderStatus(rawStatus: unknown): string | null {
  if (!rawStatus) return null;
  
  // Handle boolean status (some providers return true/false)
  if (typeof rawStatus === 'boolean') {
    return rawStatus ? 'ONGOING' : 'COMPLETED';
  }
  
  // Handle success/fail status (some providers use these)
  if (rawStatus === 'success' || rawStatus === 'true') return 'ONGOING';
  if (rawStatus === 'fail' || rawStatus === 'false' || rawStatus === 'failed') return 'COMPLETED';
  
  // Convert to uppercase string for comparison
  const statusStr = String(rawStatus).toUpperCase();
  
  // Handle common variations
  return mapToMangaStatus(statusStr)
}

/**
 * Enhanced metadata field extraction
 * Checks multiple possible locations for a field value
 */
export function getEnhancedMetadataField<T>(result: unknown, field: string, defaultValue: T): T {
  if (!result) return defaultValue;
  
  // Try multiple field name variations
  const fieldVariations = [
    field,
    field.toLowerCase(),
    field.charAt(0).toUpperCase() + field.slice(1),
    // Handle camelCase to snake_case
    field.replace(/([A-Z])/g, '_$1').toLowerCase(),
    // Handle snake_case to camelCase
    field.replace(/_([a-z])/g, (_: string, letter: string) => (typeof letter === 'string' ? letter.toUpperCase() : letter))
  ];
  
  // Locations to check (in priority order)
  const resultAsRecord = result as Record<string, unknown>;
  const locations = [
    (f: string) => resultAsRecord[f],
    (f: string) => {
      const rawData = resultAsRecord['rawData'];
      return rawData && typeof rawData === 'object' ? (rawData as Record<string, unknown>)[f] : undefined;
    },
    (f: string) => {
      const providerSpecific = resultAsRecord['providerSpecific'];
      return providerSpecific && typeof providerSpecific === 'object' ? (providerSpecific as Record<string, unknown>)[f] : undefined;
    },
    (f: string) => {
      const providerData = resultAsRecord['providerData'];
      return providerData && typeof providerData === 'object' ? (providerData as Record<string, unknown>)[f] : undefined;
    },
    (f: string) => {
      const metadata = resultAsRecord['metadata'];
      return metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>)[f] : undefined;
    },
    (f: string) => {
      const metadata = resultAsRecord['metadata'];
      if (metadata && typeof metadata === 'object') {
        const descriptions = (metadata as Record<string, unknown>)['descriptions'];
        return descriptions && typeof descriptions === 'object' ? (descriptions as Record<string, unknown>)[f] : undefined;
      }
      return undefined;
    },
    (f: string) => {
      const data = resultAsRecord['data'];
      return data && typeof data === 'object' ? (data as Record<string, unknown>)[f] : undefined;
    }
  ];
  
  // Try each field variation in each location
  for (const fieldVar of fieldVariations) {
    for (const location of locations) {
      const value = location(fieldVar);
      if (value !== null && value !== '') {
        return value as T;
      }
    }
  }
  
  return defaultValue;
}

/**
 * Generate proper label for field selector options
 */
// eslint-disable-next-line complexity -- Complex label generation with multiple value types
export function generateFieldSelectorLabel(
  sourceKey: string,
  value: unknown,
  fieldName: string
): string {
  const [provider, type] = sourceKey.split('_');

  // Format provider name - handle undefined provider
  const providerName = provider !== undefined ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
  
  // Format value for display
  let displayValue = '';
  if (value === null || value === '') {
    displayValue = 'N/A';
  } else if (typeof value === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else if (typeof value === 'number') {
    displayValue = value.toString();
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      displayValue = 'Empty';
    } else if (fieldName === 'genres' || fieldName === 'tags' || fieldName === 'authors' || fieldName === 'artists') {
      // For arrays of strings, join them
      displayValue = value.slice(0, 3).join(', ');
      if (value.length > 3) {
        displayValue += ` (+${value.length - 3} more)`;
      }
    } else {
      displayValue = `${value.length} items`;
    }
  } else if (typeof value === 'object' && 'year' in value) {
    // Handle date objects
    const dateObj = value as { year?: unknown; month?: unknown; day?: unknown };
    const year = typeof dateObj.year === 'number' || typeof dateObj.year === 'string' ? dateObj.year : '';
    const month = typeof dateObj.month === 'number' || typeof dateObj.month === 'string' ? `-${String(dateObj.month).padStart(2, '0')}` : '';
    const day = typeof dateObj.day === 'number' || typeof dateObj.day === 'string' ? `-${String(dateObj.day).padStart(2, '0')}` : '';
    displayValue = `${year}${month}${day}`;
  } else {
    displayValue = String(value);
    // Truncate long values
    if (displayValue.length > 50) {
      displayValue = displayValue.substring(0, 47) + '...';
    }
  }
  
  // Build label based on type
  let label = '';
  switch (type) {
    case 'original':
      label = `${displayValue} (Original)`;
      break;
    case 'primary':
      label = `${displayValue} (${providerName})`;
      break;
    case 'selected':
      label = `${displayValue} (${providerName} - Selected)`;
      break;
    case 'provider':
      label = `${displayValue} (${providerName})`;
      break;
    default:
      label = `${displayValue} (${providerName})`;
  }
  
  return label;
}

/**
 * Format date for display
 * Re-exports the canonical formatDateForDisplay from date-formatter
 */
export const formatDate = formatDateUtil;

/**
 * Calculate metadata confidence score
 */
export function calculateMetadataConfidence(manga: unknown): number {
  let score = 0;
  let maxScore = 0;
  
  // Check required fields
  const requiredFields = ['title', 'cover', 'description', 'status'];
  requiredFields.forEach(field => {
    maxScore += 20;
    const value = getEnhancedMetadataField<unknown>(manga, field, undefined);
    if (value !== null && value !== '') score += 20;
  });

  // Check optional but valuable fields
  const optionalFields = ['genres', 'authors', 'chapters', 'volumes', 'startDate'];
  optionalFields.forEach(field => {
    maxScore += 10;
    const value = getEnhancedMetadataField<unknown>(manga, field, undefined);
    if (value !== null && value !== '') score += 10;
  });

  // Check provider-specific enhancements
  const enhancementFields = ['bannerImage', 'averageScore', 'popularity', 'tags'];
  enhancementFields.forEach(field => {
    maxScore += 5;
    const value = getEnhancedMetadataField<unknown>(manga, field, undefined);
    if (value !== null && value !== '') score += 5;
  });
  
  return Math.round((score / maxScore) * 100);
}