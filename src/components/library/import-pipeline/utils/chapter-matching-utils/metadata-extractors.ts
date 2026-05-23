// @file-size-justified: Multi-provider metadata extraction with complex format handling - splitting by provider would duplicate shared logic
/**
 * Metadata Extractors
 *
 * Functions for extracting volume and chapter metadata from various
 * provider formats (ComicVine, Fandom, AniList, Wikipedia).
 *
 * @module components/library/import-pipeline/utils/chapter-matching-utils/metadata-extractors
 */

import type {
  MetadataChapter,
  MetadataVolume,
  EnrichedProviderMatch,
  ExtractedMetadataResult,
  MetadataSource,
  ScannedFileInfo,
} from '@/components/library/import-pipeline/types';
import type { FandomVolume } from '@/types/provider-metadata.types';

import {
  isComicVineMetadata,
  findComicVineIssuesFromMetadata,
  extractComicVineChapters,
} from './comicvine-extractors';
import {
  isFandomMetadata,
  findFandomVolumesFromMetadata,
  extractFandomChapters,
} from './fandom-extractors';

// ============================================================================
// Type Guards & Helpers
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeGetRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = obj[key];
  return isRecord(value) ? value : undefined;
}

function safeGetNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const value = obj[key];
  return typeof value === 'number' ? value : undefined;
}

// ============================================================================
// Volume File Detection
// ============================================================================

/**
 * Detect if files are predominantly volume files (>50% have volumeNumber)
 */
function detectVolumeFilePattern(files: ScannedFileInfo[]): { isVolumePattern: boolean; volumeCount: number } {
  if (files.length === 0) return { isVolumePattern: false, volumeCount: 0 };
  const volumeFiles = files.filter((f) => f.volumeNumber !== undefined);
  const isVolumePattern = volumeFiles.length > files.length / 2;
  return { isVolumePattern, volumeCount: volumeFiles.length };
}

// ============================================================================
// Synthetic Generation
// ============================================================================

/**
 * Collect extra chapter numbers from files that aren't in the base integer range.
 * Returns decimals (10.5, 3.5) and out-of-range numbers sorted ascending.
 */
function collectExtraChapterNumbers(
  files: ScannedFileInfo[],
  usedNumbers: Set<number>
): number[] {
  const extras: number[] = [];
  for (const file of files) {
    if (file.chapterNumber !== undefined && !usedNumbers.has(file.chapterNumber)) {
      extras.push(file.chapterNumber);
      usedNumbers.add(file.chapterNumber);
    }
  }
  return extras;
}

/**
 * Generate synthetic chapters when no provider chapter data is available.
 *
 * Creates integer chapters from startFrom to startFrom+fileCount, then
 * supplements with any additional chapter numbers found in the actual files
 * (decimals like 10.5, chapter 0, etc.) that aren't already covered.
 */
function generateSyntheticChapters(
  fileCount: number,
  provider: string,
  startFrom: number = 1,
  files?: ScannedFileInfo[]
): MetadataChapter[] {
  const chapters: MetadataChapter[] = [];
  const usedNumbers = new Set<number>();

  // Generate base integer chapters
  const end = startFrom + fileCount;
  for (let i = startFrom; i < end; i++) {
    chapters.push({
      id: `${provider}-synthetic-ch-${i}`,
      provider,
      number: i,
      title: `Chapter ${i}`,
    });
    usedNumbers.add(i);
  }

  // Add chapters for file numbers not covered by the integer range
  // (decimals like 10.5, 3.5, or numbers outside the range)
  if (files) {
    const extras = collectExtraChapterNumbers(files, usedNumbers);
    for (const num of extras) {
      const label = Number.isInteger(num) ? `Chapter ${num}` : `Chapter ${num} (Special)`;
      chapters.push({ id: `${provider}-synthetic-ch-${num}`, provider, number: num, title: label });
    }
  }

  // Sort by chapter number so the list is ordered
  chapters.sort((a, b) => a.number - b.number);
  return chapters;
}

/**
 * Detect the minimum chapter number from scanned files.
 * Returns 0 if any file has chapterNumber 0, otherwise 1.
 */
function detectMinChapterNumber(files?: ScannedFileInfo[]): number {
  if (!files || files.length === 0) return 1;
  const hasChapterZero = files.some((f) => f.chapterNumber === 0);
  return hasChapterZero ? 0 : 1;
}

/** Pick a unique placeholder chapter number for an empty volume (vol*1000 anchor avoids real chapter collisions). */
function chooseVolumePlaceholderNumber(volNum: number, used: Set<number>): number {
  const base = volNum * 1000;
  for (let candidate = base; candidate < base + 100; candidate++) {
    if (!used.has(candidate)) return candidate;
  }
  return -volNum;
}

interface SyntheticGenContext {
  provider: string;
  volumes: MetadataVolume[];
  allChapters: MetadataChapter[];
  usedChapterNumbers: Set<number>;
  volumeMap: Map<number, MetadataVolume>;
}

function makeEmptyVolume(provider: string, v: number): MetadataVolume {
  return { id: `${provider}-vol-${v}`, provider, number: v, title: `Volume ${v}`, chapters: [], chapterCount: 0 };
}

function emitBaseVolumes(ctx: SyntheticGenContext, volumeCount: number, chapterCount: number, startFrom: number): void {
  const chaptersPerVolume = Math.max(1, Math.ceil(chapterCount / volumeCount));
  const isOneToOne = chaptersPerVolume <= 1;
  const maxChapter = startFrom + chapterCount;
  let chapterNum = startFrom;
  for (let v = 1; v <= volumeCount; v++) {
    const vol = makeEmptyVolume(ctx.provider, v);
    for (let c = 0; c < chaptersPerVolume && chapterNum < maxChapter; c++) {
      const chapter: MetadataChapter = {
        id: `${ctx.provider}-vol${v}-ch-${chapterNum}`,
        provider: ctx.provider, number: chapterNum, volumeNumber: v,
        title: isOneToOne ? `Volume ${v}` : `Chapter ${chapterNum}`,
      };
      vol.chapters.push(chapter);
      ctx.allChapters.push(chapter);
      ctx.usedChapterNumbers.add(chapterNum);
      chapterNum++;
    }
    vol.chapterCount = vol.chapters.length;
    ctx.volumes.push(vol);
    ctx.volumeMap.set(v, vol);
  }
}

function attachExtraChapterToVolume(ctx: SyntheticGenContext, chapter: MetadataChapter, v: number): void {
  let vol = ctx.volumeMap.get(v);
  if (!vol) {
    vol = makeEmptyVolume(ctx.provider, v);
    ctx.volumes.push(vol);
    ctx.volumeMap.set(v, vol);
  }
  vol.chapters.push(chapter);
  vol.chapterCount = vol.chapters.length;
}

function addExtraChapter(ctx: SyntheticGenContext, file: ScannedFileInfo): void {
  const c = file.chapterNumber;
  if (c === undefined || ctx.usedChapterNumbers.has(c)) return;
  const v = file.volumeNumber;
  const label = Number.isInteger(c) ? `Chapter ${c}` : `Chapter ${c} (Special)`;
  const chapter: MetadataChapter = { id: `${ctx.provider}-extra-ch-${c}`, provider: ctx.provider, number: c, title: label };
  if (v !== undefined) chapter.volumeNumber = v;
  ctx.allChapters.push(chapter);
  ctx.usedChapterNumbers.add(c);
  if (v !== undefined) attachExtraChapterToVolume(ctx, chapter, v);
}

function addMissingVolume(ctx: SyntheticGenContext, file: ScannedFileInfo): void {
  if (file.chapterNumber !== undefined) return;
  const v = file.volumeNumber;
  if (v === undefined || ctx.volumeMap.has(v)) return;
  const vol = makeEmptyVolume(ctx.provider, v);
  ctx.volumes.push(vol);
  ctx.volumeMap.set(v, vol);
}

function fillEmptyVolumes(ctx: SyntheticGenContext): void {
  for (const vol of ctx.volumes) {
    if (vol.chapters.length > 0) continue;
    const placeholderNum = chooseVolumePlaceholderNumber(vol.number, ctx.usedChapterNumbers);
    const placeholder: MetadataChapter = {
      id: `${ctx.provider}-vol${vol.number}-bundle`, provider: ctx.provider,
      number: placeholderNum, volumeNumber: vol.number, title: `Volume ${vol.number}`,
    };
    vol.chapters.push(placeholder);
    vol.chapterCount = 1;
    ctx.allChapters.push(placeholder);
    ctx.usedChapterNumbers.add(placeholderNum);
  }
}

/**
 * Generate synthetic volumes with chapters.
 *
 * F2: when `files` is passed, supplement the AniList-derived base manifest
 * with file-derived data — decimal chapters, out-of-range chapters, and
 * volumes beyond AniList's reported counts all get slots. Empty volumes
 * get a placeholder chapter so volume-only files (Soul Eater V25.cbz) match.
 */
function generateSyntheticVolumes(
  volumeCount: number,
  chapterCount: number,
  provider: string,
  startFrom: number = 1,
  files?: ScannedFileInfo[],
): { volumes: MetadataVolume[]; chapters: MetadataChapter[] } {
  const ctx: SyntheticGenContext = {
    provider, volumes: [], allChapters: [],
    usedChapterNumbers: new Set<number>(), volumeMap: new Map<number, MetadataVolume>(),
  };
  emitBaseVolumes(ctx, volumeCount, chapterCount, startFrom);
  if (files) {
    for (const file of files) addExtraChapter(ctx, file);
    for (const file of files) addMissingVolume(ctx, file);
  }
  fillEmptyVolumes(ctx);
  ctx.volumes.sort((a, b) => a.number - b.number);
  for (const vol of ctx.volumes) vol.chapters.sort((a, b) => a.number - b.number);
  ctx.allChapters.sort((a, b) => a.number - b.number);
  return { volumes: ctx.volumes, chapters: ctx.allChapters };
}

/**
 * Extract chapter/volume counts from metadata for synthetic generation
 */
// eslint-disable-next-line complexity -- Count extraction from multiple nested metadata paths with provider-specific fields
function extractCountsFromMetadata(
  metadata: Record<string, unknown>
): { chapters: number | null; volumes: number | null } {
  let chapters: number | null = null;
  let volumes: number | null = null;

  chapters = safeGetNumber(metadata, 'chapters') ??
    safeGetNumber(metadata, 'count_of_issues') ??
    safeGetNumber(metadata, 'issueCount') ?? null;
  volumes = safeGetNumber(metadata, 'volumes') ?? safeGetNumber(metadata, 'volumeCount') ?? null;

  const nestedMeta = safeGetRecord(metadata, 'metadata');
  if (nestedMeta) {
    chapters = chapters ?? safeGetNumber(nestedMeta, 'chapters') ?? safeGetNumber(nestedMeta, 'issueCount') ?? null;
    volumes = volumes ?? safeGetNumber(nestedMeta, 'volumes') ?? null;
  }

  const anilistData = safeGetRecord(metadata, 'anilist');
  if (anilistData) {
    chapters = chapters ?? safeGetNumber(anilistData, 'chapters') ?? null;
    volumes = volumes ?? safeGetNumber(anilistData, 'volumes') ?? null;
    const anilistMeta = safeGetRecord(anilistData, 'metadata');
    if (anilistMeta) {
      chapters = chapters ?? safeGetNumber(anilistMeta, 'chapters') ?? null;
      volumes = volumes ?? safeGetNumber(anilistMeta, 'volumes') ?? null;
    }
  }

  return { chapters, volumes };
}

// ============================================================================
// Library Chapter Extraction
// ============================================================================

/**
 * Type for library chapter records from database
 */
interface LibraryChapter {
  id: string;
  number: number;
  title: string;
  volumeNumber?: number;
  coverImage?: string;
  pages?: number;
  releaseDate?: string;
  summary?: string;
}

/**
 * Type for library volume records from database
 */
interface LibraryVolume {
  id: number;
  number: number;
  title?: string;
  coverImage?: string;
  chapterStart?: number;
  chapterEnd?: number;
}

/**
 * Find which volume a chapter belongs to based on libraryVolumes chapterStart/chapterEnd ranges
 * Only matches if BOTH chapterStart and chapterEnd are defined (prevents Volume 0 from capturing all chapters)
 */
function findVolumeForChapter(chapterNum: number, libraryVolumes?: LibraryVolume[]): number | undefined {
  if (!libraryVolumes) return undefined;
  for (const vol of libraryVolumes) {
    // Skip volumes without defined chapter ranges to prevent incorrect assignments
    if (vol.chapterStart === undefined || vol.chapterEnd === undefined) continue;
    if (chapterNum >= vol.chapterStart && chapterNum <= vol.chapterEnd) {
      return vol.number;
    }
  }
  return undefined;
}

/**
 * Extract chapters from libraryChapters array (actual database records)
 * Uses libraryVolumes for:
 * 1. Volume cover images
 * 2. Chapter-to-volume assignment via chapterStart/chapterEnd ranges
 */
function extractLibraryChapters(
  libraryChapters: LibraryChapter[],
  provider: string,
  libraryVolumes?: LibraryVolume[]
): {
  volumes: MetadataVolume[];
  chapters: MetadataChapter[];
} {
  const chapters: MetadataChapter[] = [];
  const volumeMap = new Map<number, MetadataChapter[]>();

  // Build maps from libraryVolumes for cover images, titles, and chapter ranges
  const volumeCoverMap = new Map<number, string>();
  const volumeTitleMap = new Map<number, string>();
  if (libraryVolumes) {
    for (const vol of libraryVolumes) {
      if (vol.coverImage) {
        volumeCoverMap.set(vol.number, vol.coverImage);
      }
      if (vol.title) {
        volumeTitleMap.set(vol.number, vol.title);
      }
    }
  }

  for (const ch of libraryChapters) {
    // Determine volume number: 1) chapter's volumeNumber, 2) libraryVolumes range, 3) undefined
    let volumeNum = ch.volumeNumber;
    if (volumeNum === undefined && libraryVolumes) {
      volumeNum = findVolumeForChapter(ch.number, libraryVolumes);
    }

    const chapter: MetadataChapter = {
      id: ch.id,
      provider,
      number: ch.number,
    };
    if (ch.title) chapter.title = ch.title;
    if (volumeNum !== undefined) chapter.volumeNumber = volumeNum;
    // Chapter cover: use chapter's own cover, or inherit from volume
    const volumeCover = volumeNum !== undefined ? volumeCoverMap.get(volumeNum) : undefined;
    const chapterCover = ch.coverImage ?? volumeCover;
    if (chapterCover) chapter.coverImage = chapterCover;
    if (ch.pages !== undefined) chapter.pages = ch.pages;
    if (ch.releaseDate) chapter.releaseDate = ch.releaseDate;
    if (ch.summary) chapter.summary = ch.summary;

    chapters.push(chapter);

    if (volumeNum !== undefined) {
      const existing = volumeMap.get(volumeNum) ?? [];
      existing.push(chapter);
      volumeMap.set(volumeNum, existing);
    }
  }

  const volumes: MetadataVolume[] = [];
  volumeMap.forEach((volChapters, volNum) => {
    volChapters.sort((a, b) => a.number - b.number);

    // Priority: 1) libraryVolumes cover, 2) first chapter cover
    const volumeCover = volumeCoverMap.get(volNum);
    const firstChapterWithCover = volChapters.find((ch) => ch.coverImage);
    const coverImage = volumeCover ?? firstChapterWithCover?.coverImage;

    const volumeTitle = volumeTitleMap.get(volNum);

    const volume: MetadataVolume = {
      id: `${provider}-vol-${volNum}`,
      provider,
      number: volNum,
      chapters: volChapters,
      chapterCount: volChapters.length,
    };
    if (coverImage) {
      volume.coverImage = coverImage;
    }
    if (volumeTitle) {
      volume.title = volumeTitle;
    }
    volumes.push(volume);
  });

  volumes.sort((a, b) => a.number - b.number);
  chapters.sort((a, b) => a.number - b.number);

  return { volumes, chapters };
}

// ============================================================================
// Enriched Data Processing
// ============================================================================

/**
 * Parse chapter number from enriched chapter data
 */
function parseEnrichedChapterNumber(ch: Record<string, unknown>, idx: number): number {
  if (typeof ch['number'] === 'number') return ch['number'];
  if (typeof ch['chapterNumber'] === 'number') return ch['chapterNumber'];
  if (typeof ch['chapterNumber'] === 'string') return parseInt(ch['chapterNumber'], 10);
  return idx + 1;
}

/**
 * Convert enriched chapter data to MetadataChapter
 */
function convertToMetadataChapter(ch: Record<string, unknown>, idx: number): MetadataChapter {
  const chNum = parseEnrichedChapterNumber(ch, idx);
  const entry: MetadataChapter = { id: `enriched-ch-${chNum}`, provider: 'enriched', number: chNum };
  if (typeof ch['title'] === 'string' && ch['title'].length > 0) entry.title = ch['title'];
  if (typeof ch['volumeNumber'] === 'number') entry.volumeNumber = ch['volumeNumber'];
  if (typeof ch['coverImage'] === 'string') entry.coverImage = ch['coverImage'];
  return entry;
}

/**
 * Apply volume cover inheritance to chapters without covers
 * Returns the volume cover and modifies chapters in place
 */
function applyVolumeCoverInheritance(volChapters: MetadataChapter[]): string | undefined {
  const firstWithCover = volChapters.find((ch) => ch.coverImage);
  const volumeCover = firstWithCover?.coverImage;
  if (volumeCover) {
    for (const chapter of volChapters) {
      if (!chapter.coverImage) {
        chapter.coverImage = volumeCover;
      }
    }
  }
  return volumeCover;
}

/**
 * Extract chapters from enriched chapter data array
 */
function extractEnrichedChapterData(chapterData: unknown[]): { volumes: MetadataVolume[]; chapters: MetadataChapter[] } {
  const chapters = chapterData
    .filter((ch): ch is Record<string, unknown> => isRecord(ch))
    .map(convertToMetadataChapter)
    .sort((a, b) => a.number - b.number);

  const volumeMap = new Map<number, MetadataChapter[]>();
  for (const ch of chapters) {
    if (ch.volumeNumber === undefined) continue;
    const volNum = ch.volumeNumber;
    const existing = volumeMap.get(volNum) ?? [];
    existing.push(ch);
    volumeMap.set(volNum, existing);
  }

  const volumes: MetadataVolume[] = [];
  volumeMap.forEach((volChapters, volNum) => {
    const volumeCover = applyVolumeCoverInheritance(volChapters);
    const volume: MetadataVolume = {
      id: `enriched-vol-${volNum}`, provider: 'enriched', number: volNum,
      chapters: volChapters, chapterCount: volChapters.length,
    };
    if (volumeCover) volume.coverImage = volumeCover;
    volumes.push(volume);
  });

  return { volumes: volumes.sort((a, b) => a.number - b.number), chapters };
}

// ============================================================================
// Result Creation
// ============================================================================

/**
 * Create a result object with source tracking
 */
function createResult(
  volumes: MetadataVolume[],
  chapters: MetadataChapter[],
  source: MetadataSource,
  sourceProvider: string
): ExtractedMetadataResult {
  return {
    volumes,
    chapters,
    source,
    sourceProvider,
    totalChapters: chapters.length,
    totalVolumes: volumes.length,
  };
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Extract metadata chapters and volumes from a provider match
 *
 * IMPORTANT: This function respects the selected provider:
 * - provider === 'library' → Uses libraryChapters from existing manga record
 * - provider === 'comicvine' → Uses ComicVine issues as chapters
 * - provider === 'fandom' → Uses Fandom volume/chapter data
 * - provider === 'anilist' → Uses chapter/volume counts for synthetic generation
 * - Other providers → Falls back to synthetic generation
 */
// eslint-disable-next-line complexity, max-statements -- Multi-provider extraction with nested metadata paths
export function extractMetadataFromProvider(
  match: EnrichedProviderMatch,
  fileCount: number,
  files?: ScannedFileInfo[]
): ExtractedMetadataResult {
  const provider = match.provider.toLowerCase();
  const metadata = match.metadata;

  // Detect if files include chapter 0 (e.g., "[0000]_Chapter_0_...cbz")
  const startFrom = detectMinChapterNumber(files);

  // No metadata at all - generate synthetic chapters from file count
  if (!metadata || !isRecord(metadata)) {
    const chapters = generateSyntheticChapters(fileCount, provider, startFrom, files);
    return createResult([], chapters, 'synthetic', 'generated');
  }

  const metaRecord = metadata as Record<string, unknown>;

  // LIBRARY PROVIDER: Use libraryChapters first (actual database records with covers)
  // This takes priority over enriched data because library chapters have real cover images
  if (provider === 'library') {
    const libraryChapters = metaRecord['libraryChapters'];
    const libraryVolumes = metaRecord['libraryVolumes'];
    if (Array.isArray(libraryChapters) && libraryChapters.length > 0) {
      const volumesArray = Array.isArray(libraryVolumes) ? libraryVolumes as LibraryVolume[] : undefined;
      const result = extractLibraryChapters(libraryChapters as LibraryChapter[], 'library', volumesArray);
      if (result.chapters.length > 0) {
        return createResult(result.volumes, result.chapters, 'library', 'library');
      }
    }
    const chapters = generateSyntheticChapters(fileCount, 'library', startFrom, files);
    return createResult([], chapters, 'synthetic', 'library');
  }

  // ENRICHED DATA: Check for volumeData/chapterData from enrichment modal
  // These fields are populated when user selects a provider for Volume/Chapter Data
  const enrichedVolumeData = metaRecord['volumeData'];
  const enrichedChapterData = metaRecord['chapterData'];

  if (Array.isArray(enrichedVolumeData) && enrichedVolumeData.length > 0) {
    const result = extractFandomChapters({ volumeData: enrichedVolumeData as FandomVolume[] }, 'enriched');
    if (result.chapters.length > 0 || result.volumes.length > 0) {
      return createResult(result.volumes, result.chapters, 'provider', 'fandom');
    }
  }

  if (Array.isArray(enrichedChapterData) && enrichedChapterData.length > 0) {
    const extractedChapters = extractEnrichedChapterData(enrichedChapterData);
    if (extractedChapters.chapters.length > 0) {
      return createResult(extractedChapters.volumes, extractedChapters.chapters, 'provider', 'fandom');
    }
  }

  // COMICVINE PROVIDER: Use issues as chapters
  if (provider === 'comicvine' || provider.includes('comicvine')) {
    const issues = findComicVineIssuesFromMetadata(metaRecord);
    if (issues && issues.length > 0) {
      const chapters = extractComicVineChapters({ issues }, 'comicvine');
      if (chapters.length > 0) {
        return createResult([], chapters, 'provider', 'comicvine');
      }
    }
    if (isComicVineMetadata(metadata)) {
      const chapters = extractComicVineChapters(metadata, 'comicvine');
      if (chapters.length > 0) {
        return createResult([], chapters, 'provider', 'comicvine');
      }
    }
  }

  // FANDOM PROVIDER: Use volume/chapter data
  if (provider === 'fandom' || provider.includes('fandom')) {
    const volumeData = findFandomVolumesFromMetadata(metaRecord);
    if (volumeData && volumeData.length > 0) {
      const result = extractFandomChapters({ volumeData }, 'fandom');
      if (result.chapters.length > 0 || result.volumes.length > 0) {
        return createResult(result.volumes, result.chapters, 'provider', 'fandom');
      }
    }
    if (isFandomMetadata(metadata)) {
      const result = extractFandomChapters(metadata, 'fandom');
      if (result.chapters.length > 0 || result.volumes.length > 0) {
        return createResult(result.volumes, result.chapters, 'provider', 'fandom');
      }
    }
  }

  // ANILIST PROVIDER: Extract counts for synthetic generation
  if (provider === 'anilist' || provider.includes('anilist')) {
    const { chapters: chapterCount, volumes: volumeCount } = extractCountsFromMetadata(metaRecord);

    if (volumeCount !== null && volumeCount > 0) {
      const chCount = chapterCount ?? fileCount;
      if (chCount > 0) {
        const result = generateSyntheticVolumes(volumeCount, chCount, 'anilist', startFrom, files);
        return createResult(result.volumes, result.chapters, 'synthetic', 'anilist');
      }
    }

    if (chapterCount !== null && chapterCount > 0) {
      if (files && files.length > 0) {
        const { isVolumePattern, volumeCount } = detectVolumeFilePattern(files);
        if (isVolumePattern) {
          const result = generateSyntheticVolumes(volumeCount, chapterCount, 'anilist', startFrom, files);
          return createResult(result.volumes, result.chapters, 'synthetic', 'anilist');
        }
      }
      const chapters = generateSyntheticChapters(chapterCount, 'anilist', startFrom, files);
      return createResult([], chapters, 'synthetic', 'anilist');
    }
  }

  // FALLBACK: Try to extract counts from any provider, then generate synthetic
  const { chapters: chapterCount, volumes: volumeCount } = extractCountsFromMetadata(metaRecord);

  if (volumeCount !== null && volumeCount > 0) {
    const chCount = chapterCount ?? fileCount;
    if (chCount > 0) {
      const result = generateSyntheticVolumes(volumeCount, chCount, provider, startFrom, files);
      return createResult(result.volumes, result.chapters, 'synthetic', provider);
    }
  }

  if (chapterCount !== null && chapterCount > 0) {
    if (files && files.length > 0) {
      const { isVolumePattern, volumeCount } = detectVolumeFilePattern(files);
      if (isVolumePattern) {
        const result = generateSyntheticVolumes(volumeCount, chapterCount, provider, startFrom, files);
        return createResult(result.volumes, result.chapters, 'synthetic', provider);
      }
    }
    const chapters = generateSyntheticChapters(chapterCount, provider, startFrom, files);
    return createResult([], chapters, 'synthetic', provider);
  }

  // Final fallback: generate based on file count
  if (files && files.length > 0) {
    const { isVolumePattern, volumeCount } = detectVolumeFilePattern(files);
    if (isVolumePattern) {
      const result = generateSyntheticVolumes(volumeCount, fileCount, provider, startFrom, files);
      return createResult(result.volumes, result.chapters, 'synthetic', 'generated');
    }
  }
  const chapters = generateSyntheticChapters(fileCount, provider, startFrom, files);
  return createResult([], chapters, 'synthetic', 'generated');
}

/**
 * Legacy wrapper for backward compatibility
 * @deprecated Use extractMetadataFromProvider which returns ExtractedMetadataResult
 */
export function extractMetadataFromProviderLegacy(
  match: EnrichedProviderMatch,
  fileCount: number
): { volumes: MetadataVolume[]; chapters: MetadataChapter[] } {
  const result = extractMetadataFromProvider(match, fileCount);
  return { volumes: result.volumes, chapters: result.chapters };
}
