/**
 * Import Profile Parsing Helpers
 * Extracts and parses import profile information
 */

import { logger } from '@/utils/logger';

import type { ImportProfile, ProviderMetadataRecord } from './types';

/**
 * Extract import profile from provider metadata
 * Complexity: 3
 */
export function extractImportProfile(
  providerMeta: ProviderMetadataRecord
): ImportProfile | null {
  const rawImportProfile = providerMeta['importProfile'];
  return rawImportProfile && typeof rawImportProfile === 'object' ? rawImportProfile as ImportProfile : null;
}

/**
 * Resolve chapter source from import profile
 * Complexity: 6
 */
export function resolveChapterSource(importProfile: ImportProfile): string {
  let chapterSource = typeof (importProfile['chapterSource'] ?? importProfile['primarySource']) === 'string'
    ? String(importProfile['chapterSource'] ?? importProfile['primarySource'])
    : 'unknown';

  if (chapterSource === 'primary') {
    chapterSource = typeof importProfile['primarySource'] === 'string' ? importProfile['primarySource'] : 'unknown';
    logger.info(`[chapterOrchestrator] Resolved chapterSource from 'primary' to '${chapterSource}'`);
  }

  return chapterSource;
}

/**
 * Log import profile information
 * Complexity: 2
 */
export function logImportProfile(importProfile: ImportProfile): void {
  logger.info('[chapterOrchestrator] Found import profile:', {
    primarySource: importProfile['primarySource'],
    chapterSource: importProfile['chapterSource'],
    selectedChapters: importProfile['selectedChapters']
  });
}
