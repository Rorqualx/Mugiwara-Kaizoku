/**
 * Assembles metadata from field builders
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import {
  buildBasicFields,
  buildStatusAndFormat,
  buildArrayFields,
  buildCreatorFields,
  buildPublicationFields,
  buildImageFields,
  buildExternalLinkFields,
  buildVolumeChapterData
} from './field-builders';

/**
 * Build metadata object incrementally from fetch response data
 */
export function buildMetadataFromFetchResponse(
  data: Record<string, unknown>,
  result: Record<string, unknown>,
  url: string,
  volumeCount: number,
  chapterCount: number
): ProviderMetadata {
  // Log incoming data for debugging - especially cover fields
  logger.debug('[Fandom Assembler] Input data:', {
    hasCover: !!data['cover'],
    cover: data['cover'],
    hasCoverImage: !!data['coverImage'],
    coverImage: data['coverImage'],
    hasAuthors: !!data['authors'],
    authorsCount: Array.isArray(data['authors']) ? data['authors'].length : 0,
    authors: data['authors'],
    hasMyAnimeListId: !!data['myAnimeListId'],
    myAnimeListId: data['myAnimeListId'],
    dataKeys: Object.keys(data),
  });

  const metadata = data['metadata'] as Record<string, unknown> | undefined;
  const coverArt = data['coverArt'] as Record<string, unknown> | undefined;
  const volumesAndChapters = data['volumesAndChapters'] as Record<string, unknown> | undefined;

  // Build external link fields first to inspect
  const externalFields = buildExternalLinkFields(data);
  logger.debug('[Fandom Assembler] External link fields:', {
    idMal: externalFields.idMal,
    hasExternalLinks: Array.isArray(externalFields.externalLinks),
    externalLinksCount: externalFields.externalLinks?.length ?? 0,
  });

  // Build creator fields to inspect
  const creatorFields = buildCreatorFields(data, metadata, result);
  logger.debug('[Fandom Assembler] Creator fields:', {
    authors: creatorFields.authors,
    authorsCount: creatorFields.authors?.length ?? 0,
    artists: creatorFields.artists,
    artistsCount: creatorFields.artists?.length ?? 0,
  });

  // Build image fields and log result
  const imageFields = buildImageFields(data, coverArt);
  logger.debug('[Fandom Assembler] Image fields result:', {
    coverImage: imageFields.coverImage,
    hasCoverImage: !!imageFields.coverImage,
    alternativeTitles: imageFields.alternativeTitles,
  });

  const resultMetadata: ProviderMetadata = {
    ...buildBasicFields(data, result, url),
    ...buildStatusAndFormat(data),
    ...buildArrayFields(data, metadata),
    ...creatorFields,
    ...buildPublicationFields(data),
    ...imageFields,
    ...externalFields,
    ...buildVolumeChapterData(data, volumesAndChapters, volumeCount, chapterCount)
  } as ProviderMetadata;

  // URLs
  resultMetadata.url = String(url);
  resultMetadata.wikiUrl = String(url);

  // Log final result including cover
  logger.debug('[Fandom Assembler] Final metadata:', {
    coverImage: resultMetadata.coverImage,
    hasCoverImage: !!resultMetadata.coverImage,
    idMal: resultMetadata.idMal,
    authors: resultMetadata.authors,
    authorsCount: resultMetadata.authors?.length ?? 0,
  });

  return resultMetadata;
}
