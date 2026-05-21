/**
 * File Parser Module
 *
 * Handles parsing of manga information from file names and directory structures.
 * Supports embedded ComicInfo.xml metadata from CBZ archives.
 * Extracted from scanner.ts processMangaGroup method (lines 264-287)
 *
 * @module file-parser
 */

import * as path from 'path';

import { readComicInfoFromFirstArchive } from '@/utils/parsers/comicinfo-reader';
import type { ComicInfoData } from '@/utils/parsers/comicinfo-reader';
import { MangaFileParser } from '@/utils/parsers/mangaFileParser';
import type { ParsedMangaInfo } from '@/utils/parsers/mangaFileParser';
import { serverLogger } from '@/utils/serverLogger';

/**
 * Parse manga information from a list of files.
 *
 * Priority order for title:
 * 1. ComicInfo.xml `Series` field (most reliable - embedded metadata)
 * 2. Consistent title from filename parsing
 * 3. Directory name parsing
 *
 * Year is extracted from ComicInfo.xml or directory name.
 *
 * @param mangaPath - Path to the manga directory
 * @param files - List of manga files in the directory
 * @param parseFileNames - Whether to parse file names for metadata
 * @returns Parsed manga information
 */
export function parseMangaFromFiles(
  mangaPath: string,
  files: string[],
  parseFileNames: boolean
): ParsedMangaInfo {
  const dirName = path.basename(mangaPath);

  if (parseFileNames) {
    // Parse all files and extract consistent title
    const parsedFiles = files.map((f) => MangaFileParser.parse(f));
    const consistentTitle = MangaFileParser.extractConsistentTitle(parsedFiles);

    if (consistentTitle) {
      // Also parse directory name to get year even when using consistent title
      const dirParsed = MangaFileParser.parse(dirName);
      const result: ParsedMangaInfo = {
        original: dirName,
        title: consistentTitle,
        cleanTitle: consistentTitle,
      };
      if (dirParsed.year !== undefined) result.year = dirParsed.year;
      if (dirParsed.yearEnd !== undefined) result.yearEnd = dirParsed.yearEnd;
      return result;
    }

    // Fall back to parsing directory name
    return MangaFileParser.parse(dirName);
  }

  // No parsing - use directory name as-is
  return {
    original: dirName,
    title: dirName,
    cleanTitle: dirName
  };
}

/**
 * Parse manga information with ComicInfo.xml support.
 *
 * Async version that reads embedded metadata from CBZ archives
 * to get more accurate series names and years.
 *
 * @param mangaPath - Path to the manga directory
 * @param files - List of manga files in the directory
 * @param parseFileNames - Whether to parse file names for metadata
 * @returns Parsed manga information enriched with ComicInfo.xml data
 */
export async function parseMangaFromFilesWithComicInfo(
  mangaPath: string,
  files: string[],
  parseFileNames: boolean
): Promise<ParsedMangaInfo> {
  // Start with standard file parsing
  const parsed = parseMangaFromFiles(mangaPath, files, parseFileNames);

  // Try to read ComicInfo.xml from the first archive
  const comicInfo = await readComicInfoFromFirstArchive(files);
  if (!comicInfo) return parsed;

  return applyComicInfoToResult(parsed, comicInfo, mangaPath);
}

/**
 * Apply ComicInfo.xml metadata to a parsed result.
 * ComicInfo.xml `Series` field overrides filename-derived title.
 */
function applyComicInfoToResult(
  parsed: ParsedMangaInfo,
  comicInfo: ComicInfoData,
  mangaPath: string
): ParsedMangaInfo {
  const result = { ...parsed };

  // Series name from ComicInfo.xml is the most reliable title source
  if (comicInfo.series) {
    serverLogger.info('[FileParser] Using ComicInfo.xml series name', {
      path: mangaPath,
      comicInfoSeries: comicInfo.series,
      filenameDerived: parsed.cleanTitle,
    });
    result.title = comicInfo.series;
    result.cleanTitle = comicInfo.series;
  }

  // Use ComicInfo.xml year if not already set from directory name
  if (comicInfo.year !== undefined && result.year === undefined) {
    result.year = comicInfo.year;
  }

  // Use publisher from ComicInfo.xml if not already set
  if (comicInfo.publisher !== undefined && result.publisher === undefined) {
    result.publisher = comicInfo.publisher;
  }

  return result;
}
