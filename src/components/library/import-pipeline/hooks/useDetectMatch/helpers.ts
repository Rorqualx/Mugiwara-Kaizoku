/**
 * useDetectMatch Helpers
 *
 * Helper functions for the combined detect+match hook.
 *
 * @module components/library/import-pipeline/hooks/useDetectMatch/helpers
 */

import type { Dispatch, SetStateAction } from 'react';

import type {
  PipelineAction,
  ScannedMangaItem,
  ScannedFileInfo,
  EnrichedProviderMatch,
  DetectMatchProgress,
} from '@/components/library/import-pipeline/types';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ScanJobFileInfo {
  name: string;
  path: string;
  size: number;
  chapterNumber?: number;
  volumeNumber?: number;
  extension: string;
}

export interface ScanJobItem {
  path: string;
  title?: string;
  parsed?: { title?: string; cleanTitle?: string };
  chapters?: number;
  fileSize?: number;
  status?: string;
  error?: string;
  mangaId?: number;
  /** Publication year from folder name parsing */
  year?: number | null;
  files?: ScanJobFileInfo[];
  /** Title of existing manga (for duplicates) */
  duplicateTitle?: string | null;
  /** Cover image URL of existing manga (for duplicates) */
  duplicateCoverImage?: string | null;
  /** Similarity score from duplicate detection (0-1) */
  duplicateScore?: number | null;
}

export interface SearchResultWithScore {
  id: string;
  title: string;
  provider: string;
  description?: string | undefined;
  coverImage?: string | undefined;
  confidence: number;
  siteDetailUrl?: string | undefined;
  url?: string | undefined;
  wikiUrl?: string | undefined;
  year?: number | undefined;
  chapters?: number | undefined;
  volumes?: number | undefined;
  genres?: string[] | undefined;
  status?: string | undefined;
  authors?: string[] | undefined;
  artists?: string[] | undefined;
  publisher?: string | undefined;
}

export interface ScanJobResult {
  items?: ScanJobItem[];
  totalFiles?: number;
  processed?: number;
}

// ============================================================================
// Mapping Functions
// ============================================================================

function mapFileInfo(file: ScanJobFileInfo): ScannedFileInfo {
  const result: ScannedFileInfo = {
    name: file.name,
    path: file.path,
    size: file.size,
    extension: file.extension,
  };
  if (file.chapterNumber !== undefined) result.chapterNumber = file.chapterNumber;
  if (file.volumeNumber !== undefined) result.volumeNumber = file.volumeNumber;
  return result;
}

/** Display label used in the wizard when no real title was derivable. The user
 * is expected to click into the row and type the correct title before the
 * Import stage will accept it. The scanner used to emit the literal string
 * `Unknown` here, which silently created `manga.title = 'Unknown'` rows; this
 * sentinel + `requiresManualTitle` flag prevents that. */
const MANUAL_TITLE_PLACEHOLDER = '(needs title)';
const PLACEHOLDER_TITLE_RE = /^(?:unknown|volume|volumes|chapter|chapters|tome|tomes|part|parts|book|books)$/i;

function isPlaceholderTitle(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return PLACEHOLDER_TITLE_RE.test(trimmed);
}

interface DerivedTitle {
  title: string;
  cleanTitle: string;
  requiresManualTitle: boolean;
}

function deriveScanItemTitle(item: ScanJobItem): DerivedTitle {
  const rawTitle = item.title ?? item.parsed?.title ?? null;
  const rawClean = item.parsed?.cleanTitle ?? item.title ?? null;
  const requiresManualTitle = isPlaceholderTitle(rawTitle) && isPlaceholderTitle(rawClean);
  const title = requiresManualTitle ? MANUAL_TITLE_PLACEHOLDER : (rawTitle ?? rawClean ?? MANUAL_TITLE_PLACEHOLDER);
  const cleanTitle = requiresManualTitle ? '' : (rawClean ?? rawTitle ?? '');
  return { title, cleanTitle, requiresManualTitle };
}

export function mapJobItemToScannedItem(item: ScanJobItem, idx: number): ScannedMangaItem {
  const { title, cleanTitle, requiresManualTitle } = deriveScanItemTitle(item);

  // Extract year from job result or parse from folder path
  const year = item.year ?? extractYearFromPath(item.path);

  logger.info('[SCAN] mapJobItemToScannedItem', {
    idx,
    itemPath: item.path,
    computedTitle: title,
    computedCleanTitle: cleanTitle,
    requiresManualTitle,
    year,
  });

  const result: ScannedMangaItem = {
    id: `scan-${idx}-${item.path.replace(/\//g, '-')}`,
    path: item.path,
    parsedTitle: title,
    cleanTitle,
    fileCount: item.chapters ?? 0,
    fileSize: item.fileSize ?? 0,
    isDuplicate: item.status === 'exists',
  };

  if (requiresManualTitle) result.requiresManualTitle = true;
  if (year !== undefined) result.year = year;
  if (item.mangaId !== undefined) result.duplicateOfId = item.mangaId;
  if (item.duplicateTitle) result.duplicateOfTitle = item.duplicateTitle;
  if (item.duplicateCoverImage) result.duplicateCoverImage = item.duplicateCoverImage;
  if (item.duplicateScore !== undefined && item.duplicateScore !== null) result.duplicateScore = item.duplicateScore;
  if (item.error !== undefined) result.error = item.error;
  if (item.files?.length) result.files = item.files.map(mapFileInfo);

  return result;
}

// ============================================================================
// Search Helpers
// ============================================================================

/** Bare format suffixes that should be stripped from titles */
const BARE_FORMAT_SUFFIXES_RE = /\s+(?:pdf|cbz|cbr|epub|mobi|azw3?)$/i;

/**
 * Extract year from a folder path like "/path/to/Monster (1995)"
 * Used as fallback when the job result doesn't include year.
 */
export function extractYearFromPath(folderPath: string): number | undefined {
  const basename = folderPath.split('/').pop() ?? '';
  const match = basename.match(/[([{]((?:19|20)\d{2})[)\]}]/);
  if (match?.[1]) {
    const year = parseInt(match[1], 10);
    if (year >= 1900 && year <= 2099) return year;
  }
  return undefined;
}

export function normalizeSearchTitle(title: string): string {
  let normalized = title;
  // Remove bracketed metadata (years, groups, formats)
  normalized = normalized.replace(/\s*[[(][^\])]*(?:manga|scan|digital|sd|hd|web|raw|eng|jpn|group|release|\d{4}(?:-\d{4})?)[^\])]*[\])]/gi, '');
  normalized = normalized.replace(/\s*(?:v|vol\.?|volume)\s*\d+(?:-\d+)?/gi, '');
  normalized = normalized.replace(/\s*(?:c|ch\.?|chapter)\s*\d+(?:-\d+)?/gi, '');
  normalized = normalized.replace(/\s*[[(]\d{4}[\])]/g, '');
  normalized = normalized.replace(/\s*[[(](?:digital|scan|raw|hq|lq|sd|hd|web|webrip|cbz|cbr|pdf|epub)[\])]/gi, '');
  normalized = normalized.replace(/\s*[[(][A-Z0-9]{2,10}[\])]\s*$/gi, '');
  normalized = normalized.replace(/\s*\([^)]*(?:manga|digital|scan|raw|eng|jpn)\s*\)\s*$/gi, '');
  // Strip ~Subtitle~ decorative blocks — common in romaji titles like
  // "Völundio ~Divergent Sword Saga~" or "Sousou no Frieren ~Prelude~".
  // AniList search chokes on tildes and the wrapped subtitle is rarely
  // useful for matching anyway (it's the subtitle of the main series).
  normalized = normalized.replace(/\s*~[^~]+~\s*/g, ' ');
  // Remove bare format suffixes (e.g., "Attack on Titan pdf" → "Attack on Titan")
  normalized = normalized.replace(BARE_FORMAT_SUFFIXES_RE, '');
  // Remove trailing bare digits — but DON'T strip 4-digit pre-1960 tokens,
  // they're almost always part of the canonical title rather than a volume
  // number or publication year ("Strike Witches 1937" = Witches unit number,
  // "Captain Tsubasa: World Youth" sub-series with year disambig, etc.).
  // Post-1960 4-digit values ARE stripped: matches publication-year suffix
  // ("Monster 1995") or volume-as-year folder name. Short standalone numbers
  // ("Dorohedoro 1") always strip — those are volume markers.
  const trailingDigitsRe = /\s+(\d+)$/;
  const trailingMatch = trailingDigitsRe.exec(normalized);
  if (trailingMatch?.[1] !== undefined) {
    const digits = trailingMatch[1];
    const numeric = parseInt(digits, 10);
    const isFourDigitYearShaped = digits.length === 4 && numeric >= 1900 && numeric <= 2099;
    if (!isFourDigitYearShaped || numeric >= 1960) {
      normalized = normalized.replace(trailingDigitsRe, '');
    }
  }
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized || title;
}

/**
 * Spinoff/variant markers that, when present in a result title but NOT the
 * query, indicate the result is a side-series we should not pick when the
 * query targets a main series. e.g. result "Re:ZERO ... Ex" should NOT win
 * over "Re:Zero - Starting Life in Another World" when query is the latter.
 * Word-boundary match avoids penalizing "Hexagon" for containing "ex".
 */
const SPINOFF_MARKERS = [
  'ex',
  'anima',
  'smash',
  'prototype',
  'anthology',
  'collection',
  'compilation',
  'omnibus',
  'gaiden',
  'side story',
  'side stories',
  'spin-off',
  'spinoff',
  'specials',
  'special',
  'one-shot',
  'oneshot',
  'omake',
  'novelization',
  'prelude',
  'epilogue',
  'memories',
];
const SPINOFF_MARKER_RE = new RegExp(`\\b(${SPINOFF_MARKERS.map((m) => m.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'i');

/**
 * Returns the multiplier applied for spinoff markers in the result title.
 * 1.0 means no penalty. 0.7 means the result has a marker the query does not.
 */
function spinoffPenaltyFactor(queryLower: string, titleLower: string): number {
  // Penalty only fires when the result has a marker the query doesn't share —
  // so a Chainsaw Man - Color folder still matches Chainsaw Man cleanly.
  const titleMatch = SPINOFF_MARKER_RE.exec(titleLower);
  if (!titleMatch) return 1.0;
  const queryMatch = SPINOFF_MARKER_RE.exec(queryLower);
  if (queryMatch && queryMatch[1] === titleMatch[1]) return 1.0;
  return 0.7;
}

/**
 * NFKD-normalize + strip combining marks so "Völundio" matches "Volundio"
 * and "Sōsō no Frieren" matches "Soso no Frieren" both directions.
 */
function foldDiacritics(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

// Tokens that, when present in the query but missing from a substring-matching
// result, signal the result is a less-specific parent series. "Strike Witches
// 1937" should NOT match parent "Strike Witches"; "Code Geass: Lelouch of the
// Rebellion Re;" should NOT match parent "Code Geass: Lelouch of the
// Rebellion". When a disambiguator is detected in the missing portion, we
// apply a 0.5x multiplier instead of the usual 0.95x.
const QUERY_DISAMBIGUATOR_RE = /(?:^|\s|[-:;,])\s*(?:19[0-9]{2}|20[0-9]{2}|re(?:[:;]|$|\s)|i{2,4}|iv|season\s+\d+|part\s+\d+|chapter\s+\d+)(?:$|\s|[-:;,])/i;
const stripPunct = (s: string): string => s.replace(/&amp;/gi, '&').replace(/[_\-:;,.&']/g, ' ').replace(/\s+/g, ' ').trim();

function scoreSingleTitle(normalizedQuery: string, normalizedTitle: string): number {
  const sq = stripPunct(normalizedQuery); // M11: strip _-:;,.&' for comparison
  const st = stripPunct(normalizedTitle);
  if (sq === st) return 1.0;
  if (st.includes(sq) || sq.includes(st)) {
    const longer = Math.max(sq.length, st.length);
    const shorter = Math.min(sq.length, st.length);
    const ratio = shorter / longer;
    let multiplier = 0.95;
    if (st.length < sq.length) {
      const missing = sq.replace(st, '').trim();
      if (missing.length > 0 && QUERY_DISAMBIGUATOR_RE.test(` ${missing} `)) {
        multiplier = 0.5;
      }
    }
    return ratio * multiplier;
  }
  const queryWords = sq.split(/\s+/).filter(Boolean);
  const titleWords = st.split(/\s+/).filter(Boolean);
  const matchingWords = queryWords.filter((word) => titleWords.some((tw) => tw.includes(word) || word.includes(tw)));
  const matchRatio = matchingWords.length / Math.max(queryWords.length, titleWords.length);
  return matchRatio * 0.8;
}

/**
 * Score `query` against `resultTitle` plus any alternative titles, returning
 * the best confidence among them. Folds diacritics so a folder named
 * "Iken Senki Volundio" matches AniList romaji "Iken Senki Völundio" without
 * the user typing the umlaut.
 *
 * Spinoff penalty is applied based on the PRIMARY title only — an anthology
 * named "Junji Ito Horror Comic Collection" carrying "Tomie" in its altTitles
 * should not beat the standalone "Tomie" main series even if the altTitle
 * matches 100%.
 */
export function calculateConfidence(
  query: string,
  resultTitle: string,
  altTitles?: readonly string[],
): number {
  const normalizedQuery = foldDiacritics(query.toLowerCase().trim());
  const normalizedPrimary = foldDiacritics(resultTitle.toLowerCase().trim());
  const titles = [resultTitle, ...(altTitles ?? [])]
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .map((t) => foldDiacritics(t.toLowerCase().trim()));
  let bestPrimaryScore = 0;
  let bestAltScore = 0;
  for (const t of titles) {
    const s = scoreSingleTitle(normalizedQuery, t);
    if (t === normalizedPrimary) {
      if (s > bestPrimaryScore) bestPrimaryScore = s;
    } else if (s > bestAltScore) {
      bestAltScore = s;
    }
  }

  const penalty = spinoffPenaltyFactor(normalizedQuery, normalizedPrimary);
  // When only an altTitle scores high and the primary title is a poor match,
  // dampen the altTitle score so anthology-style ID matches don't outrank the
  // standalone manga whose primary title actually equals the query.
  // M11b: exempt exact altTitle hits (≥0.95) — JP-romaji folder vs EN primary should not be dampened.
  const altPenalty = (bestAltScore < 0.95 && bestAltScore > bestPrimaryScore + 0.3 && bestPrimaryScore < 0.5) ? 0.85 : 1.0;
  return Math.max(bestPrimaryScore, bestAltScore * altPenalty) * penalty;
}

/**
 * Check if a match has a cover image in its metadata
 */
export function hasCoverImage(match: EnrichedProviderMatch): boolean {
  const meta = match.metadata;
  if (meta === null || meta === undefined || typeof meta !== 'object') return false;
  const cover = (meta as Record<string, unknown>)['coverImage'];
  return typeof cover === 'string' && cover.length > 0;
}

/**
 * Manga-native providers — sources whose IDs anchor the rest of the
 * enrichment pipeline. Wikipedia/Fandom remain in the candidate pool but
 * are demoted when a manga-native hit is close in confidence, so we don't
 * accidentally anchor the manga to a non-manga-native ID.
 */
const MANGA_NATIVE_PROVIDERS = new Set(['anilist', 'mangadex', 'mangaupdates']);
const MANGA_NATIVE_BONUS = 0.08;

/**
 * Apply year-aware scoring to rank matches.
 * When we know the folder year, boost matches that agree and penalize those that don't.
 * Penalizes matches without cover images to prefer complete metadata.
 * Also applies a small manga-native bonus so anilist/mangadex/mangaupdates
 * win narrow ties against wikipedia/fandom.
 */
export function scoreWithYear(match: EnrichedProviderMatch, folderYear: number | undefined): number {
  let score = match.confidence;

  if (MANGA_NATIVE_PROVIDERS.has(match.provider)) {
    score = Math.min(score + MANGA_NATIVE_BONUS, 1.0);
  }

  // M10: raw ≥ 0.95 skips cover/year penalties — an exact title is decisive.
  if (match.confidence >= 0.95) return score;

  // Penalize matches without cover images (prefer complete metadata)
  if (!hasCoverImage(match)) {
    score *= 0.9;
  }

  if (folderYear === undefined) return score;

  const matchYear = (match.metadata as Record<string, unknown> | undefined)?.['year'] as number | undefined;
  if (matchYear === undefined) return score;

  // Same year → boost confidence
  if (matchYear === folderYear) return Math.min(score + 0.15, 1.0);

  // Within 2 years → slight boost (publication year variations)
  const diff = Math.abs(matchYear - folderYear);
  if (diff <= 2) return Math.min(score + 0.05, 1.0);

  // Very different year → penalize (the further away, the more penalty)
  if (diff > 10) return score * 0.7;
  return score * 0.85;
}

export function mapResultsToMatches(results: SearchResultWithScore[]): EnrichedProviderMatch[] {
  return results.map((result) => ({
    id: `${result.provider}-${result.id}`,
    providerId: result.id,
    title: result.title,
    provider: result.provider,
    confidence: result.confidence,
    metadata: {
      description: result.description,
      coverImage: result.coverImage,
      siteDetailUrl: result.siteDetailUrl,
      url: result.url,
      wikiUrl: result.wikiUrl,
      year: result.year,
      chapters: result.chapters,
      volumes: result.volumes,
      genres: result.genres,
      status: result.status,
      authors: result.authors,
      artists: result.artists,
      publisher: result.publisher,
    },
  }));
}

/**
 * Select the best match, factoring in year from the scanned folder.
 * When the best match lacks a cover image, borrows one from the best match that has one.
 */
export function getBestMatch(matches: EnrichedProviderMatch[], folderYear?: number): EnrichedProviderMatch | null {
  if (matches.length === 0) return null;

  const sorted = [...matches].sort((a, b) =>
    scoreWithYear(b, folderYear) - scoreWithYear(a, folderYear)
  );
  const best = sorted[0];
  if (!best) return null;

  // If best match has no cover, borrow from the highest-ranked match that does
  if (!hasCoverImage(best)) {
    const withCover = sorted.find(hasCoverImage);
    if (withCover) {
      const fallbackCover = (withCover.metadata as Record<string, unknown>)['coverImage'] as string;
      const enrichedMeta = { ...(best.metadata as Record<string, unknown>), coverImage: fallbackCover };
      return { ...best, metadata: enrichedMeta };
    }
  }

  return best;
}

// ============================================================================
// Scan Result Processors
// ============================================================================

export function processCompletedScan(
  result: ScanJobResult,
  dispatch: Dispatch<PipelineAction>,
  setProgress: Dispatch<SetStateAction<DetectMatchProgress>>,
  queueItemsForMatching: (items: ScannedMangaItem[]) => void
): void {
  if (!result.items) return;
  const scannedItems = result.items.map(mapJobItemToScannedItem);

  setProgress((prev) => ({
    ...prev,
    scanCurrent: scannedItems.length,
    scanTotal: scannedItems.length,
    isScanComplete: true,
    scanStatus: 'Scan complete, matching...',
  }));

  dispatch({ type: 'DETECT_MATCH_SCAN_COMPLETE' });
  queueItemsForMatching(scannedItems);
}

export function processActiveScan(
  result: ScanJobResult,
  setProgress: Dispatch<SetStateAction<DetectMatchProgress>>,
  queueItemsForMatching: (items: ScannedMangaItem[]) => void
): void {
  setProgress((prev) => ({
    ...prev,
    scanCurrent: result.processed ?? 0,
    scanTotal: result.totalFiles ?? 0,
    scanStatus: 'Scanning...',
  }));

  if (result.items && result.items.length > 0) {
    const scannedItems = result.items.map(mapJobItemToScannedItem);
    queueItemsForMatching(scannedItems);
  }
}
