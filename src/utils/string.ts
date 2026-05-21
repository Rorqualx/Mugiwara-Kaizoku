/**
 * String utility functions
 * Provides common string manipulation and validation utilities
 */

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
  if (!str) return '';
  return str.split(' ').map(capitalize).join(' ');
}

/**
 * Convert string to slug format
 */
export function toSlug(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Add hyphen between camelCase
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .toLowerCase();
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/[-_\s]+(.)?/g, (_match: string, c: string) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, (_match: string, c: string) => c.toLowerCase());
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  if (!str) return '';
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2') // Add underscore between camelCase
    .replace(/[-\s]+/g, '_') // Replace hyphens and spaces with underscores
    .toLowerCase();
}

/**
 * Truncate string to specified length
 */
export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (!str || str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Remove HTML tags from string
 */
export function stripHtml(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };
  return str.replace(/[&<>"'/]/g, s => htmlEntities[s] ?? s);
}

/**
 * Unescape HTML entities
 */
export function unescapeHtml(str: string): string {
  if (!str) return '';
  const htmlEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x2F;': '/',
  };
  return str.replace(/&[#\w]+;/g, entity => htmlEntities[entity] ?? entity);
}

/**
 * Check if string is empty or whitespace only
 */
export function isBlank(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Check if string is not empty
 */
export function isNotBlank(str: string | null | undefined): str is string {
  return !isBlank(str);
}

/**
 * Pad string to specified length
 */
export function padStart(str: string, length: number, padChar: string = ' '): string {
  if (!str) return padChar.repeat(length);
  if (str.length >= length) return str;
  return padChar.repeat(length - str.length) + str;
}

/**
 * Pad string to specified length (end)
 */
export function padEnd(str: string, length: number, padChar: string = ' '): string {
  if (!str) return padChar.repeat(length);
  if (str.length >= length) return str;
  return str + padChar.repeat(length - str.length);
}

/**
 * Remove specified characters from start of string
 */
export function trimStart(str: string, chars: string = ' '): string {
  if (!str) return '';
  const pattern = new RegExp(`^[${chars.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}]+`);
  return str.replace(pattern, '');
}

/**
 * Remove specified characters from end of string
 */
export function trimEnd(str: string, chars: string = ' '): string {
  if (!str) return '';
  const pattern = new RegExp(`[${chars.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}]+$`);
  return str.replace(pattern, '');
}

/**
 * Remove specified characters from both ends of string
 */
export function trim(str: string, chars: string = ' '): string {
  return trimEnd(trimStart(str, chars), chars);
}

/**
 * Split string by delimiter with limit
 */
export function split(str: string, delimiter: string | RegExp, limit?: number): string[] {
  if (!str) return [];
  const parts = str.split(delimiter);
  if (limit && parts.length > limit) {
    const result = parts.slice(0, limit - 1);
    result.push(parts.slice(limit - 1).join(typeof delimiter === 'string' ? delimiter : ''));
    return result;
  }
  return parts;
}

/**
 * Check if string contains substring (case insensitive)
 */
export function containsIgnoreCase(str: string, substring: string): boolean {
  if (!str || !substring) return false;
  return str.toLowerCase().includes(substring.toLowerCase());
}

/**
 * Check if string starts with prefix (case insensitive)
 */
export function startsWithIgnoreCase(str: string, prefix: string): boolean {
  if (!str || !prefix) return false;
  return str.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * Check if string ends with suffix (case insensitive)
 */
export function endsWithIgnoreCase(str: string, suffix: string): boolean {
  if (!str || !suffix) return false;
  return str.toLowerCase().endsWith(suffix.toLowerCase());
}

/**
 * Remove duplicate whitespace
 */
export function normalizeWhitespace(str: string): string {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Generate random string
 */
export function randomString(length: number, chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  if (!str1) return str2 ? str2.length : 0;
  if (!str2) return str1.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  const firstRow = matrix[0];
  if (firstRow) {
    for (let j = 0; j <= str1.length; j++) {
      firstRow[j] = j;
    }
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];
      if (!currentRow || !prevRow) continue;

      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        const diagValue = prevRow[j - 1];
        if (diagValue !== undefined) {
          currentRow[j] = diagValue;
        }
      } else {
        const diagValue = prevRow[j - 1];
        const leftValue = currentRow[j - 1];
        const topValue = prevRow[j];
        if (diagValue !== undefined && leftValue !== undefined && topValue !== undefined) {
          currentRow[j] = Math.min(
            diagValue + 1, // substitution
            leftValue + 1, // insertion
            topValue + 1 // deletion
          );
        }
      }
    }
  }

  const lastRow = matrix[str2.length];
  const result = lastRow?.[str1.length];
  return result ?? 0;
}

/**
 * Calculate similarity between two strings (0-1)
 */
export function similarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number, separator: string = ','): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Parse number from string
 */
export function parseNumber(str: string): number | null {
  if (!str) return null;
  const num = parseFloat(str.replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
}

export default {
  capitalize,
  capitalizeWords,
  toSlug,
  toKebabCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  truncate,
  stripHtml,
  escapeHtml,
  unescapeHtml,
  isBlank,
  isNotBlank,
  padStart,
  padEnd,
  trimStart,
  trimEnd,
  trim,
  split,
  containsIgnoreCase,
  startsWithIgnoreCase,
  endsWithIgnoreCase,
  normalizeWhitespace,
  randomString,
  levenshteinDistance,
  similarity,
  formatNumber,
  parseNumber,
};
