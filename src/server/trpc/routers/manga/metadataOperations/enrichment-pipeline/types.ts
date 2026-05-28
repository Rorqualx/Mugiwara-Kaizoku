/**
 * Enrichment Pipeline Types
 *
 * Shared types for the enrichment pipeline modules.
 */

import type { RawProviderData } from '@/lib/validation/common-schemas';
import type { CompletenessReport } from '@/server/services/completeness/manga-completeness';
import type { EnrichmentResult } from '@/server/services/library/metadataEnrichmentService/types';
import type { WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';
import type { MangaWithRelations } from '@/server/trpc/routers/manga/shared';

export interface EnrichmentProgress {
  (phase: string, message: string): Promise<void>;
}

/** Options for controlling enrichment pipeline behavior */
export interface EnrichmentPipelineOptions {
  /** When true, skip cached provider URLs (e.g. Fandom) and re-discover from scratch */
  forceRefresh?: boolean;
  /**
   * AniList id that was bound before a reidentify cleared it. Used only as a
   * last-resort fallback when the fresh AniList title search returns nothing —
   * so a correct binding isn't destroyed because AniList's search can't
   * reproduce the title (e.g. "Völundio ~Divergent Sword Saga~" → id 123314).
   */
  previousAniListId?: string | null;
}

export interface EnrichmentPipelineResult {
  result: unknown;
  manga: MangaWithRelations | null;
  /** Post-run completeness score — see src/server/services/completeness/manga-completeness.ts */
  completeness?: CompletenessReport;
}

/** Raw provider data from phase 1 */
export type { RawProviderData };

/** Chapter and volume enrichment data from Fandom */
export interface ChapterEnrichmentMaps {
  chapterTitleMap: Record<number, string>;
  chapterVolumeMap: Record<number, number>;
  chapterCoverMap: Record<number, string>;
  chapterDescriptionMap: Record<number, string>;
  chapterPagesMap: Record<number, number>;
  chapterReleaseDateMap: Record<number, string>;
  /** English volume descriptions from Fandom wiki pages */
  volumeDescriptionMap: Record<number, string>;
}

/** Bonus chapter info extracted from ComicVine volume descriptions */
export interface BonusChapterInfo {
  title: string;
  chapterNumber: number;
  volumeNumber: number;
}

/** Normalized chapter data from a provider (used for merge logic in phase-db-persistence) */
export interface ProviderChapter {
  chapterNumber: number;
  title?: string;
  volume?: number;
  pages?: number;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
}

/** Normalized chapter data item from any source */
export interface ChapterDataItem {
  number: number;
  title?: string;
  volume?: number;
  cover?: string;
  description?: string;
  pages?: number;
  releaseDate?: string;
  /**
   * Source-language code, e.g. `en`, `pt-br`, `es-la`. Set by providers
   * that surface multi-language uploads (currently MangaDex). Used by the
   * dedup logic in `mangadex-chapter-list.ts` to prefer the user's
   * configured `mangadex.preferredLanguage` when picking which scanlator
   * upload's title to surface in the library.
   */
  language?: string;
}

/** Combined results from all provider fetches in Phase 1 */
export interface UnifiedProviderResults {
  enrichmentResult: EnrichmentResult;
  fandomResult: {
    url: string;
    chapterList: ChapterDataItem[];
    volumeList: VolumeDataItem[];
    rawHtml?: string;
    parseSuccess: boolean;
  } | null;
  wikipediaResult: {
    data: WikipediaMangaData;
    chapterList: ChapterDataItem[];
  } | null;
  /** ComicVine match metadata for remediation (publisher, volume info) */
  comicvineResult: {
    volumeId: number;
    volumeName: string;
    publisherName: string | undefined;
    issueCount: number;
  } | null;
  /** MangaUpdates series-level metadata (publisher, categories, licensing, related series) */
  mangaupdatesResult: {
    seriesId: number;
    /** MangaUpdates base36 URL slug (e.g. "o9w1mbt"). The API uses the numeric
     *  seriesId but the web UI uses the slug; storing it in
     *  `providerMetadata.mangaupdates.urlSlug` lets the bind dialog render a
     *  live "View on MangaUpdates" link. `null` when MU's response had no
     *  parseable slug. */
    urlSlug: string | null;
    title: string;
    publisher: string | undefined;
    categories: string[];
    genres: string[];
    status: string;
    licensed: boolean;
    completed: boolean;
    type: string;
    year: string;
    bayesianRating: number;
    ratingVotes: number;
    latestChapter: number;
    authors: Array<{ name: string; type: string; authorId: number }>;
    publishers: Array<{ name: string; type: string; notes: string; publisherId: number }>;
    publications: Array<{ publicationName: string; publisherName: string }>;
    relatedSeries: Array<{ name: string; type: string; seriesId: number }>;
    recommendations: Array<{ name: string; seriesId: number; weight: number }>;
    alternativeTitles: string[];
    animeMapping: { start: string; end: string } | null;
  } | null;
  /** MangaDex aggregate volume→chapter mapping for cross-validation */
  mangadexAggregate: {
    mangaId: string;
    volumes: Array<{
      volumeNumber: number;
      chapterStart: number;
      chapterEnd: number;
      chapterCount: number;
      /** iter-PVM-1: full per-chapter list from aggregate keys (incl. decimals) */
      chapters: number[];
    }>;
  } | null;
  /** MangaDex per-chapter list (used for Chapter.pages fill) */
  mangadexChapterList: ChapterDataItem[] | null;
  /** MAL series-level metadata (chapters, volumes, status, score) via Jikan API */
  malResult: {
    malId: number;
    title: string;
    chapters: number | null;
    volumes: number | null;
    status: string;
    score: number | null;
  } | null;
  /** Kitsu series-level metadata (age rating, community ratings, alt covers) */
  kitsuResult: {
    kitsuId: string;
    slug: string;
    canonicalTitle: string;
    alternativeTitles: string[];
    synopsis: string | undefined;
    status: string;
    subtype: string;
    ageRating: string | undefined;
    ageRatingGuide: string | undefined;
    chapterCount: number | undefined;
    volumeCount: number | undefined;
    startDate: string | undefined;
    endDate: string | undefined;
    serialization: string | undefined;
    averageRating: number | undefined;
    userCount: number;
    favoritesCount: number;
    posterImageUrl: string | undefined;
    coverImageUrl: string | undefined;
  } | null;
}

/** Normalized volume data item from any source */
export interface VolumeDataItem {
  number: number;
  title?: string;
  description?: string;
  coverImage?: string;
  chapterStart?: number;
  chapterEnd?: number;
  releaseDate?: string;
  releaseDateEn?: string;
  isbn?: string;
  isbnEn?: string;
  /** Volume page count from Fandom infobox [data-source="pages"] */
  pageCount?: number;
}

/** All source data assembled and normalized for AI agent processing */
export interface SourceDataCollection {
  mangaId: number;
  title: string;
  expectedChapterCount: number;
  sources: {
    comicvine: ChapterDataItem[];
    fandom: ChapterDataItem[];
    wikipedia: ChapterDataItem[];
  };
  /** Volume-level source data for field-aware merge */
  volumeSources?: {
    comicvine: VolumeDataItem[];
    fandom: VolumeDataItem[];
    wikipedia: VolumeDataItem[];
  };
  gaps: GapAnalysis;
  rawData: {
    fandomUrl?: string;
    fandomParseSuccess: boolean;
    fandomRawHtml?: string;
    wikipediaParseSuccess: boolean;
    comicvineVolumeDescriptions?: Array<{
      volumeNumber: number;
      descriptionText: string;
      parsedChapterCount: number;
    }>;
    /** ComicVine match metadata for validation during remediation */
    comicvinePublisher?: string;
    comicvineVolumeId?: number;
    comicvineVolumeName?: string;
    comicvineIssueCount?: number;
    /** MangaUpdates series-level metadata */
    mangaupdatesSeriesId?: number;
    mangaupdatesPublisher?: string;
    mangaupdatesCategories?: string[];
    mangaupdatesLicensed?: boolean;
  };
}

/** Gap analysis across all sources */
export interface GapAnalysis {
  totalExpectedChapters: number;
  chaptersWithTitles: number;
  coveragePercent: number;
  sourceCoverage: Record<string, number>;
  failedSources: string[];
  needsRemediation: boolean;
}

/** Persisted chapter URL template for a Fandom wiki */
export interface ChapterUrlTemplate {
  /** URL path pattern with {N} placeholder, e.g., "Episode_{N}_(Manga)" */
  template: string;
  /** Wiki base URL, e.g., "https://berserk.fandom.com" */
  baseUrl: string;
  /** Fraction of scraped URLs that matched this template (0-1) */
  confidence: number;
  /** ISO timestamp when template was last confirmed */
  confirmedAt: string;
  /** How the template was discovered */
  source: 'scraped-urls' | 'redirect-discovery' | 'probe-confirmed';
  /** Number of URLs that matched during extraction */
  matchCount: number;
}

// ============================================================================
// Bonus Title Detection (shared across pipeline modules)
// ============================================================================

/** Patterns that identify bonus/extra/special chapters by title */
export const BONUS_TITLE_PATTERNS = [
  /\bextra\b/i,
  /\bbonus\b/i,
  /\bspecial\b/i,
  /\bomake\b/i,
  /\bprologue\b/i,
  /\bepilogue\b/i,
  /\bside\s*story\b/i,
  /\badditional\b/i,
  /\bone[- ]?shot\b/i,
  /\bgaiden\b/i,
  /\b外伝\b/,
  /\bおまけ\b/,
];

/** Check if a chapter title indicates it's a bonus/extra chapter */
export function isBonusTitle(title: string | null): boolean {
  if (!title) return false;
  return BONUS_TITLE_PATTERNS.some(p => p.test(title));
}

/** Create empty chapter enrichment maps */
export function createEmptyEnrichmentMaps(): ChapterEnrichmentMaps {
  return {
    chapterTitleMap: {},
    chapterVolumeMap: {},
    chapterCoverMap: {},
    chapterDescriptionMap: {},
    chapterPagesMap: {},
    chapterReleaseDateMap: {},
    volumeDescriptionMap: {},
  };
}
