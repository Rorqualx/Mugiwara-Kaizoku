/**
 * Manga Completeness Scoring
 *
 * Computes a completeness score (0-100) for a manga object, measuring
 * how many of the fields used by the UI are actually populated.
 *
 * Scoring buckets (weights sum to 100):
 *   - core      15%  (title, summary, cover, status, format, dates, publisher, score)
 *   - taxonomy  15%  (genres, tags, themes, authors, artists, characters, synonyms)
 *   - external  10%  (sourceId, idMal, externalLinks, urls, bannerImage)
 *   - volumes   25%  (per-volume: title, description, cover, releaseDate, range, isbn)
 *   - chapters  25%  (per-chapter: title, volumeId, cover, description, releaseDate, pages)
 *   - gallery   10%  (Metadata.galleryImages coverage relative to chapter count)
 *
 * Used by:
 *   - scripts/surveys/run-completeness-loop-v1.ts — harness baseline/delta runs
 *   - pipeline-orchestrator.runEnrichmentPipeline — post-run observability signal
 */

import type { Chapter, Metadata, Volume } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/** Minimal manga shape required for scoring. Accepts MangaWithRelations or similar. */
export interface MangaForScoring {
  id: number;
  title: string;
  summary?: string | null;
  publicationStatus?: string | null;
  Metadata?: Metadata | null;
  Chapter?: ReadonlyArray<Partial<Chapter>> | null;
  Volume?: ReadonlyArray<Partial<Volume>> | null;
}

export interface CompletenessBucket {
  /** 0-100 */
  score: number;
  /** Number of populated fields (or rows) counted toward the score */
  populated: number;
  /** Total fields (or rows × fields-per-row) considered */
  total: number;
}

export interface VolumesBucket extends CompletenessBucket {
  volumeCount: number;
}

export interface ChaptersBucket extends CompletenessBucket {
  chapterCount: number;
  /** Number of chapters with non-generic titles */
  chaptersWithRealTitles: number;
}

export interface CompletenessReport {
  /** 0-100 weighted overall */
  overall: number;
  core: CompletenessBucket;
  taxonomy: CompletenessBucket;
  external: CompletenessBucket;
  volumes: VolumesBucket;
  chapters: ChaptersBucket;
  gallery: CompletenessBucket;
  /** Field-level misses flattened for aggregation (e.g. "Metadata.bannerImage", "Volume.title") */
  missingFields: string[];
}

// ============================================================================
// Populated-field predicates
// ============================================================================

const DEFAULT_COVER = '/cover-not-found.jpg';
const GENERIC_TITLE = /^Chapter\s*\d+(?:\.\d+)?$/i;

function isPopulatedString(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function isRealCover(v: unknown): boolean {
  return isPopulatedString(v) && v !== DEFAULT_COVER;
}

function isPopulatedArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

function isPopulatedNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

function isPopulatedDate(v: unknown): boolean {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v === 'string' && v.trim().length > 0) return !Number.isNaN(Date.parse(v));
  return false;
}

function isRealTitle(v: unknown): boolean {
  return isPopulatedString(v) && !GENERIC_TITLE.test(String(v));
}

function isPopulatedJson(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0 && v.trim() !== '{}';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length > 0;
  return false;
}

// ============================================================================
// Bucket scorers
// ============================================================================

function scoreCore(manga: MangaForScoring, missing: string[]): CompletenessBucket {
  const md = manga.Metadata;
  const checks: Array<[string, boolean]> = [
    ['Manga.title', isPopulatedString(manga.title)],
    ['Metadata.summary', isPopulatedString(md?.summary)],
    ['Metadata.coverLarge', isRealCover(md?.coverLarge) || isRealCover(md?.coverExtraLarge)],
    ['Metadata.status', isPopulatedString(md?.status) && md?.status !== 'UNKNOWN'],
    ['Metadata.format', isPopulatedString(md?.format)],
    ['Metadata.startDate', isPopulatedDate(md?.startDate)],
    ['Metadata.endDate', isPopulatedDate(md?.endDate)],
    ['Metadata.countryOfOrigin', isPopulatedString(md?.countryOfOrigin)],
    ['Metadata.publisher', isPopulatedString(md?.publisher)],
    ['Metadata.averageScore', isPopulatedNumber(md?.averageScore)],
  ];
  return scoreChecks(checks, missing);
}

function scoreTaxonomy(manga: MangaForScoring, missing: string[]): CompletenessBucket {
  const md = manga.Metadata;
  // Note: Metadata.characters intentionally omitted — not displayed on manga pages,
  // so tracking it as a taxonomy gap inflates the missing-fields list unhelpfully.
  const checks: Array<[string, boolean]> = [
    ['Metadata.genres', isPopulatedArray(md?.genres)],
    ['Metadata.tags', isPopulatedArray(md?.tags)],
    ['Metadata.themes', isPopulatedArray(md?.themes)],
    ['Metadata.authors', isPopulatedArray(md?.authors)],
    ['Metadata.artists', isPopulatedArray(md?.artists)],
    ['Metadata.synonyms', isPopulatedArray(md?.synonyms)],
  ];
  return scoreChecks(checks, missing);
}

function scoreExternal(manga: MangaForScoring, missing: string[]): CompletenessBucket {
  const md = manga.Metadata;
  const checks: Array<[string, boolean]> = [
    ['Metadata.sourceId', isPopulatedString(md?.sourceId)],
    ['Metadata.idMal', isPopulatedNumber(md?.idMal)],
    ['Metadata.externalLinks', isPopulatedJson(md?.externalLinks)],
    ['Metadata.urls', isPopulatedArray(md?.urls)],
    ['Metadata.bannerImage', isRealCover(md?.bannerImage)],
  ];
  return scoreChecks(checks, missing);
}

function scoreVolumes(manga: MangaForScoring, missing: string[]): VolumesBucket {
  // Volume 0 ("Specials") holds bonus/prequel chapters and has legitimately empty
  // optional metadata (isbn, pageCount, releaseDate). Excluding it from the
  // per-field denominator prevents it from dragging down completeness scores.
  const volumes = (manga.Volume ?? []).filter(v => v.number !== 0);
  if (volumes.length === 0) {
    return { score: 0, populated: 0, total: 0, volumeCount: 0 };
  }

  const perVolumeFields: Array<[keyof Volume, (v: Partial<Volume>) => boolean]> = [
    ['title', v => isPopulatedString(v.title)],
    ['description', v => isPopulatedString(v.description)],
    ['coverImage', v => isRealCover(v.coverImage)],
    ['releaseDate', v => isPopulatedDate(v.releaseDate)],
    ['chapterStart', v => isPopulatedNumber(v.chapterStart)],
    ['chapterEnd', v => isPopulatedNumber(v.chapterEnd)],
    ['totalChapters', v => isPopulatedNumber(v.totalChapters)],
    ['publisher', v => isPopulatedString(v.publisher)],
    ['isbn', v => isPopulatedString(v.isbn) || isPopulatedString(v.isbn13)],
    ['pageCount', v => isPopulatedNumber(v.pageCount)],
  ];

  // Missing-field aggregation uses "Volume.X" counts across all volumes
  const missCounts: Record<string, number> = {};
  let populated = 0;
  for (const vol of volumes) {
    for (const [field, check] of perVolumeFields) {
      if (check(vol)) populated++;
      else missCounts[`Volume.${String(field)}`] = (missCounts[`Volume.${String(field)}`] ?? 0) + 1;
    }
  }
  for (const [field, count] of Object.entries(missCounts)) {
    missing.push(`${field} ×${count}`);
  }

  const total = volumes.length * perVolumeFields.length;
  return {
    score: total > 0 ? (populated / total) * 100 : 0,
    populated,
    total,
    volumeCount: volumes.length,
  };
}

function scoreChapters(manga: MangaForScoring, missing: string[]): ChaptersBucket {
  const chapters = manga.Chapter ?? [];
  if (chapters.length === 0) {
    return { score: 0, populated: 0, total: 0, chapterCount: 0, chaptersWithRealTitles: 0 };
  }

  const perChapterFields: Array<[string, (c: Partial<Chapter>) => boolean]> = [
    ['title', c => isRealTitle(c.title)],
    ['volumeId', c => isPopulatedNumber(c.volumeId)],
    ['coverImage', c => isRealCover(c.coverImage)],
    ['description', c => isPopulatedString(c.description)],
    ['releaseDate', c => isPopulatedDate(c.releaseDate)],
    ['pages', c => isPopulatedNumber(c.pages) || isPopulatedNumber(c.pageCount)],
  ];

  const missCounts: Record<string, number> = {};
  let populated = 0;
  let realTitles = 0;
  for (const ch of chapters) {
    for (const [field, check] of perChapterFields) {
      if (check(ch)) {
        populated++;
        if (field === 'title') realTitles++;
      } else {
        missCounts[`Chapter.${field}`] = (missCounts[`Chapter.${field}`] ?? 0) + 1;
      }
    }
  }
  for (const [field, count] of Object.entries(missCounts)) {
    missing.push(`${field} ×${count}`);
  }

  const total = chapters.length * perChapterFields.length;
  return {
    score: total > 0 ? (populated / total) * 100 : 0,
    populated,
    total,
    chapterCount: chapters.length,
    chaptersWithRealTitles: realTitles,
  };
}

function scoreGallery(manga: MangaForScoring, missing: string[]): CompletenessBucket {
  const gallery = manga.Metadata?.galleryImages;
  const chapterCount = manga.Chapter?.length ?? 0;
  const volumeCount = manga.Volume?.length ?? 0;
  // Target: at least 1 gallery image per volume OR per 10 chapters, whichever is larger.
  // Gallery score = min(galleryCount / target, 1.0) * 100
  const target = Math.max(volumeCount, Math.ceil(chapterCount / 10), 1);
  const have = Array.isArray(gallery) ? gallery.length : 0;
  const ratio = Math.min(have / target, 1);
  if (have === 0) missing.push('Metadata.galleryImages');
  return {
    score: ratio * 100,
    populated: have,
    total: target,
  };
}

// ============================================================================
// Utility
// ============================================================================

function scoreChecks(checks: Array<[string, boolean]>, missing: string[]): CompletenessBucket {
  let populated = 0;
  for (const [label, ok] of checks) {
    if (ok) populated++;
    else missing.push(label);
  }
  return {
    score: checks.length > 0 ? (populated / checks.length) * 100 : 0,
    populated,
    total: checks.length,
  };
}

// ============================================================================
// Main entry
// ============================================================================

const WEIGHTS = {
  core: 0.15,
  taxonomy: 0.15,
  external: 0.10,
  volumes: 0.25,
  chapters: 0.25,
  gallery: 0.10,
} as const;

export function computeMangaCompleteness(manga: MangaForScoring): CompletenessReport {
  const missing: string[] = [];
  const core = scoreCore(manga, missing);
  const taxonomy = scoreTaxonomy(manga, missing);
  const external = scoreExternal(manga, missing);
  const volumes = scoreVolumes(manga, missing);
  const chapters = scoreChapters(manga, missing);
  const gallery = scoreGallery(manga, missing);

  const overall =
    core.score * WEIGHTS.core +
    taxonomy.score * WEIGHTS.taxonomy +
    external.score * WEIGHTS.external +
    volumes.score * WEIGHTS.volumes +
    chapters.score * WEIGHTS.chapters +
    gallery.score * WEIGHTS.gallery;

  return {
    overall: Math.round(overall * 10) / 10,
    core,
    taxonomy,
    external,
    volumes,
    chapters,
    gallery,
    missingFields: missing,
  };
}

/**
 * Format a completeness report as a one-line diagnostic string.
 */
export function formatCompletenessLine(report: CompletenessReport): string {
  const r = (n: number): string => n.toFixed(0).padStart(3);
  return (
    `Overall:${r(report.overall)} ` +
    `Core:${r(report.core.score)} ` +
    `Tax:${r(report.taxonomy.score)} ` +
    `Ext:${r(report.external.score)} ` +
    `Vol:${r(report.volumes.score)} ` +
    `Ch:${r(report.chapters.score)} ` +
    `Gal:${r(report.gallery.score)}`
  );
}
