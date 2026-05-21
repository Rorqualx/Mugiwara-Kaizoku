/**
 * ts-mangadex Adapter Layer
 *
 * Maps types between mangadex-ts-client and Kaizoku's internal types.
 * Single source of truth for all type conversions between the two systems.
 */



import { MetadataProvider } from '@prisma/client';

import type { SearchResult, MangaMetadata } from '@/types/search.types';
import { mapToMangaStatus } from '@/utils/status-mapper';


import type {
  SearchResult as TsSearchResult,
  UnifiedManga,
  EnrichedMetadata,
  DataSource,
  PublicationStatus,
  CoverImages as TsCoverImages,
  Creator,
  Character,
  ExternalLinks as TsExternalLinks,
  LocalizedString,
} from 'mangadex-ts-client';

// ============================================================================
// Constants
// ============================================================================

/** Maps ts-mangadex DataSource to Kaizoku's Prisma MetadataProvider enum */
export const DATA_SOURCE_MAP: Record<DataSource, MetadataProvider> = {
  mangadex: MetadataProvider.MANGADEX,
  anilist: MetadataProvider.ANILIST,
  comicvine: MetadataProvider.COMICVINE,
};

/** Reverse map: Prisma MetadataProvider to ts-mangadex DataSource */
export const PROVIDER_TO_SOURCE: Partial<Record<MetadataProvider, DataSource>> = {
  [MetadataProvider.MANGADEX]: 'mangadex',
  [MetadataProvider.ANILIST]: 'anilist',
  [MetadataProvider.COMICVINE]: 'comicvine',
};

// ============================================================================
// Title Helpers
// ============================================================================

/** Extract best string title from a LocalizedString map */
export function resolveTitle(title: LocalizedString | undefined): string {
  if (!title) return 'Unknown Title';
  return title['en'] || title['ja-ro'] || title['ja'] || Object.values(title)[0] || 'Unknown Title';
}

/** Extract best string description from a LocalizedString map */
function resolveDescription(desc: LocalizedString | undefined): string {
  if (!desc) return '';
  return desc['en'] || desc['ja-ro'] || desc['ja'] || Object.values(desc)[0] || '';
}

// ============================================================================
// Status Mapping
// ============================================================================

/** Map ts-mangadex PublicationStatus to Kaizoku status string for mapToMangaStatus */
export function mapStatusToKaizoku(status: PublicationStatus | undefined): string {
  if (!status) return 'UNKNOWN';
  const statusMap: Record<PublicationStatus, string> = {
    ongoing: 'ONGOING',
    completed: 'COMPLETED',
    hiatus: 'HIATUS',
    cancelled: 'CANCELLED',
    upcoming: 'UPCOMING',
  };
  return statusMap[status];
}

// ============================================================================
// Search Result Adapter
// ============================================================================

/**
 * Adapts a ts-mangadex SearchResult to Kaizoku's SearchResult type.
 */
export function adaptSearchResult(
  tsResult: TsSearchResult,
  providerName: MetadataProvider
): SearchResult {
  const result: SearchResult = {
    id: tsResult.id,
    title: tsResult.title,
    type: 'manga',
    alternativeTitles: tsResult.altTitles ?? [],
    description: tsResult.description ?? '',
    coverImage: tsResult.coverImage ?? '',
    url: '',
    provider: providerName,
    metadata: {
      source: tsResult.source,
    },
  };

  if (tsResult.status !== undefined) result.status = tsResult.status;
  if (tsResult.year !== undefined) result.year = tsResult.year;

  return result;
}

// ============================================================================
// Metadata Adapter
// ============================================================================

/** Extract best cover image URL from CoverImages */
function resolveCoverImage(covers: TsCoverImages | undefined): string {
  if (!covers) return '';
  return covers.large || covers.original || covers.medium || covers.small || '';
}

/** Extract authors from Creator array */
function extractAuthors(creators: Creator[]): string[] {
  return creators
    .filter(c => c.role === 'AUTHOR' || c.role === 'AUTHOR_ARTIST')
    .map(c => c.name);
}

/** Extract artists from Creator array */
function extractArtists(creators: Creator[]): string[] {
  return creators
    .filter(c => c.role === 'ARTIST' || c.role === 'AUTHOR_ARTIST')
    .map(c => c.name);
}

/** Extract character names */
function extractCharacterNames(characters: Character[]): string[] {
  return characters.map(c => c.name);
}

/** Convert ts-mangadex ExternalLinks to Record<string, string> */
function adaptExternalLinks(links: TsExternalLinks | undefined): Record<string, string> {
  if (!links) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(links)) {
    if (value) result[key] = value;
  }
  return result;
}

/** Build conditional fields that are only set when the source value is defined */
function buildConditionalFields(manga: Partial<UnifiedManga>): Partial<MangaMetadata> {
  const fields: Partial<MangaMetadata> = {};
  if (manga.year !== undefined) fields.year = manga.year;
  if (manga.totalVolumes !== undefined) fields.volumes = manga.totalVolumes;
  if (manga.totalChapters !== undefined) fields.chapters = manga.totalChapters;
  if (manga.startDate !== undefined) fields.startDate = manga.startDate;
  if (manga.endDate !== undefined) fields.endDate = manga.endDate;
  if (manga.bannerImage !== undefined) fields.bannerImage = manga.bannerImage;
  if (manga.contentRating !== undefined) fields.isAdult = manga.contentRating === 'erotica' || manga.contentRating === 'pornographic';
  if (manga.demographic !== undefined) fields.format = manga.demographic;
  return fields;
}

/** Build score-related fields from the manga score object */
function buildScoreFields(score: NonNullable<UnifiedManga['score']>): Partial<MangaMetadata> {
  const fields: Partial<MangaMetadata> = {};
  if (score.averageScore !== undefined) fields.averageScore = score.averageScore;
  if (score.popularity !== undefined) fields.popularity = score.popularity;
  if (score.averageScore !== undefined) fields.score = score.averageScore / 10;
  return fields;
}

/** Build provider-specific ID fields (mangadex sourceId, anilist metadata) */
function buildProviderIdFields(ids: NonNullable<UnifiedManga['ids']>, existingMetadata: unknown): Partial<MangaMetadata> {
  const fields: Partial<MangaMetadata> = {};
  if (ids.mangadex) fields.sourceId = ids.mangadex;
  if (ids.anilist) {
    fields.metadata = { ...(existingMetadata as Record<string, unknown>), anilistId: parseInt(ids.anilist, 10) };
  }
  return fields;
}

/**
 * Adapts a ts-mangadex UnifiedManga (partial) to Kaizoku's MangaMetadata type.
 * Used by provider strategies when fetching metadata.
 */
export function adaptUnifiedMangaToMetadata(
  manga: Partial<UnifiedManga>,
  providerName: MetadataProvider
): MangaMetadata {
  const title = resolveTitle(manga.title);
  const description = resolveDescription(manga.description);
  const covers = manga.covers;

  const metadata: MangaMetadata = {
    title,
    alternativeTitles: manga.altTitles ?? [],
    synonyms: manga.altTitles ?? [],
    description,
    coverImage: resolveCoverImage(covers),
    coverExtraLarge: covers?.large ?? covers?.original,
    coverLarge: covers?.large,
    coverMedium: covers?.medium,
    coverSmall: covers?.small,
    status: manga.status ? mapToMangaStatus(mapStatusToKaizoku(manga.status)) : undefined,
    genres: manga.genres ?? [],
    tags: manga.themes ?? [],
    authors: extractAuthors(manga.creators ?? []),
    artists: extractArtists(manga.creators ?? []),
    characters: extractCharacterNames(manga.characters ?? []),
    externalLinks: adaptExternalLinks(manga.externalLinks),
    provider: providerName,
    format: manga.format,
    countryOfOrigin: manga.countryOfOrigin,
    publisher: manga.publisher,
  };

  Object.assign(metadata, buildConditionalFields(manga));
  if (manga.score) Object.assign(metadata, buildScoreFields(manga.score));
  if (manga.ids) Object.assign(metadata, buildProviderIdFields(manga.ids, metadata.metadata));

  return metadata;
}

/**
 * Convenience wrapper: adapts EnrichedMetadata to MangaMetadata.
 * Picks the best provider name based on sources.
 */
export function adaptEnrichedToMangaMetadata(
  enriched: EnrichedMetadata
): MangaMetadata {
  const primarySource = enriched.manga.sources[0] ?? 'mangadex';
  const providerName = DATA_SOURCE_MAP[primarySource];
  return adaptUnifiedMangaToMetadata(enriched.manga, providerName);
}
