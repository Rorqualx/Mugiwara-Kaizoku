import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';

/**
 * Date Formatting Utilities
 *
 * Provides consistent date formatting throughout the application
 * with proper error handling and type safety.
 */
/**
 * Format a date value to a localized date string
 *
 * @param date - The date to format (Date, string, or undefined/null)
 * @param options - Intl.DateTimeFormat options
 * @param locale - The locale to use (defaults to system locale)
 * @returns Formatted date string or fallback value
 */
export function formatDate(date: Date | string | undefined | null, options?: Intl.DateTimeFormatOptions, locale?: string): string {
    if (!date) {
        return 'N/A';
    }
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            logger.warn('Invalid date value:', date);
            return 'Invalid date';
        }
        // Default options for consistency
        const defaultOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...options
        };
        return dateObj.toLocaleDateString(locale, defaultOptions);
    }
    catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        logger.error('Error formatting date:', errorMessage);
        return 'Invalid date';
    }
}
/**
 * Format a date to a relative time string (e.g., "2 hours ago")
 *
 * @param date - The date to format
 * @param locale - The locale to use (defaults to system locale)
 * @returns Relative time string or fallback value
 */
export function formatRelativeDate(date: Date | string | undefined | null, locale?: string): string {
    if (!date) {
        return 'N/A';
    }
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) {
            return 'Invalid date';
        }
        const now = new Date();
        const diffMs = now.getTime() - dateObj.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffSeconds < 60) {
            return 'just now';
        }
        else if (diffMinutes < 60) {
            return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
        }
        else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        }
        else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        }
        else {
            // Fall back to regular date format for older dates
            return formatDate(dateObj, undefined, locale);
        }
    }
    catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        logger.error('Error formatting relative date:', errorMessage);
        return 'Invalid date';
    }
}
/**
 * Format a date to ISO string or fallback
 *
 * @param date - The date to format
 * @returns ISO date string or null
 */
export function toISOString(date: Date | string | undefined | null): string | null {
    if (!date) {
        return null;
    }
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) {
            return null;
        }
        return dateObj.toISOString();
    }
    catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        logger.error('Error converting to ISO string:', errorMessage);
        return null;
    }
}
/**
 * Check if a date value is valid
 *
 * @param date - The date to check
 * @returns True if valid date, false otherwise
 */
export function isValidDate(date: unknown): date is Date {
    return date instanceof Date && !isNaN(date.getTime());
}
/**
 * Parse a date string safely
 *
 * @param dateString - The string to parse
 * @returns Date object or null if invalid
 */
export function parseDate(dateString: string | undefined | null): Date | null {
    if (!dateString) {
        return null;
    }
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    }
    catch {
        return null;
    }
}

/**
 * Format date for display in wizard/metadata contexts
 * Handles AniList date objects { year, month, day } and standard formats
 *
 * @param date - Date object, ISO string, or AniList date object
 * @returns ISO date string (YYYY-MM-DD) or empty string
 */
export function formatDateForDisplay(date: unknown): string {
  if (!date) return '';

  // Handle Date objects
  if (date instanceof Date) {
    const isoString = date.toISOString().split('T')[0];
    return isoString ?? '';
  }

  // Handle ISO strings
  if (typeof date === 'string') {
    if (date.includes('T')) {
      const datePart = date.split('T')[0];
      return datePart ?? date;
    }
    return date;
  }

  // Handle AniList date objects { year, month, day }
  if (typeof date === 'object' && 'year' in date) {
    const dateObj = date as { year?: unknown; month?: unknown; day?: unknown };
    const year = typeof dateObj.year === 'number' || typeof dateObj.year === 'string' ? dateObj.year : '';
    const month = typeof dateObj.month === 'number' || typeof dateObj.month === 'string' ? String(dateObj.month).padStart(2, '0') : '01';
    const day = typeof dateObj.day === 'number' || typeof dateObj.day === 'string' ? String(dateObj.day).padStart(2, '0') : '01';
    return `${year}-${month}-${day}`;
  }

  return String(date);
}
