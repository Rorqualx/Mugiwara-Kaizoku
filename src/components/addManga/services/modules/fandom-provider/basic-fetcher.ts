/**
 * Basic fetch with fetchFandomMutation
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { isSuccess, type AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { calculateVolumeCount, calculateChapterCount } from './count-calculators';
import { buildMetadataFromFetchResponse } from './metadata-from-fetch';

import type { FandomMutations } from './types';

/**
 * Try basic fetch using fetchFandomMutation
 */
export async function tryBasicFetch(
  url: string,
  mutations: FandomMutations,
  result: Record<string, unknown>
): Promise<ProviderMetadata | undefined> {
  logger.debug('[Fandom BasicFetch] Fetching metadata', { url });

  const response = await mutations.fetchFandomMutation.mutateAsync({
    url
  }) as AsyncResult<unknown, unknown>;

  logger.debug('[Fandom BasicFetch] Response received', {
    status: response.status,
    hasData: !!(response as { data?: unknown }).data
  });

  if (!isSuccess(response)) {
    logger.debug('[Fandom BasicFetch] isSuccess check FAILED', {
      status: response.status,
      expectedStatus: 'success'
    });
    return undefined;
  }

  const data = response.data as Record<string, unknown>;

  // Calculate counts
  const volumes = data['volumes'];
  const volumesAndChapters = data['volumesAndChapters'] as Record<string, unknown> | undefined;
  const volumeCount = calculateVolumeCount(volumes, volumesAndChapters);

  const chapters = data['chapters'];
  const chapterCount = calculateChapterCount(chapters, volumesAndChapters);

  // Log enhanced metadata including cover
  const description = data['description'];
  const synopsis = data['synopsis'];
  const genres = data['genres'];
  const authors = data['authors'];
  const myAnimeListId = data['myAnimeListId'];
  const myAnimeListUrl = data['myAnimeListUrl'];
  const cover = data['cover'];
  const coverImage = data['coverImage'];
  logger.info('[Fandom] Enhanced metadata received:', {
    hasCover: !!cover,
    cover: cover,
    hasCoverImage: !!coverImage,
    coverImage: coverImage,
    hasDescription: !!description,
    descriptionLength: typeof description === 'string' ? description.length : 0,
    hasSynopsis: !!synopsis,
    synopsisLength: typeof synopsis === 'string' ? synopsis.length : 0,
    hasVolumes: !!volumes || (volumesAndChapters && !!volumesAndChapters['volumes']),
    hasChapters: !!chapters || (volumesAndChapters && !!volumesAndChapters['chapters']),
    hasGenres: !!genres,
    genresCount: Array.isArray(genres) ? genres.length : 0,
    genres: genres,
    hasAuthors: !!authors,
    authorsCount: Array.isArray(authors) ? authors.length : 0,
    myAnimeListId,
    myAnimeListUrl,
  });

  logger.debug('[Fandom BasicFetch] Data keys before building metadata:', {
    dataKeys: Object.keys(data),
    hasCover: 'cover' in data,
    coverValue: data['cover'],
  });

  return buildMetadataFromFetchResponse(data, result, url, volumeCount, chapterCount);
}
