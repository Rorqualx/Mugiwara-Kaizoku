/**
 * ComicVine Field Extractors
 *
 * Extracts ComicVine-specific fields like issues, characters, creators,
 * and siteDetailUrl from various data sources.
 *
 * @module components/addManga/form/confirmation-data-builder/comicvine-extractors
 */

import { extractPublisher } from './publisher-identifier-extractors';
import { removeUndefined } from './utilities';

import type {
  MangaWithDynamicMetadata,
  ProviderSpecificObject,
  MetadataObject,
} from './types';

/**
 * Extracts ComicVine-specific fields
 *
 * @param manga - Main manga object
 * @param providerSpecific - Provider-specific data
 * @param metadata - Metadata object
 * @returns Object with ComicVine fields
 */
// eslint-disable-next-line complexity -- Complex field extraction from multiple data sources
export function extractComicVineFields(
  manga: MangaWithDynamicMetadata,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): Record<string, unknown> {
  const chars = manga.characters ?? providerSpecific?.characters ?? metadata?.['characters'];
  const characters = (typeof chars === 'number' || Array.isArray(chars)) ? chars : undefined;

  // Extract issueCount with type safety
  const rawIssueCount = manga.issueCount ?? providerSpecific?.issueCount ?? metadata?.['issueCount'];
  const issueCount = typeof rawIssueCount === 'number' ? rawIssueCount : undefined;

  // Extract siteDetailUrl with type safety
  const rawSiteDetailUrl = manga.siteDetailUrl ?? providerSpecific?.siteDetailUrl ?? metadata?.['siteDetailUrl'];
  const siteDetailUrl = typeof rawSiteDetailUrl === 'string' ? rawSiteDetailUrl : undefined;

  return removeUndefined({
    issues: manga.issues ?? providerSpecific?.issues ?? metadata?.['issues'],
    issueCount,
    characters,
    creators: manga.creators ?? providerSpecific?.creators ?? metadata?.['creators'],
    publisher: extractPublisher(manga, providerSpecific, metadata),
    siteDetailUrl,
  });
}
