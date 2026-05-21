/**
 * Volume Result Builder Module
 *
 * Builds formatted volume result objects from raw ComicVine data.
 */

import type { VolumeResult, IssueWithCover, CoverImages } from './types';

/** Raw issue data from ComicVine API */
interface RawIssue {
  id: number;
  name?: string;
  issueNumber?: string;
  issue_number?: string;
  description?: string;
  deck?: string;
  cover_date?: string;
  store_date?: string;
  site_detail_url?: string;
  image?: {
    small_url?: string;
    medium_url?: string;
    super_url?: string;
    original_url?: string;
  };
}

/**
 * Convert raw ComicVine image to CoverImages format
 */
function buildCoverImages(image?: {
  small_url?: string;
  medium_url?: string;
  super_url?: string;
  original_url?: string;
}): CoverImages | undefined {
  if (!image) return undefined;

  const covers: CoverImages = {};
  if (image.small_url) covers.small = image.small_url;
  if (image.medium_url) covers.medium = image.medium_url;
  if (image.super_url) covers.large = image.super_url;
  if (image.original_url) covers.original = image.original_url;

  return Object.keys(covers).length > 0 ? covers : undefined;
}

/**
 * Build issue with cover from raw issue data
 */
function buildIssueWithCover(issue: RawIssue): IssueWithCover {
  const result: IssueWithCover = {
    id: issue.id,
  };

  if (issue.name) result.name = issue.name;
  const issueNum = issue.issueNumber ?? issue.issue_number;
  if (issueNum) {
    result.issueNumber = issueNum;
  }

  const covers = buildCoverImages(issue.image);
  if (covers) result.coverImages = covers;

  // Include description fields from the API
  if (issue.description) result.description = issue.description;
  if (issue.deck) result.deck = issue.deck;
  if (issue.cover_date) result.coverDate = issue.cover_date;
  if (issue.store_date) result.storeDate = issue.store_date;
  if (issue.site_detail_url) result.siteDetailUrl = issue.site_detail_url;

  return result;
}

/**
 * Build volume result from raw volume data
 * @param volume - Raw volume data from ComicVine
 * @param allIssues - Complete list of issues with cover images
 * @returns Formatted volume result
 */
export function buildVolumeResult(
  volume: {
    id: number;
    name?: string;
    description?: string;
    image?: {
      small_url?: string;
      medium_url?: string;
      super_url?: string;
      original_url?: string;
    };
    publisher?: {
      id: number;
      name?: string;
    };
    start_year?: number;
    count_of_issues?: number;
    characters?: Array<{
      id: number;
      name?: string;
    }>;
    person_credits?: Array<{
      id: number;
      name?: string;
      role?: string;
    }>;
    first_issue?: {
      id: number;
      name?: string;
      issueNumber?: string;
    };
    last_issue?: {
      id: number;
      name?: string;
      issueNumber?: string;
    };
    date_added?: string;
    date_last_updated?: string;
  },
  allIssues: RawIssue[]
): VolumeResult {
  const volumeResult: VolumeResult = {
    id: volume['id'],
  };

  if (volume['name']) volumeResult.name = volume['name'];
  if (volume['description']) volumeResult.description = volume['description'];

  const covers = buildCoverImages(volume.image);
  if (covers) volumeResult.coverImages = covers;

  if (volume.publisher) volumeResult.publisher = volume.publisher;
  if (volume.start_year) volumeResult.startYear = volume.start_year;
  if (volume.count_of_issues) volumeResult.issueCount = volume.count_of_issues;

  // Build issues with cover images
  volumeResult.issues = allIssues.map(buildIssueWithCover);

  if (volume.characters) volumeResult.characters = volume.characters;
  if (volume.person_credits) volumeResult.creators = volume.person_credits;
  if (volume.first_issue) volumeResult.firstIssue = volume.first_issue;
  if (volume.last_issue) volumeResult.lastIssue = volume.last_issue;
  if (volume.date_added) volumeResult.dateAdded = volume.date_added;
  if (volume.date_last_updated) volumeResult.dateLastUpdated = volume.date_last_updated;

  return volumeResult;
}
