/**
 * Issue Fetcher Module
 *
 * Fetches and formats ComicVine issue details.
 */

import type { IssueResult } from './types';

/**
 * Fetch issue details from ComicVine
 * @param comicvineService - ComicVine service instance
 * @param numericId - Issue ID
 * @returns Formatted issue result or null if not found
 */
export async function fetchIssueDetails(
  comicvineService: {
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
  },
  numericId: number
): Promise<IssueResult | null> {
  const issue = await comicvineService.getIssueInfo(numericId);

  if (!issue) {
    return null;
  }

  // Build issue result
  const issueResult: IssueResult = {
    id: issue['id'],
  };

  if (issue['name']) issueResult.name = issue['name'];
  if (issue['description']) issueResult.description = issue['description'];

  if (issue.image) {
    issueResult.coverImages = {
      ...(issue.image.small_url && { small: issue.image.small_url }),
      ...(issue.image.medium_url && { medium: issue.image.medium_url }),
      ...(issue.image.super_url && { large: issue.image.super_url }),
      ...(issue.image.original_url && { original: issue.image.original_url }),
    };
  }

  if (issue.cover_date) issueResult.coverDate = issue.cover_date;
  if (issue.store_date) issueResult.storeDate = issue.store_date;
  if (issue.volume) issueResult.volume = issue.volume;
  if (issue.character_credits) issueResult.characterCredits = issue.character_credits;
  if (issue.person_credits) issueResult.personCredits = issue.person_credits;

  return issueResult;
}
