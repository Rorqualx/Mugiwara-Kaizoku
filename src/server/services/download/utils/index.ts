/**
 * Download Service Utilities
 * 
 * Central export point for download service utilities.
 */

export * from './errorHandling';

// Re-export common error class for backward compatibility
export { DownloadError as ApiError } from './errorHandling';