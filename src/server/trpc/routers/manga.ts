import { router } from '../trpc';

import { bookmarkRouter } from './manga/bookmarkOperations';
import { chapterRouter } from './manga/chapterOperations';
import { crudRouter } from './manga/crudOperations';
import { downloadRouter } from './manga/downloadOperations';
import { importRouter } from './manga/importOperations';
import { metadataRouter } from './manga/metadataOperations';
import { monitoringRouter } from './manga/monitoringOperations';
import { providerRouter } from './manga/providerOperations';
import { searchRouter } from './manga/searchOperations';
import { suwayomiMangaRouter } from './manga/suwayomi';

/**
 * Manga Router
 *
 * Provides API endpoints for managing manga, including:
 * - Querying and retrieving manga with related data
 * - Searching for manga across different providers
 * - Managing manga metadata and chapters
 * - Downloading manga chapters
 * - Handling synchronization of manga data
 */
// Merge all sub-routers to restore 43 procedures that were extracted
// Note: Accessing _def.procedures to spread procedures - this maintains flat API structure
export const mangaRouter = router({
  // Spread procedures from all sub-routers
  ...searchRouter._def.procedures,
  ...crudRouter._def.procedures,
  ...downloadRouter._def.procedures,
  ...monitoringRouter._def.procedures,
  ...providerRouter._def.procedures,
  ...metadataRouter._def.procedures,
  ...bookmarkRouter._def.procedures,
  ...chapterRouter._def.procedures,
  ...importRouter._def.procedures,
  ...suwayomiMangaRouter._def.procedures,
});
