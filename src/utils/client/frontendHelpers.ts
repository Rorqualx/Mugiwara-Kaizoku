/**
 * Frontend-safe helper functions for handling file names, cron expressions, and chapter formatting
 * 
 * This module provides utility functions that are safe to use in the frontend/client-side code,
 * focusing on string manipulation, validation, and formatting operations that don't require
 * backend resources.
 */

/**
 * Sanitizes a string by removing special characters and normalizing spaces
 * 
 * @param {string} value - The string to sanitize
 * @returns {string} Sanitized string with special characters replaced by underscores
 * @example
 * sanitizer("file name: with/special*chars") // returns "file_name_with_special_chars"
 */
export const sanitizer = (value: string): string => {
  return value
    .replace(/[/<>"':|?!*{}#%&^+,~\s]/g, "_") 
    .replace(/__+/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, ""); 
};

/**
 * Converts a cron expression to a human-readable label
 * 
 * @param {string} value - The cron expression or "never"
 * @returns {string} Human readable label for the cron expression
 * @example
 * getCronLabel("0 0 * * *") // returns "Schedule: 0 0 * * *"
 * getCronLabel("never") // returns "Never"
 */
export const getCronLabel = (value: string): string => {
  if (value === "never") return "Never";
  return `Schedule: ${value}`;
};

/**
 * Validates a cron expression string (frontend version)
 * 
 * This is a simplified validation that checks basic cron expression format.
 * For full validation, use the backend validator.
 * 
 * @param {string} cron - The cron expression to validate
 * @returns {boolean} True if the expression is valid or "never", false otherwise
 * @example
 * isCronValid("0 0 * * *") // returns true
 * isCronValid("invalid") // returns false
 * isCronValid("never") // returns true
 */
export const isCronValid = (cron: string): boolean => {
  if (cron === "never") {
    return true;
  }
  return /^([*0-9/,-]+ *){5,7}$/.test(cron); 
};

/**
 * Formats a chapter index into a readable title
 * 
 * @param {number} index - Zero-based index of the chapter
 * @returns {string} Formatted chapter title (e.g., "Chapter 1" for index 0)
 * @example
 * formatChapterTitle(0) // returns "Chapter 1"
 * formatChapterTitle(9) // returns "Chapter 10"
 */
export const formatChapterTitle = (index: number): string => {
  return `Chapter ${index + 1}`;
};

/**
 * Represents a chapter from the local filesystem
 * 
 * @interface ChapterFromLocal
 * @property {string} fileName - Name of the chapter file
 * @property {number} index - Zero-based index of the chapter
 * @property {number} size - File size in bytes
 * @property {string} [title] - Optional custom title for the chapter
 */
export interface ChapterFromLocal {
  fileName: string;
  index: number;
  size: number;
  title?: string;
}

/**
 * Represents a chapter from a remote source
 * 
 * This interface contains only the essential properties needed for
 * frontend operations, making it safe for client-side usage.
 * 
 * @interface RemoteChapter
 * @property {string} fileName - Name of the chapter file
 * @property {number} index - Zero-based index of the chapter
 */
export interface RemoteChapter {
  fileName: string;
  index: number;
}
