/**
 * Manga Detail Utilities
 *
 * Helper functions for formatting and displaying manga detail information.
 *
 * Extracted from: mangaDetail.tsx (lines 131-189)
 */

/**
 * Formats file size from bytes to human-readable format
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string with units (e.g., "1.5 MB")
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536000) // "1.46 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Converts language code to full language name
 *
 * @param code - ISO language code (e.g., 'en', 'ja') or null
 * @returns Full language name or code if unknown, 'Unknown' if null
 *
 * @example
 * getLanguageName('en') // "English"
 * getLanguageName('ja') // "Japanese"
 * getLanguageName('xx') // "xx"
 * getLanguageName(null) // "Unknown"
 */
export function getLanguageName(code: string | null): string {
  if (!code) return 'Unknown';

  const languages: Record<string, string> = {
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian'
  };

  return languages[code] ?? code;
}

/**
 * Formats date to localized string
 *
 * @param date - Date object, null, or undefined
 * @returns Formatted date string or 'Unknown' if null/undefined
 *
 * @example
 * formatDate(new Date('2024-01-15')) // "1/15/2024" (locale-dependent)
 * formatDate(null) // "Unknown"
 */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString();
}

/**
 * Extracts display name from file path
 *
 * @param path - File path (forward slash separated) or null/undefined
 * @returns Last segment of path or 'Unknown' if null/undefined
 *
 * @example
 * getPathDisplayName('/path/to/file.cbz') // "file.cbz"
 * getPathDisplayName('/manga/series') // "series"
 * getPathDisplayName(null) // "Unknown"
 */
export function getPathDisplayName(path: string | null | undefined): string {
  if (!path) return 'Unknown';

  // Extract the last part of the path (filename or directory name)
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}
