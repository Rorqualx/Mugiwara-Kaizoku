/**
 * ComicVine Metadata Operations Helpers
 *
 * Re-exports all helper functions for the ComicVine operations router.
 */

export { extractVolumeIdFromUrl } from './url-helpers';

export {
  fetchVolumeDataViaApi,
  formatIssueAsVolume,
  generateChaptersFromApiData
} from './api-helpers';
export type { ComicVineIssue, FormattedVolume, VolumeApiData } from './api-helpers';

export {
  validateComicVineError,
  validateComicVineStatusCode,
  validateComicVineResults,
  handleComicVineTestError
} from './validation-helpers';

export {
  scrapeVolumesWithConcurrency,
  logScrapingResults
} from './scraping-helpers';

export {
  testComicVineProvider,
  testAniListProvider
} from './provider-tests';
