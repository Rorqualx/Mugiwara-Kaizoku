// @file-size-justified: Unified chapter matching logic with multiple provider extractors - splitting would fragment the matching algorithm
/**
 * Chapter Matching Utilities
 *
 * Utilities for auto-matching provider metadata chapters to scanned files.
 * Supports both:
 * - Chapter-to-chapter matching (file has chapterNumber)
 * - Volume-to-volume matching (file has volumeNumber, matched to chapters in that volume)
 *
 * Extraction logic is in ./chapter-matching-utils/metadata-extractors.ts
 *
 * @module components/library/import-pipeline/utils/chapter-matching-utils
 */

import { MangaFileParser } from '@/utils/parsers/mangaFileParser';

import type {
  MetadataChapter,
  MetadataVolume,
  ScannedFileInfo,
  FileToChapterMapping,
} from '../types';

// Re-export metadata extraction from submodule
export { extractMetadataFromProvider } from './chapter-matching-utils/metadata-extractors';

// ============================================================================
// File Reparsing (ensures volumeNumber is set even for old scan results)
// ============================================================================

/**
 * Parse volume/chapter numbers from filename using MangaFileParser
 * Uses the centralized parser for consistent parsing behavior across the codebase
 */
function parseFileMetadata(filename: string): { volume?: number; chapter?: number } {
  const parsed = MangaFileParser.parse(filename);
  const result: { volume?: number; chapter?: number } = {};
  if (parsed.volume !== undefined) result.volume = parsed.volume;
  if (parsed.chapter !== undefined) result.chapter = parsed.chapter;
  return result;
}

/**
 * Reparse files to ensure volumeNumber and chapterNumber are set
 * This fixes files from old scan results that may not have these fields
 */
export function reparseFiles(files: ScannedFileInfo[]): ScannedFileInfo[] {
  return files.map((file) => {
    // If file already has volume or chapter number, use it
    if (file.volumeNumber !== undefined || file.chapterNumber !== undefined) {
      return file;
    }

    // Parse from filename
    const parsed = parseFileMetadata(file.name);

    return {
      ...file,
      ...(parsed.volume !== undefined && { volumeNumber: parsed.volume }),
      ...(parsed.chapter !== undefined && { chapterNumber: parsed.chapter }),
    };
  });
}

// ============================================================================
// Auto-Matching Algorithm
// ============================================================================

/**
 * Match confidence levels
 */
const MATCH_CONFIDENCE = {
  EXACT: 1.0,          // Exact chapter/volume number match
  VOLUME: 0.95,        // Volume-to-volume match (file is volume, matched to chapters in that volume)
  CLOSE: 0.9,          // Very close match (within 0.1)
  SEQUENTIAL: 0.8,     // Sequential position match when chapter numbers unavailable
  LOW: 0.5,            // Low confidence match
} as const;

/**
 * Check if a file is a volume file (has volumeNumber)
 * Note: A file can have both volumeNumber and chapterNumber (e.g., "Vol 1 Ch 1.cbz")
 * but if it has volumeNumber, we should TRY volume matching first
 */
function hasVolumeNumber(file: ScannedFileInfo): boolean {
  return file.volumeNumber !== undefined;
}

/**
 * Check if a file is ONLY a volume file (has volumeNumber but no chapterNumber)
 * These are definitely volume files
 */
function isVolumeOnlyFile(file: ScannedFileInfo): boolean {
  return file.volumeNumber !== undefined && file.chapterNumber === undefined;
}

/**
 * Check if a file is a chapter file (has chapterNumber)
 */
function isChapterFile(file: ScannedFileInfo): boolean {
  return file.chapterNumber !== undefined;
}

type VolumeMatchResult = { chapter: MetadataChapter | null; confidence: number; reason: string; volumeChapters: MetadataChapter[] };

/**
 * Create a successful volume match result
 */
function createVolumeMatchSuccess(fileVolume: number, volumeChapters: MetadataChapter[], source: string): VolumeMatchResult {
  const first = volumeChapters[0]?.number ?? 0;
  const last = volumeChapters[volumeChapters.length - 1]?.number ?? 0;
  return {
    chapter: volumeChapters[0] ?? null,
    confidence: MATCH_CONFIDENCE.VOLUME,
    reason: `Volume ${fileVolume} match${source}: contains ${volumeChapters.length} chapters (Ch. ${first}-${last})`,
    volumeChapters,
  };
}

/**
 * Find chapters by volumeNumber property on chapters
 */
function findChaptersByVolumeNumber(
  fileVolume: number,
  chapters: MetadataChapter[],
  usedChapterIds: Set<string>
): MetadataChapter[] {
  return chapters
    .filter((ch) => ch.volumeNumber === fileVolume && !usedChapterIds.has(ch.id))
    .sort((a, b) => a.number - b.number);
}

/**
 * Find chapters from MetadataVolume by volume number
 */
function findChaptersFromVolumes(
  fileVolume: number,
  volumes: MetadataVolume[],
  usedChapterIds: Set<string>
): MetadataChapter[] {
  const matchingVolume = volumes.find((v) => v.number === fileVolume);
  if (!matchingVolume) return [];
  return matchingVolume.chapters
    .filter((ch) => !usedChapterIds.has(ch.id))
    .sort((a, b) => a.number - b.number);
}

/**
 * Find the best matching chapter for a volume file
 * Matches the file to the FIRST chapter of the corresponding volume
 *
 * Two strategies:
 * 1. Match by chapter.volumeNumber (preferred - chapters have volumeNumber set)
 * 2. Match by volumes array (fallback - uses MetadataVolume.chapters)
 */
function findBestVolumeMatch(
  file: ScannedFileInfo,
  chapters: MetadataChapter[],
  volumes: MetadataVolume[],
  usedChapterIds: Set<string>
): VolumeMatchResult {
  if (file.volumeNumber === undefined) {
    return { chapter: null, confidence: 0, reason: 'File has no volume number', volumeChapters: [] };
  }

  const fileVolume = file.volumeNumber;

  // Strategy 1: Find chapters by volumeNumber property
  const volumeChapters = findChaptersByVolumeNumber(fileVolume, chapters, usedChapterIds);
  if (volumeChapters.length > 0 && volumeChapters[0]) {
    return createVolumeMatchSuccess(fileVolume, volumeChapters, '');
  }

  // Strategy 2: Find from MetadataVolume array
  const volumeChaptersFromMeta = findChaptersFromVolumes(fileVolume, volumes, usedChapterIds);
  if (volumeChaptersFromMeta.length > 0 && volumeChaptersFromMeta[0]) {
    return createVolumeMatchSuccess(fileVolume, volumeChaptersFromMeta, ' (from volumes)');
  }

  return { chapter: null, confidence: 0, reason: `No chapters found for volume ${fileVolume}`, volumeChapters: [] };
}

/**
 * Find the best matching chapter for a file
 */
function findBestChapterMatch(
  file: ScannedFileInfo,
  chapters: MetadataChapter[],
  usedChapterIds: Set<string>
): { chapter: MetadataChapter | null; confidence: number; reason: string } {
  // If file has no chapter number, we can't match
  if (file.chapterNumber === undefined) {
    return { chapter: null, confidence: 0, reason: 'File has no chapter number' };
  }

  const fileChapter = file.chapterNumber;

  // Look for exact match
  for (const chapter of chapters) {
    if (usedChapterIds.has(chapter.id)) continue;

    if (chapter.number === fileChapter) {
      return {
        chapter,
        confidence: MATCH_CONFIDENCE.EXACT,
        reason: `Exact chapter number match: ${fileChapter}`,
      };
    }
  }

  // Look for close match (handles float-jitter differences like 10 vs 10.0).
  // Tightened from 0.1 to 0.001 so that distinct fractional chapters
  // (e.g. 10.05 vs 10.0) don't collapse onto each other.
  for (const chapter of chapters) {
    if (usedChapterIds.has(chapter.id)) continue;

    if (Math.abs(chapter.number - fileChapter) < 0.001) {
      return {
        chapter,
        confidence: MATCH_CONFIDENCE.CLOSE,
        reason: `Close chapter number match: ${fileChapter} ≈ ${chapter.number}`,
      };
    }
  }

  // No match found
  return { chapter: null, confidence: 0, reason: 'No matching chapter found' };
}

/**
 * Match a single file (volume or chapter) to metadata chapters
 *
 * Priority order:
 * 1. Volume-only files (volumeNumber, no chapterNumber): always volume match
 * 2. Files with volumeNumber: try volume match first, fall back to chapter match
 * 3. Chapter-only files: chapter match
 *
 * Rationale: when a file carries a chapter number, that number identifies the
 * file unambiguously — the volume tag is just contextual ("which volume this
 * chapter belongs to"). The old logic routed every V+C file to the volume
 * bundle first, which consumed every chapter in the bundle (e.g. 1–5) on the
 * first file (V01 C001), leaving V01 C002–C005 with no slot. Chapter match
 * takes priority now; volume fallback covers the genuine "Title 01.cbz" case
 * where the parser couldn't disambiguate.
 */
function matchSingleFile(
  file: ScannedFileInfo,
  chapters: MetadataChapter[],
  volumes: MetadataVolume[],
  usedChapterIds: Set<string>
): FileToChapterMapping {
  // Priority 1: Volume-only files (volume set, no chapter) - definitely volumes
  if (isVolumeOnlyFile(file)) {
    const { chapter, confidence, reason, volumeChapters } = findBestVolumeMatch(file, chapters, volumes, usedChapterIds);
    if (chapter && confidence > 0) {
      volumeChapters.forEach((ch) => usedChapterIds.add(ch.id));
      return { filePath: file.path, file, metadataChapter: chapter, status: 'auto_matched', confidence, matchReason: reason, volumeChapters };
    }
    return { filePath: file.path, file, metadataChapter: null, status: 'unmatched', confidence: 0, matchReason: reason };
  }

  // Priority 2: File names a chapter (regardless of volume tag) — chapter match first.
  // V01 C001 means "chapter 1, in volume 1", not "volume 1 bundle".
  if (isChapterFile(file)) {
    const chapterResult = findBestChapterMatch(file, chapters, usedChapterIds);
    if (chapterResult.chapter && chapterResult.confidence > 0) {
      usedChapterIds.add(chapterResult.chapter.id);
      return { filePath: file.path, file, metadataChapter: chapterResult.chapter, status: 'auto_matched', confidence: chapterResult.confidence, matchReason: chapterResult.reason };
    }

    // No chapter slot left and the file ALSO has a volume tag — fall back to
    // volume-bundle binding so the file still gets a slot (rare; happens when
    // the provider's chapter manifest is sparse).
    if (hasVolumeNumber(file)) {
      const { chapter, confidence, reason, volumeChapters } = findBestVolumeMatch(file, chapters, volumes, usedChapterIds);
      if (chapter && confidence > 0 && volumeChapters.length > 0) {
        volumeChapters.forEach((ch) => usedChapterIds.add(ch.id));
        return { filePath: file.path, file, metadataChapter: chapter, status: 'auto_matched', confidence, matchReason: reason, volumeChapters };
      }
    }

    return { filePath: file.path, file, metadataChapter: null, status: 'unmatched', confidence: 0, matchReason: chapterResult.reason };
  }

  // Priority 3: hasVolumeNumber but not classified as chapter (legacy "Title 01.cbz"
  // case where the parser stamped both fields with the same number).
  if (hasVolumeNumber(file)) {
    const { chapter, confidence, reason, volumeChapters } = findBestVolumeMatch(file, chapters, volumes, usedChapterIds);
    if (chapter && confidence > 0 && volumeChapters.length > 0) {
      volumeChapters.forEach((ch) => usedChapterIds.add(ch.id));
      return { filePath: file.path, file, metadataChapter: chapter, status: 'auto_matched', confidence, matchReason: reason, volumeChapters };
    }
  }

  // Unknown file type: mark as unmatched (will be handled in sequential pass)
  return { filePath: file.path, file, metadataChapter: null, status: 'unmatched', confidence: 0, matchReason: 'No chapter or volume number detected' };
}

/**
 * Sequential matching fallback for unmatched files
 * Volume-only files are only skipped when metadata has actual volume structure;
 * when metadata is flat (synthetic chapters without volumes), volume files
 * participate in sequential matching for correct 1:1 pairing.
 */
function sequentialMatchUnmatchedFiles(
  files: ScannedFileInfo[],
  chapters: MetadataChapter[],
  usedChapterIds: Set<string>,
  mappings: Map<string, FileToChapterMapping>,
  volumes: MetadataVolume[]
): void {
  const hasVolumeMetadata = volumes.length > 0;
  const unmatchedFiles = files.filter((f) => {
    const mapping = mappings.get(f.path);
    if (mapping?.status !== 'unmatched') return false;
    // Only skip volume files when metadata has volume structure to match against
    if (hasVolumeMetadata && isVolumeOnlyFile(f)) return false;
    return true;
  });
  const unusedChapters = chapters.filter((c) => !usedChapterIds.has(c.id)).sort((a, b) => a.number - b.number);

  for (let i = 0; i < unmatchedFiles.length && i < unusedChapters.length; i++) {
    const file = unmatchedFiles[i];
    const chapter = unusedChapters[i];

    if (file && chapter) {
      usedChapterIds.add(chapter.id);
      mappings.set(file.path, {
        filePath: file.path,
        file,
        metadataChapter: chapter,
        status: 'auto_matched',
        confidence: MATCH_CONFIDENCE.SEQUENTIAL,
        matchReason: `Sequential position match: file ${i + 1} → chapter ${chapter.number}`,
      });
    }
  }
}

/**
 * Auto-match files to chapters based on chapter or volume numbers
 *
 * Handles mixed content (volumes and chapters in same batch):
 * - Volume files (volumeNumber, no chapterNumber): match to all chapters in that volume
 * - Chapter files (has chapterNumber): match by chapter number
 * - Unknown files: sequential matching fallback
 */
function duplicateMapping(file: ScannedFileInfo, originalName: string): FileToChapterMapping {
  return {
    filePath: file.path, file, metadataChapter: null,
    status: 'duplicate', confidence: 0,
    matchReason: `Duplicate of ${originalName}`,
  };
}

function checkBundleCoveredDuplicate(
  mapping: FileToChapterMapping,
  file: ScannedFileInfo,
  chapters: MetadataChapter[],
  usedChapterIds: Set<string>,
): FileToChapterMapping {
  if (mapping.status !== 'unmatched' || !isVolumeOnlyFile(file) || file.volumeNumber === undefined) return mapping;
  const volChapters = chapters.filter((c) => c.volumeNumber === file.volumeNumber);
  if (volChapters.length === 0 || !volChapters.every((c) => usedChapterIds.has(c.id))) return mapping;
  return { ...mapping, status: 'duplicate', matchReason: `Volume ${file.volumeNumber} chapters already imported via individual chapter files` };
}

export function autoMatchFilesToChapters(
  files: ScannedFileInfo[],
  chapters: MetadataChapter[],
  volumes: MetadataVolume[] = []
): Map<string, FileToChapterMapping> {
  const mappings = new Map<string, FileToChapterMapping>();
  const usedChapterIds = new Set<string>();
  const seenChapterFile = new Map<number, string>();
  const seenVolumeOnlyFile = new Map<number, string>();

  // G1: chapter files (with C#) get processed BEFORE volume-only files so they
  // can claim their specific chapter slot. Within each class, sort by the
  // relevant number for deterministic order.
  const sortedFiles = [...files].sort((a, b) => {
    const aType = isChapterFile(a) ? 0 : (isVolumeOnlyFile(a) ? 1 : 2);
    const bType = isChapterFile(b) ? 0 : (isVolumeOnlyFile(b) ? 1 : 2);
    if (aType !== bType) return aType - bType;
    if (aType === 0) return (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0);
    if (aType === 1) return (a.volumeNumber ?? 0) - (b.volumeNumber ?? 0);
    return 0;
  });

  for (const file of sortedFiles) {
    // G2: duplicate chapter file (same C# at different path)
    const c = file.chapterNumber;
    if (isChapterFile(file) && c !== undefined && seenChapterFile.has(c)) {
      mappings.set(file.path, duplicateMapping(file, seenChapterFile.get(c) ?? ''));
      continue;
    }
    // G2: duplicate volume-only file (same V# at different path)
    const v = file.volumeNumber;
    if (isVolumeOnlyFile(file) && v !== undefined && seenVolumeOnlyFile.has(v)) {
      mappings.set(file.path, duplicateMapping(file, seenVolumeOnlyFile.get(v) ?? ''));
      continue;
    }

    let mapping = matchSingleFile(file, chapters, volumes, usedChapterIds);
    // G2: bundle-covered duplicate (volume archive whose chapters were all consumed by chapter files)
    mapping = checkBundleCoveredDuplicate(mapping, file, chapters, usedChapterIds);
    mappings.set(file.path, mapping);

    if (mapping.status === 'auto_matched') {
      if (isChapterFile(file) && c !== undefined) seenChapterFile.set(c, file.name);
      if (isVolumeOnlyFile(file) && v !== undefined) seenVolumeOnlyFile.set(v, file.name);
    }
  }

  // Sequential matching for remaining unmatched files
  sequentialMatchUnmatchedFiles(sortedFiles, chapters, usedChapterIds, mappings, volumes);

  return mappings;
}

// ============================================================================
// Mapping Operations
// ============================================================================

/**
 * Manually match a file to a chapter
 */
export function manualMatchFileToChapter(
  mappings: Map<string, FileToChapterMapping>,
  filePath: string,
  chapter: MetadataChapter,
  file: ScannedFileInfo
): Map<string, FileToChapterMapping> {
  const newMappings = new Map(mappings);

  // First, remove the chapter from any other file that might have it
  newMappings.forEach((mapping, path) => {
    if (mapping.metadataChapter?.id === chapter.id && path !== filePath) {
      newMappings.set(path, {
        ...mapping,
        metadataChapter: null,
        status: 'unmatched',
        confidence: 0,
        matchReason: 'Chapter reassigned to another file',
      });
    }
  });

  // Set the new mapping
  newMappings.set(filePath, {
    filePath,
    file,
    metadataChapter: chapter,
    status: 'manual_matched',
    confidence: 1.0,
    matchReason: 'Manually matched by user',
  });

  return newMappings;
}

/**
 * Manually match a file to a volume (matches all chapters in that volume)
 */
export function manualMatchFileToVolume(
  mappings: Map<string, FileToChapterMapping>,
  filePath: string,
  volumeChapters: MetadataChapter[],
  file: ScannedFileInfo
): Map<string, FileToChapterMapping> {
  const newMappings = new Map(mappings);

  if (volumeChapters.length === 0) return newMappings;

  // First, remove all volume chapters from any other files
  const chapterIds = new Set(volumeChapters.map((ch) => ch.id));
  newMappings.forEach((mapping, path) => {
    if (path !== filePath && mapping.metadataChapter && chapterIds.has(mapping.metadataChapter.id)) {
      // Create a new mapping without volumeChapters
      const updatedMapping: FileToChapterMapping = {
        filePath: mapping.filePath,
        file: mapping.file,
        metadataChapter: null,
        status: 'unmatched',
        confidence: 0,
        matchReason: 'Volume reassigned to another file',
      };
      newMappings.set(path, updatedMapping);
    }
  });

  // Sort chapters by number
  const sortedChapters = [...volumeChapters].sort((a, b) => a.number - b.number);
  const firstChapter = sortedChapters[0];

  // Set the new mapping with all chapters in the volume
  if (firstChapter) {
    newMappings.set(filePath, {
      filePath,
      file,
      metadataChapter: firstChapter,
      volumeChapters: sortedChapters,
      status: 'manual_matched',
      confidence: 1.0,
      matchReason: `Manually matched volume with ${sortedChapters.length} chapters`,
    });
  }

  return newMappings;
}

/**
 * Unmatch a file
 */
export function unmatchFile(
  mappings: Map<string, FileToChapterMapping>,
  filePath: string
): Map<string, FileToChapterMapping> {
  const newMappings = new Map(mappings);
  const existing = newMappings.get(filePath);

  if (existing) {
    newMappings.set(filePath, {
      ...existing,
      metadataChapter: null,
      status: 'unmatched',
      confidence: 0,
      matchReason: 'Unmatched by user',
    });
  }

  return newMappings;
}

/**
 * Skip a file (mark as intentionally unmatched)
 */
export function skipFile(
  mappings: Map<string, FileToChapterMapping>,
  filePath: string
): Map<string, FileToChapterMapping> {
  const newMappings = new Map(mappings);
  const existing = newMappings.get(filePath);

  if (existing) {
    newMappings.set(filePath, {
      ...existing,
      metadataChapter: null,
      status: 'skipped',
      confidence: 0,
      matchReason: 'Skipped by user',
    });
  }

  return newMappings;
}

/**
 * Initialize mappings for all files (all unmatched initially)
 */
export function initializeMappings(
  files: ScannedFileInfo[]
): Map<string, FileToChapterMapping> {
  const mappings = new Map<string, FileToChapterMapping>();

  for (const file of files) {
    mappings.set(file.path, {
      filePath: file.path,
      file,
      metadataChapter: null,
      status: 'unmatched',
      confidence: 0,
    });
  }

  return mappings;
}

/**
 * Get matched chapter IDs from mappings
 */
export function getMatchedChapterIds(
  mappings: Map<string, FileToChapterMapping>
): Set<string> {
  const ids = new Set<string>();

  mappings.forEach((mapping) => {
    if (mapping.metadataChapter && mapping.status !== 'unmatched') {
      ids.add(mapping.metadataChapter.id);
    }
  });

  return ids;
}

/**
 * Get unmatched chapters
 */
export function getUnmatchedChapters(
  chapters: MetadataChapter[],
  mappings: Map<string, FileToChapterMapping>
): MetadataChapter[] {
  const matchedIds = getMatchedChapterIds(mappings);
  return chapters.filter((c) => !matchedIds.has(c.id));
}
