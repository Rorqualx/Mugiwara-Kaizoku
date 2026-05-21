/**
 * Rule Processor Module
 *
 * Handles processing of import rules for scanned manga files.
 * Extracted from scanner.ts processMangaGroup method (lines 294-351)
 */

import { prisma } from '@/server/db';
import type { ImportActions, ImportContext, ParsedFileInfo } from '@/types/import-rules';
import { getFileSize } from '@/utils/file-utils';

import type { ImportRuleEngine } from '../importRuleEngine';
import type { ScanItem, ExtendedParsedMangaInfo } from './types';

/**
 * Result of import rule processing
 */
export interface RuleProcessingResult {
  shouldSkip: boolean;
  targetLibraryId: number;
  ruleActions?: ImportActions | undefined;
}

/**
 * Process import rules for a scanned file
 *
 * Builds context, applies rules, and returns actions to take.
 *
 * @param scanItem - The scan item being processed
 * @param mangaPath - Path to the manga directory
 * @param files - List of files in the directory
 * @param libraryId - Target library ID
 * @param ruleEngine - Import rule engine (nullable)
 * @returns Rule processing result with actions and target library
 */
export async function processImportRules(
  scanItem: ScanItem,
  mangaPath: string,
  files: string[],
  libraryId: number,
  ruleEngine: ImportRuleEngine | null
): Promise<RuleProcessingResult> {
  // No rule engine - return defaults
  if (!ruleEngine) {
    return {
      shouldSkip: false,
      targetLibraryId: libraryId,
      ruleActions: undefined
    };
  }

  // Get file size for the first file (for rule matching)
  const firstFile = files[0];
  const fileSize = firstFile !== undefined ? await getFileSize(firstFile) : 0;

  // Create file info for rule processing
  const dirName = mangaPath.split('/').pop() ?? '';
  const extendedParsed = scanItem.parsed as ExtendedParsedMangaInfo;

  const fileInfo: ParsedFileInfo = {
    path: mangaPath,
    filename: dirName,
    size: Number(fileSize),
    title: scanItem.parsed.cleanTitle,
    ...(extendedParsed.group && { group: extendedParsed.group }),
    ...(extendedParsed.language && { language: extendedParsed.language }),
    ...(extendedParsed.volume && { volume: extendedParsed.volume }),
    ...(extendedParsed.chapter && { chapter: extendedParsed.chapter }),
    ...(extendedParsed.chapters && { chapters: extendedParsed.chapters })
  };

  // Create import context
  const context: ImportContext = {
    availableLibraries: await prisma.library.findMany({
      select: {
        id: true,
        name: true,
        path: true
      }
    }),
    existingManga: await prisma.manga.findMany({
      where: { libraryId },
      select: {
        id: true,
        title: true,
        libraryPath: true
      }
    }).then((results) => results.map((m) => ({
      id: m.id,
      title: m.title,
      path: m.libraryPath ?? ''
    }))),
    metadataProviders: ['anilist', 'mangadex', 'comicvine', 'fandom'],
    defaultLibraryId: libraryId
  };

  // Process file through rules
  const actions = await ruleEngine.processFile(fileInfo, context);

  return {
    shouldSkip: actions.skip ?? false,
    targetLibraryId: actions.libraryId ?? libraryId,
    ruleActions: actions
  };
}
