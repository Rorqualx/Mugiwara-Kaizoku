/**
 * Field Extractors for Volume Normalization
 *
 * Individual extraction functions for each volume field.
 * Each function handles multiple provider field names.
 */

/**
 * Type guard for objects
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Extract volume number from various provider field names
 *
 * @param volume - The volume data object
 * @param index - The index in the volumes array (used as fallback)
 * @returns The volume number
 */
export function extractVolumeNumber(volume: Record<string, unknown>, index: number): number {
  return (
    (typeof volume['volumeNumber'] === 'number' ? volume['volumeNumber'] : null) ??
    (typeof volume['volume'] === 'number' ? volume['volume'] : null) ??
    (typeof volume['number'] === 'number' ? volume['number'] : null) ??
    (typeof volume['issue_number'] === 'number' ? volume['issue_number'] : null) ??
    (typeof volume['issueNumber'] === 'number' ? volume['issueNumber'] : null) ??
    index + 1
  );
}

/**
 * Extract title from various provider field names
 *
 * @param volume - The volume data object
 * @returns The title if found, undefined otherwise
 */
export function extractTitle(volume: Record<string, unknown>): string | undefined {
  return (
    (typeof volume['title'] === 'string' ? volume['title'] : null) ??
    (typeof volume['name'] === 'string' ? volume['name'] : null) ??
    (typeof volume['volumeTitle'] === 'string' ? volume['volumeTitle'] : null) ??
    undefined
  );
}

/**
 * Extract cover image from various provider structures
 *
 * Handles multiple provider formats:
 * - Direct string: coverImage
 * - ComicVine structure: image.medium_url, image.small_url, image.original_url
 * - AniList structure: coverImage.large, coverImage.medium, coverImage.small
 *
 * @param volume - The volume data object
 * @returns The cover image URL if found, undefined otherwise
 */
export function extractCoverImage(volume: Record<string, unknown>): string | undefined {
  // Direct string coverImage
  if (typeof volume['coverImage'] === 'string') {
    return volume['coverImage'];
  }

  // ComicVine structure: image.medium_url, image.small_url
  if (isRecord(volume['image'])) {
    const image = volume['image'];
    return (
      (typeof image['medium_url'] === 'string' ? image['medium_url'] : null) ??
      (typeof image['small_url'] === 'string' ? image['small_url'] : null) ??
      (typeof image['original_url'] === 'string' ? image['original_url'] : null) ??
      undefined
    );
  }

  // AniList structure: coverImage.large, coverImage.medium
  if (isRecord(volume['coverImage'])) {
    const cover = volume['coverImage'];
    return (
      (typeof cover['large'] === 'string' ? cover['large'] : null) ??
      (typeof cover['medium'] === 'string' ? cover['medium'] : null) ??
      (typeof cover['small'] === 'string' ? cover['small'] : null) ??
      undefined
    );
  }

  return undefined;
}

/**
 * Extract download URL from various provider field names
 *
 * @param volume - The volume data object
 * @returns The download URL if found, undefined otherwise
 */
export function extractDownloadUrl(volume: Record<string, unknown>): string | undefined {
  return (
    (typeof volume['url'] === 'string' ? volume['url'] : null) ??
    (typeof volume['site_detail_url'] === 'string' ? volume['site_detail_url'] : null) ??
    (typeof volume['api_detail_url'] === 'string' ? volume['api_detail_url'] : null) ??
    (typeof volume['siteUrl'] === 'string' ? volume['siteUrl'] : null) ??
    undefined
  );
}

/**
 * Extract release date from various provider field names
 *
 * @param volume - The volume data object
 * @returns The release date string if found, undefined otherwise
 */
export function extractReleaseDate(volume: Record<string, unknown>): string | undefined {
  return (
    (typeof volume['releaseDate'] === 'string' ? volume['releaseDate'] : null) ??
    (typeof volume['cover_date'] === 'string' ? volume['cover_date'] : null) ??
    (typeof volume['store_date'] === 'string' ? volume['store_date'] : null) ??
    (typeof volume['startDate'] === 'string' ? volume['startDate'] : null) ??
    (typeof volume['date'] === 'string' ? volume['date'] : null) ??
    undefined
  );
}

/**
 * Extract description from various provider field names
 *
 * @param volume - The volume data object
 * @returns The description if found, undefined otherwise
 */
export function extractDescription(volume: Record<string, unknown>): string | undefined {
  return (
    (typeof volume['description'] === 'string' ? volume['description'] : null) ??
    (typeof volume['deck'] === 'string' ? volume['deck'] : null) ??
    (typeof volume['summary'] === 'string' ? volume['summary'] : null) ??
    undefined
  );
}

/**
 * Extract chapters array if pre-parsed
 *
 * @param volume - The volume data object
 * @returns The chapters array if found, undefined otherwise
 */
export function extractChapters(volume: Record<string, unknown>): unknown[] | undefined {
  return Array.isArray(volume['chapters']) ? volume['chapters'] : undefined;
}
