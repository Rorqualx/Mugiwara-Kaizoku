/**
 * Volume Fetcher Module
 *
 * Fetches and formats ComicVine volume details with pagination support.
 */

import { fetchAllVolumeIssues } from './volume-issue-paginator';
import { buildVolumeResult } from './volume-result-builder';

import type { VolumeResult } from './types';

/**
 * Fetch volume details from ComicVine
 * @param comicvineService - ComicVine service instance
 * @param numericId - Volume ID
 * @returns Formatted volume result or null if not found
 */
export async function fetchVolumeDetails(
  comicvineService: {
    getCompleteVolumeInfo: (id: number) => Promise<{
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
      issues?: Array<{
        id: number;
        name?: string;
        issueNumber?: string;
      }>;
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
      genres?: string | string[] | Array<{ id: number; name?: string; api_detail_url?: string }>;
      aliases?: string | string[];
      site_detail_url?: string;
    } | null>;
    getVolumeIssues: (
      id: number,
      offset: number,
      limit: number
    ) => Promise<
      Array<{
        id: number;
        name?: string;
        issue_number?: string;  // API returns snake_case
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
      }>
    >;
  },
  numericId: number
): Promise<VolumeResult | null> {
  const volume = await comicvineService.getCompleteVolumeInfo(numericId);

  if (!volume) {
    return null;
  }

  // Fetch all issues with pagination if needed
  const allIssues = await fetchAllVolumeIssues(
    comicvineService,
    numericId,
    volume.issues ?? [],
    volume.count_of_issues ?? 0
  );

  // Build and return the formatted result
  return buildVolumeResult(volume, allIssues);
}
