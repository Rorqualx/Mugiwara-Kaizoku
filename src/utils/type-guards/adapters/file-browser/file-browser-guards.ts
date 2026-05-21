/**
 * File Browser Type Guards
 * 
 * Comprehensive type guards and validation utilities for file browser components
 */

import type { 
  DirectoryEntry, 
  BrowseData, 
  DirectoryBrowsingResult,
  FileBrowserNavigation,
  Breadcrumb,
  BreadcrumbsResult
} from '@/hooks/file-browser/types';

/**
 * Type guard for DirectoryEntry
 */
export function isDirectoryEntry(obj: unknown): obj is DirectoryEntry {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const entry = obj as Record<string, unknown>;
  return (
    typeof entry['name'] === 'string' &&
    typeof entry['path'] === 'string' &&
    typeof entry['isDirectory'] === 'boolean' &&
    typeof entry['isAccessible'] === 'boolean'
  );
}

/**
 * Type guard for DirectoryEntry array
 */
export function isDirectoryEntryArray(arr: unknown): arr is DirectoryEntry[] {
  if (!Array.isArray(arr)) return false;
  return arr.every(isDirectoryEntry);
}

/**
 * Type guard for BrowseData
 */
export function isBrowseData(obj: unknown): obj is BrowseData {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const data = obj as Record<string, unknown>;
  return (
    isDirectoryEntryArray(data['entries']) &&
    (data['parent'] === undefined || typeof data['parent'] === 'string') &&
    (data['currentPath'] === undefined || typeof data['currentPath'] === 'string')
  );
}

/**
 * Type guard for DirectoryBrowsingResult
 */
export function isDirectoryBrowsingResult(obj: unknown): obj is DirectoryBrowsingResult {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const result = obj as Record<string, unknown>;
  return (
    (result['browseData'] === null || isBrowseData(result['browseData'])) &&
    typeof result['isLoading'] === 'boolean' &&
    typeof result['hasBrowseCapability'] === 'boolean'
  );
}

/**
 * Type guard for Breadcrumb
 */
export function isBreadcrumb(obj: unknown): obj is Breadcrumb {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const breadcrumb = obj as Record<string, unknown>;
  return (
    typeof breadcrumb['label'] === 'string' &&
    typeof breadcrumb['path'] === 'string'
  );
}

/**
 * Type guard for Breadcrumb array
 */
export function isBreadcrumbArray(arr: unknown): arr is Breadcrumb[] {
  if (!Array.isArray(arr)) return false;
  return arr.every(isBreadcrumb);
}

/**
 * Type guard for BreadcrumbsResult
 */
export function isBreadcrumbsResult(obj: unknown): obj is BreadcrumbsResult {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const result = obj as Record<string, unknown>;
  return (
    isBreadcrumbArray(result['breadcrumbs']) &&
    typeof result['displayPath'] === 'string'
  );
}

/**
 * Type guard for FileBrowserNavigation
 */
export function isFileBrowserNavigation(obj: unknown): obj is FileBrowserNavigation {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const navigation = obj as Record<string, unknown>;
  return (
    (navigation['currentPath'] === undefined || typeof navigation['currentPath'] === 'string') &&
    typeof navigation['manualPath'] === 'string' &&
    typeof navigation['setManualPath'] === 'function' &&
    typeof navigation['handleNavigate'] === 'function' &&
    typeof navigation['handleGoUp'] === 'function' &&
    typeof navigation['handleSelectCurrent'] === 'function' &&
    typeof navigation['handleManualPathSubmit'] === 'function'
  );
}

/**
 * Safe directory entry validator with fallback
 */
export function safeDirectoryEntry(obj: unknown): DirectoryEntry {
  if (isDirectoryEntry(obj)) {
    return obj;
  }
  
  // Return safe fallback
  return {
    name: 'Unknown',
    path: '/',
    isDirectory: false,
    isAccessible: false
  };
}

/**
 * Safe browse data validator with fallback
 */
export function safeBrowseData(obj: unknown): BrowseData {
  if (isBrowseData(obj)) {
    return obj;
  }
  
  // Return safe fallback
  return {
    entries: [],
    parent: undefined,
    currentPath: undefined
  };
}

/**
 * Safe directory browsing result validator with fallback
 */
export function safeDirectoryBrowsingResult(obj: unknown): DirectoryBrowsingResult {
  if (isDirectoryBrowsingResult(obj)) {
    return obj;
  }
  
  // Return safe fallback
  return {
    browseData: null,
    isLoading: false,
    error: null,
    hasBrowseCapability: false
  };
}

/**
 * Path validation utilities
 */
export function isValidPath(path: unknown): path is string {
  return typeof path === 'string' && path.length > 0 && !path.includes('..');
}

export function sanitizePath(path: string): string {
  return path.replace(/[<>:"|?*]/g, '').replace(/\.{2,}/g, '.');
}

/**
 * Error handling utilities
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Navigation validation
 */
export function canNavigateToPath(currentPath: string | undefined, targetPath: string): boolean {
  if (!isValidPath(targetPath)) return false;
  if (!currentPath) return true;
  
  // Prevent navigation outside of allowed scope
  const sanitizedTarget = sanitizePath(targetPath);
  return sanitizedTarget.startsWith('/') && !sanitizedTarget.includes('..');
}

/**
 * Export all guards and utilities
 */
export const FileBrowserGuards = {
  isDirectoryEntry,
  isDirectoryEntryArray,
  isBrowseData,
  isDirectoryBrowsingResult,
  isBreadcrumb,
  isBreadcrumbArray,
  isBreadcrumbsResult,
  isFileBrowserNavigation,
  safeDirectoryEntry,
  safeBrowseData,
  safeDirectoryBrowsingResult,
  isValidPath,
  sanitizePath,
  getSafeErrorMessage,
  canNavigateToPath
};

export default FileBrowserGuards;
