/**
 * Provider-specific volume title extractors
 *
 * Sub-extractors for ComicVine, Fandom, Wikipedia, and AniList volume data.
 * Used by useProviderMetadata hook as fallback (PRIORITY 4) extraction.
 *
 * @module components/manga/ResponsiveChapterList/hooks/provider-extractors
 */

import {
  safeGetRecord,
  safeGetArray,
  safeGetNumber,
  safeGetString,
  isRecord,
} from '../utils';

// ============================================================================
// Internal Helper
// ============================================================================

/**
 * Internal safe get for typed access
 */
function safeGet<T = unknown>(obj: unknown, key: string): T | undefined {
  if (!isRecord(obj) || !(key in obj)) {
    return undefined;
  }
  return obj[key] as T;
}

// ============================================================================
// ComicVine Issues
// ============================================================================

/**
 * Find ComicVine issues array from metadata paths
 */
function findComicVineIssues(metadata: Record<string, unknown>): unknown[] | undefined {
  const comicvineData = safeGetRecord(metadata, 'comicvine');
  const comicvineVolumesData = safeGetRecord(metadata, 'comicvine_volumes');

  const rawData = comicvineData ? safeGetRecord(comicvineData, 'rawData') : undefined;
  const comicvineMetadata = comicvineData ? safeGetRecord(comicvineData, 'metadata') : undefined;
  const volumesMetadata = comicvineVolumesData ? safeGetRecord(comicvineVolumesData, 'metadata') : undefined;

  return (
    (rawData ? safeGetArray(rawData, 'issues') : undefined) ??
    (comicvineMetadata ? safeGetArray(comicvineMetadata, 'issues') : undefined) ??
    (volumesMetadata ? safeGetArray(volumesMetadata, 'issues') : undefined) ??
    (comicvineVolumesData ? safeGetArray(comicvineVolumesData, 'issues') : undefined)
  );
}

/**
 * Format ComicVine issue title
 */
function formatComicVineIssueTitle(issue: Record<string, unknown>, index: number): string {
  const issueName =
    safeGetString(issue, 'name') ??
    safeGetString(issue, 'title') ??
    safeGetString(issue, 'issueName');

  const issueNumber =
    safeGetNumber(issue, 'issue_number') ??
    safeGetNumber(issue, 'issueNumber') ??
    safeGetNumber(issue, 'volumeNumber') ??
    (index + 1);

  if (issueName) {
    return `#${issueNumber}: ${issueName}`;
  }
  return `Issue #${issueNumber}`;
}

/**
 * Extract volume titles from ComicVine issues data
 *
 * ComicVine stores comic book issues that are treated as volumes.
 * Searches multiple metadata paths:
 * - comicvine.rawData.issues
 * - comicvine.metadata.issues
 * - comicvine_volumes.metadata.issues
 * - comicvine_volumes.issues
 *
 * @param metadata - Provider metadata object
 * @returns Volume titles map indexed by volume number
 */
export function extractComicVineIssues(metadata: unknown): Record<number, string> {
  if (!isRecord(metadata)) {
    return {};
  }

  const comicVineIssues = findComicVineIssues(metadata);
  if (!comicVineIssues || !Array.isArray(comicVineIssues)) {
    return {};
  }

  const volumeTitles: Record<number, string> = {};

  for (let i = 0; i < comicVineIssues.length; i++) {
    const issue = comicVineIssues[i];
    if (!isRecord(issue)) {
      continue;
    }

    const volumeNumber =
      safeGetNumber(issue, 'volumeNumber') ??
      safeGetNumber(issue, 'issueNumber') ??
      (i + 1);

    volumeTitles[volumeNumber] = formatComicVineIssueTitle(issue, i);
  }

  return volumeTitles;
}

// ============================================================================
// Fandom Volumes
// ============================================================================

/**
 * Find Fandom volume data from nested metadata structures
 */
function findFandomVolumeDataFromUpper(fandomUpperData: Record<string, unknown>): unknown {
  const volumeDetails = safeGet<unknown>(fandomUpperData, 'volumeDetails');
  if (volumeDetails) {
    return volumeDetails;
  }

  const fandomMetadataObj = safeGetRecord(fandomUpperData, 'metadata');
  const metadataVolumeDetails = fandomMetadataObj
    ? safeGet<unknown>(fandomMetadataObj, 'volumeDetails')
    : undefined;
  if (metadataVolumeDetails) {
    return metadataVolumeDetails;
  }

  return safeGet<unknown>(fandomUpperData, 'volumes');
}

/**
 * Find Fandom volume data from all possible metadata paths
 */
function findFandomVolumeData(metadata: Record<string, unknown>): unknown {
  const fandomVolumesData = safeGet<unknown>(metadata, 'fandom_volumes');
  const fandomUpperData = safeGetRecord(metadata, 'FANDOM');
  const fandomChaptersData = safeGetRecord(metadata, 'fandom_chapters');

  let fandomData: unknown = fandomVolumesData ?? fandomUpperData ?? fandomChaptersData;

  if (fandomUpperData) {
    const upperData = findFandomVolumeDataFromUpper(fandomUpperData);
    if (upperData) {
      fandomData = upperData;
    }
  }

  if (!fandomData && fandomChaptersData) {
    const chaptersMetadata = safeGetRecord(fandomChaptersData, 'metadata');
    const volumeDetails = chaptersMetadata
      ? safeGet<unknown>(chaptersMetadata, 'volumeDetails')
      : undefined;
    if (volumeDetails) {
      fandomData = volumeDetails;
    }
  }

  return fandomData;
}

/**
 * Extract volumes array from Fandom data
 */
function extractFandomVolumesArray(fandomData: unknown): unknown[] {
  if (Array.isArray(fandomData)) {
    return fandomData;
  }

  const fandomDataObj = isRecord(fandomData) ? fandomData : null;
  return fandomDataObj ? (safeGetArray(fandomDataObj, 'volumes') ?? []) : [];
}

/**
 * Filter volumes by isSelected flag if present
 */
function filterSelectedFandomVolumes(volumes: unknown[]): unknown[] {
  const hasSelectionFlag = volumes.some((v: unknown) => {
    if (!isRecord(v)) return false;
    return 'isSelected' in v;
  });

  if (!hasSelectionFlag) {
    return volumes;
  }

  return volumes.filter((v: unknown) => {
    if (!isRecord(v)) return false;
    return safeGet<boolean>(v, 'isSelected') === true;
  });
}

/**
 * Extract volume titles from Fandom volume data
 *
 * @param metadata - Provider metadata object
 * @returns Volume titles map indexed by volume number
 */
export function extractFandomVolumes(metadata: unknown): Record<number, string> {
  if (!isRecord(metadata)) {
    return {};
  }

  const fandomData = findFandomVolumeData(metadata);
  if (!fandomData) {
    return {};
  }

  const fandomVolumes = extractFandomVolumesArray(fandomData);
  const volumesToDisplay = filterSelectedFandomVolumes(fandomVolumes);

  const volumeTitles: Record<number, string> = {};

  volumesToDisplay.forEach((volume: unknown) => {
    if (!isRecord(volume)) {
      return;
    }

    const volumeNumber =
      safeGetNumber(volume, 'volumeNumber') ??
      safeGetNumber(volume, 'number');

    const volumeTitle =
      safeGetString(volume, 'title') ??
      safeGetString(volume, 'name');

    if (volumeNumber !== undefined && volumeTitle !== undefined) {
      volumeTitles[volumeNumber] = volumeTitle;
    }
  });

  return volumeTitles;
}

// ============================================================================
// Wikipedia Volumes
// ============================================================================

/**
 * Extract volume titles from Wikipedia volume data
 *
 * @param metadata - Provider metadata object
 * @returns Volume titles map indexed by volume number
 */
export function extractWikipediaVolumes(metadata: unknown): Record<number, string> {
  if (!isRecord(metadata)) {
    return {};
  }

  const volumeTitles: Record<number, string> = {};

  const wikipediaChapters = safeGetRecord(metadata, 'wikipedia_chapters');
  const volumeList = wikipediaChapters ? safeGetArray(wikipediaChapters, 'volumeList') : undefined;

  if (!volumeList || !Array.isArray(volumeList)) {
    return {};
  }

  volumeList.forEach((volume: unknown) => {
    if (!isRecord(volume)) {
      return;
    }

    const volumeNumber =
      safeGetNumber(volume, 'volumeNumber') ??
      safeGetNumber(volume, 'number');

    if (volumeNumber === undefined) {
      return;
    }

    const title = safeGetString(volume, 'title') ?? `Volume ${volumeNumber}`;
    volumeTitles[volumeNumber] = title;
  });

  return volumeTitles;
}

// ============================================================================
// AniList Volumes
// ============================================================================

/**
 * Extract volume titles from AniList volume data
 *
 * @param metadata - Provider metadata object
 * @returns Volume titles map indexed by volume number
 */
export function extractAniListVolumes(metadata: unknown): Record<number, string> {
  if (!isRecord(metadata)) {
    return {};
  }

  const volumeTitles: Record<number, string> = {};

  const anilistData = safeGetRecord(metadata, 'anilist');
  if (!anilistData) {
    return {};
  }

  const anilistMetadata = safeGetRecord(anilistData, 'metadata');
  const volumeCount =
    safeGetNumber(anilistData, 'volumes') ??
    (anilistMetadata ? safeGetNumber(anilistMetadata, 'volumes') : undefined);

  if (volumeCount === undefined || typeof volumeCount !== 'number') {
    return {};
  }

  for (let i = 1; i <= volumeCount; i++) {
    volumeTitles[i] = `Volume ${i}`;
  }

  return volumeTitles;
}

// ============================================================================
// ComicVine Fallback
// ============================================================================

/**
 * Extract volume titles from ComicVine fallback when chapters are from ComicVine
 *
 * @param metadata - Provider metadata object
 * @param selectedSources - Selected source IDs object
 * @returns Volume titles map indexed by volume number
 */
export function extractComicVineFallback(
  metadata: unknown,
  selectedSources: Record<string, unknown>
): Record<number, string> {
  if (!isRecord(metadata)) {
    return {};
  }

  const volumeTitles: Record<number, string> = {};

  const comicvineData = safeGetRecord(metadata, 'comicvine');
  const comicvineMetadata = comicvineData ? safeGetRecord(comicvineData, 'metadata') : undefined;
  const issues = comicvineMetadata ? safeGetArray(comicvineMetadata, 'issues') : undefined;

  if (!issues || !Array.isArray(issues)) {
    return {};
  }

  const chaptersFromComicVine = selectedSources['Chapter'] === 'comicvine';
  if (!chaptersFromComicVine) {
    return {};
  }

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    if (!isRecord(issue)) {
      continue;
    }

    const volumeNumber = i + 1;
    const issueName =
      safeGetString(issue, 'name') ??
      safeGetString(issue, 'title');

    const issueNumber =
      safeGetNumber(issue, 'issue_number') ??
      safeGetNumber(issue, 'issueNumber') ??
      (i + 1);

    if (issueName) {
      volumeTitles[volumeNumber] = `#${issueNumber}: ${issueName}`;
    } else {
      volumeTitles[volumeNumber] = `Issue #${issueNumber}`;
    }
  }

  return volumeTitles;
}
