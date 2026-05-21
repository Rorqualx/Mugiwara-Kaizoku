/**
 * AniList metadata provider module
 *
 * This module handles fetching and processing metadata from AniList API
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { isSuccess, isError, type AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

interface Mutation {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutateAsync: (params: any) => Promise<any>;
}

/**
 * Fetch and process AniList metadata
 *
 * @param result - The search result containing AniList ID
 * @param fetchAnilistMutation - The tRPC mutation for fetching AniList data
 * @returns Processed metadata in standardized format
 */
// eslint-disable-next-line complexity -- Complex AniList metadata extraction with multiple field mappings
export async function fetchAnilistMetadata(
  result: Record<string, unknown>,
  fetchAnilistMutation: Mutation
): Promise<ProviderMetadata> {
  logger.info('[AniList] Fetching metadata for result:', result);
  const id = result["id"] ?? result["sourceId"] ?? result["mal_id"] ?? result["anilistId"];
  if (!id) {
    logger.error('[AniList] No ID found in result:', result);
    throw new Error('No AniList ID found');
  }

  logger.info('[AniList] Using ID:', id);
  // Convert to string if it's a number (the API expects string)
  const idString = String(id);
  const response = await fetchAnilistMutation.mutateAsync({ id: idString }) as AsyncResult<unknown, unknown>;

  if (isError(response)) {
    throw new Error((response.error as Error).message || 'Failed to fetch data');
  }

  const data = (isSuccess(response) ? response.data : response) as Record<string, unknown>;
  const media = (data["Media"] ?? data) as Record<string, unknown>;

  // Debug: Log the actual structure of media object to see what cover fields are available
  logger.info('[AniList Debug] media object structure:', {

    hasCover: !!media["cover"],
    coverType: typeof media["cover"],
    coverValue: media["cover"],

    hasCoverImage: !!media["coverImage"],
    coverImageType: typeof media["coverImage"],
    coverImageValue: media["coverImage"],
    allKeys: Object.keys(media).slice(0, 20)
  });

  // Extract alternative titles from AniList
  const alternativeTitles: string[] = [];
  const mediaTitle = media["title"] as Record<string, unknown> | undefined;
  if (mediaTitle) {
    // Add all available title formats as alternatives
    if (mediaTitle["romaji"]) alternativeTitles.push(mediaTitle["romaji"] as string);
    if (mediaTitle["english"] && mediaTitle["english"] !== mediaTitle["romaji"]) {
      alternativeTitles.push(mediaTitle["english"] as string);
    }
    if (mediaTitle["native"] && mediaTitle["native"] !== mediaTitle["romaji"]) {
      alternativeTitles.push(mediaTitle["native"] as string);
    }
  }
  // Add synonyms if available
  if (media["synonyms"] && Array.isArray(media["synonyms"])) {
    const synonyms = media["synonyms"].filter((s: unknown): s is string => typeof s === 'string');
    alternativeTitles.push(...synonyms);
  }


  // Extract coverImage with detailed logging
  const extractedCoverImage = (() => {
    const coverSource = media["cover"] ?? media["coverImage"];
    logger.info('[AniList Debug] Extracting coverImage:', {

      hasCoverSource: !!coverSource,
      coverSourceType: typeof coverSource,
      coverSource: coverSource
    });

    if (typeof coverSource === 'string') {
      logger.info('[AniList Debug] coverSource is string:', coverSource);
      return coverSource;
    } else if (typeof coverSource === 'object' && coverSource !== null) {
      const coverObj = coverSource as Record<string, unknown>;
      const extracted = (coverObj["extraLarge"] ?? coverObj["large"]) ?? coverObj["medium"];
      logger.info('[AniList Debug] Extracted from nested object:', {
        extracted,

        hasExtraLarge: !!coverObj["extraLarge"],

        hasLarge: !!coverObj["large"],

        hasMedium: !!coverObj["medium"],
        objectKeys: Object.keys(coverSource)
      });
      return extracted;
    }
    logger.warn('[AniList Debug] No coverImage found - coverSource is:', coverSource);
    return undefined;
  })();

  logger.info('[AniList Debug] Final extracted coverImage:', extractedCoverImage);

  // Parse tags from AniList API
  // Tags may come as either:
  // 1. String array (already processed by tRPC router): ["Action", "Drama"]
  // 2. Object array (raw AniList format): [{ name: "Action" }, { name: "Drama" }]
  const rawTags = (media["tags"] as unknown[] | undefined) ?? [];
  const parsedTags = rawTags.map((t: unknown) => {
    if (typeof t === 'string') return t;
    if (typeof t === 'object' && t !== null) {
      const tagObj = t as Record<string, unknown>;
      return (tagObj["name"] as string | undefined) ?? '';
    }
    return '';
  }).filter((tag): tag is string => tag !== '');

  // Themes may come as either string array or object array (same handling)
  const rawThemes = (media["themes"] as unknown[] | undefined) ?? [];
  const parsedThemes = rawThemes.map((t: unknown) => {
    if (typeof t === 'string') return t;
    if (typeof t === 'object' && t !== null) {
      const themeObj = t as Record<string, unknown>;
      return (themeObj["name"] as string | undefined) ?? '';
    }
    return '';
  }).filter((theme): theme is string => theme !== '');

  logger.info('[AniList sourceManagementService] Received from tRPC:', {
    responseType: typeof response,
    isSuccessResult: isSuccess(response),
    dataKeys: Object.keys(data),
    mediaKeys: Object.keys(media),
    mediaTagsCount: (media["tags"] as unknown[] | undefined)?.length ?? 0,
    mediaThemesCount: (media["themes"] as unknown[] | undefined)?.length ?? 0,
    parsedTagsCount: parsedTags.length,
    parsedThemesCount: parsedThemes.length,
    first3Tags: parsedTags.slice(0, 3),
    first3Themes: parsedThemes.slice(0, 3),
    authorsCount: (media["authors"] as unknown[] | undefined)?.length ?? 0,
    artistsCount: (media["artists"] as unknown[] | undefined)?.length ?? 0,
    mediaAuthors: media["authors"],
    mediaArtists: media["artists"],
    first3Authors: ((media["authors"] as string[] | undefined) ?? []).slice(0, 3),
    first3Artists: ((media["artists"] as string[] | undefined) ?? []).slice(0, 3)
  });

  const resultMetadata = {
    id: String(media["id"]),
    sourceId: String(media["id"]),
    title: ((mediaTitle?.["romaji"] || mediaTitle?.["english"] || mediaTitle?.["native"]) ?? '') as string,
    description: (media["description"] ?? '') as string,
    status: (media["status"] ?? '') as string,
    format: (media["format"] ?? '') as string,
    genres: (media["genres"] ?? []) as string[],
    tags: parsedThemes.length > 0 ? parsedThemes : parsedTags, // Use themes if available, fallback to tags
    themes: parsedThemes.length > 0 ? parsedThemes : parsedTags, // AniList tags/themes serve as themes
    authors: (media["authors"] ?? []) as string[],
    artists: (media["artists"] ?? []) as string[],
    startDate: media["startDate"] as string | { year?: number; month?: number; day?: number; } | undefined,
    endDate: media["endDate"] as string | { year?: number; month?: number; day?: number; } | undefined,
    // Handle both 'cover' and 'coverImage' fields from the API
    // Properly extract URL from nested object structure
    coverImage: extractedCoverImage as string | undefined,
    bannerImage: media["bannerImage"] as string | undefined,
    // Standardized format: volumes and chapters as numbers
    volumes: (media["volumes"] ?? 0) as number,
    chapters: (media["chapters"] ?? 0) as number,
    // No detailed volume/chapter data from AniList API
    volumeData: [],
    chapterData: [],
    averageScore: media["averageScore"] as number | undefined,
    popularity: media["popularity"] as number | undefined,
    idMal: media["idMal"] as number | undefined,
    siteUrl: (media["siteUrl"] ?? '') as string,
    isAdult: (media["isAdult"] ?? false) as boolean,
    alternativeTitles: [...new Set(alternativeTitles)] // Remove duplicates
  } as ProviderMetadata;

  return resultMetadata;
}
