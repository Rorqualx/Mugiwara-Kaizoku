/**
 * Details Fetcher Module
 *
 * Orchestrates fetching of issue or volume details from ComicVine.
 */

import { fetchIssueDetails } from './issue-fetcher';
import { fetchVolumeDetails } from './volume-fetcher';

import type { IssueResult, VolumeResult } from './types';

/**
 * Fetch details from ComicVine based on type
 * @param comicvineService - ComicVine service instance
 * @param itemType - Type of item to fetch (issue or volume)
 * @param numericId - Numeric ID of the item
 * @returns Issue or volume result, or null if not found
 */
export async function fetchComicvineDetails(
  comicvineService: {
    initialize: () => Promise<boolean | void>;
    getIssueInfo: (id: number) => Promise<{
      id: number;
      name?: string;
      description?: string;
      image?: {
        small_url?: string;
        medium_url?: string;
        super_url?: string;
        original_url?: string;
      };
      cover_date?: string;
      store_date?: string;
      volume?: {
        id: number;
        name?: string;
      };
      character_credits?: Array<{
        id: number;
        name?: string;
      }>;
      person_credits?: Array<{
        id: number;
        name?: string;
        role?: string;
      }>;
    } | null>;
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
        issueNumber?: string;
      }>
    >;
  },
  itemType: 'volume' | 'issue',
  numericId: number
): Promise<IssueResult | VolumeResult | null> {
  // Initialize the service
  await comicvineService.initialize();

  // Fetch the appropriate data based on type
  if (itemType === 'issue') {
    return fetchIssueDetails(comicvineService, numericId);
  } else {
    return fetchVolumeDetails(comicvineService, numericId);
  }
}
