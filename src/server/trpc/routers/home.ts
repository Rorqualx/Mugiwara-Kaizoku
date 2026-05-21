/**
 * Home Router - Main Aggregator
 *
 * This router aggregates all home-related sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - home/utils.ts - Shared utilities, types, genres (0 procedures)
 * - home/local-queries.ts - Local database queries (4 procedures)
 * - home/anilist-popular.ts - AniList popular/trending (3 procedures)
 * - home/anilist-filtered.ts - AniList filtered queries (4 procedures)
 * - home/anilist-details.ts - AniList manga details (1 procedure)
 *
 * Total: 12 procedures across 4 routers
 *
 * Original file: 1447 lines -> Refactored: ~60 lines (96% reduction)
 *
 * Procedures by Category:
 *
 * Local Database (4 procedures):
 * - hasManga: Check if manga exists
 * - getContinueReading: User reading progress
 * - getRecentlyAdded: Recently added manga
 * - getRecentlyReleased: Manga with recent chapters
 *
 * AniList Popular (3 procedures):
 * - getPopular: Most popular manga
 * - getTop100: Top 100 manga
 * - getTrending: Trending manga
 *
 * AniList Filtered (4 procedures):
 * - getByGenre: Filter by genre
 * - getAvailableGenres: List genres
 * - getByFormat: Filter by format
 * - getNewSeries: Current year series
 *
 * AniList Details (1 procedure):
 * - getMangaDetails: Comprehensive manga info
 *
 * @module server/trpc/routers/home
 */

import { router } from '../trpc';

// Import all sub-routers
import { homeAnilistDetailsRouter } from './home/anilist-details';
import { homeAnilistFilteredRouter } from './home/anilist-filtered';
import { homeAnilistPopularRouter } from './home/anilist-popular';
import { homeLocalQueriesRouter } from './home/local-queries';

/**
 * Main home router
 *
 * Merges all sub-routers to expose all 12 procedures at the top level.
 * Maintains backward compatibility with existing API consumers.
 */
export const homeRouter = router({
  // Merge all sub-routers using tRPC's procedure spreading
  ...homeLocalQueriesRouter._def.procedures,
  ...homeAnilistPopularRouter._def.procedures,
  ...homeAnilistFilteredRouter._def.procedures,
  ...homeAnilistDetailsRouter._def.procedures,
});
