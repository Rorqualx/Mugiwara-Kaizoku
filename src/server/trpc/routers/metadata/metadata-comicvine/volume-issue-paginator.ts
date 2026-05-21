/**
 * Volume Issue Paginator Module
 *
 * Handles fetching all issues for a volume with pagination support.
 */

import { logger } from '@/utils/logger';

/** Extended issue type from ComicVine API */
interface ComicVineIssueData {
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
}

/**
 * Check if existing issues have cover images
 * @param issues - Array of issues to check
 * @returns true if at least one issue has an image
 */
function hasIssueImages(issues: ComicVineIssueData[]): boolean {
  return issues.some((issue) => issue.image && Object.keys(issue.image).length > 0);
}

/**
 * Fetch all issues for a volume, with pagination if needed
 *
 * IMPORTANT: Always fetches from /issues endpoint to get full issue data including
 * cover images and descriptions. The volume endpoint's issues array doesn't include these.
 *
 * @param comicvineService - ComicVine service instance
 * @param volumeId - Volume ID
 * @param existingIssues - Issues already fetched from volume response (used as fallback only)
 * @param totalIssueCount - Total count of issues in volume
 * @returns Array of all issues with cover images and descriptions
 */
export async function fetchAllVolumeIssues(
  comicvineService: {
    getVolumeIssues: (
      id: number,
      offset: number,
      limit: number
    ) => Promise<ComicVineIssueData[]>;
  },
  volumeId: number,
  existingIssues: ComicVineIssueData[],
  totalIssueCount: number
): Promise<ComicVineIssueData[]> {
  // Only skip fetching if existing issues already have images
  // (e.g., from a previous full fetch that was cached)
  if (existingIssues.length >= totalIssueCount && hasIssueImages(existingIssues)) {
    logger.info(`Using existing ${existingIssues.length} issues with images for volume ${volumeId}`);
    return existingIssues;
  }

  // Always fetch from /issues endpoint to get full data including cover images
  // The volume endpoint's issues array doesn't include image data
  logger.info(`Fetching ${totalIssueCount} issues with covers for volume ${volumeId}`);
  try {
    const allIssues = await comicvineService.getVolumeIssues(volumeId, 0, totalIssueCount);
    logger.info(`Successfully fetched ${allIssues.length} issues with cover data`);
    return allIssues;
  } catch (error: unknown) {
    logger.warn(
      `Failed to fetch issues with covers: ${error instanceof Error ? error.message : String(error)}`
    );
    // Fall back to existing issues from volume response (no images, but better than nothing)
    return existingIssues;
  }
}
