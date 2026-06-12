/**
 * Metadata TRPC Router - Main Aggregator
 *
 * This router aggregates all metadata-related sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - metadata/metadata-utils.ts - Shared utilities, types, schemas
 * - metadata/metadata-core.ts - Core operations (preferences, conflicts, cache, refresh)
 * - metadata/metadata-fandom-*.ts - Fandom integration (4 modules)
 *   - fandom-enhanced/ - Enhanced Fandom metadata with validation
 *   - metadata-fandom-url-parser.ts - Fandom URL parsing & volume extraction
 *   - metadata-fandom-chapter.ts - Fandom chapter metadata fetching
 *   - fandom-fetch/ - Basic Fandom metadata fetching
 * - metadata/metadata-url-parser.ts - Multi-provider URL auto-detection
 * - metadata/metadata-anilist.ts - AniList GraphQL integration
 * - metadata/metadata-comicvine*.ts - ComicVine integration (2 modules)
 * - metadata/metadata-wikipedia.ts - Wikipedia & search
 * - metadata/metadata-chapters.ts - Chapter & volume processing
 * - metadata/metadata-static-analysis.ts - Static page analysis for parser hints
 *
 * Total: 30 procedures across 13 routers
 *
 * Original file: 3432 lines → Refactored: ~100 lines (97% reduction)
 */

import { router } from '../trpc';

// Import all sub-routers
import { metadataFandomChapterRouter } from './metadata/fandom-chapter';
import { metadataFandomEnhancedRouter } from './metadata/fandom-enhanced';
import { metadataFandomFetchRouter } from './metadata/fandom-fetch';
import { metadataAnilistRouter } from './metadata/metadata-anilist';
import { metadataChaptersRouter } from './metadata/metadata-chapters';
import { metadataComicvineRouter } from './metadata/metadata-comicvine';
import { metadataComicvineOpsRouter } from './metadata/metadata-comicvine-ops';
import { metadataCoreRouter } from './metadata/metadata-core';
import { metadataFandomUrlParserRouter } from './metadata/metadata-fandom-url-parser';
import { metadataMangadexRouter } from './metadata/metadata-mangadex';
import { metadataStaticAnalysisRouter } from './metadata/metadata-static-analysis';
import { metadataUrlParserRouter } from './metadata/metadata-url-parser';
import { metadataWikipediaRouter } from './metadata/metadata-wikipedia';

/**
 * Main metadata router
 *
 * Merges all sub-routers to expose all 30 procedures at the top level.
 * Maintains backward compatibility with existing API consumers.
 *
 * Procedures by Category:
 *
 * Core Operations (8):
 * - fieldPreferences: Get field preferences for a manga
 * - updateFieldPreferences: Update field preferences
 * - providerStrengths: Get provider strength configuration
 * - getConflicts: Get metadata conflicts for a manga
 * - resolveConflict: Resolve a metadata conflict
 * - clearMetadataCache: Clear cached metadata
 * - refreshMetadata: Refresh metadata from providers
 * - updateUrls: Update metadata URLs
 *
 * Fandom Integration (4):
 * - parseFandomUrlEnhanced: Parse Fandom URL with enhanced validation
 * - parseFandomUrl: Parse Fandom URL (basic)
 * - fetchFandomChapterMetadata: Fetch chapter metadata from Fandom
 * - fetchFandomMetadata: Fetch basic metadata from Fandom
 *
 * URL Parsing & External APIs (2):
 * - parseMetadataUrl: Parse metadata URLs (Fandom, ComicVine, AniList)
 * - fetchAnilistMetadata: Fetch metadata from AniList
 *
 * ComicVine Integration (8):
 * - fetchComicvineMetadata: Fetch metadata from ComicVine
 * - fetchComicvineVolumeDetails: Fetch volume details from ComicVine
 * - fetchComicVineIssues: Fetch issues for a volume
 * - enrichComicvine: Enrich existing metadata with ComicVine data
 * - scrapeComicVineChapters: Scrape chapter data from ComicVine
 * - scrapeComicVineVolumeUrls: Scrape volume URLs from ComicVine
 * - scrapeComicVineVolume: Scrape a specific volume
 * - testProvider: Test a metadata provider
 *
 * Wikipedia & Search (4):
 * - fetchWikipediaMetadata: Fetch metadata from Wikipedia
 * - searchWikipedia: Search Wikipedia for manga
 * - searchFandomWikis: Search across Fandom wikis
 * - fetchEnhancedMangaMetadata: Fetch enhanced manga metadata
 *
 * Chapter & Volume Processing (3):
 * - parseEnhancedVolumes: Parse enhanced volume data
 * - fetchChapterDetails: Fetch detailed chapter information
 * - fetchChapterDetailsProgressive: Fetch chapter details with progressive loading
 */
export const metadataRouter = router({
  // Merge all sub-routers using tRPC's procedure spreading
  ...metadataCoreRouter._def.procedures,
  ...metadataFandomEnhancedRouter._def.procedures,
  ...metadataFandomUrlParserRouter._def.procedures,
  ...metadataFandomChapterRouter._def.procedures,
  ...metadataFandomFetchRouter._def.procedures,
  ...metadataUrlParserRouter._def.procedures,
  ...metadataAnilistRouter._def.procedures,
  ...metadataComicvineRouter._def.procedures,
  ...metadataComicvineOpsRouter._def.procedures,
  ...metadataMangadexRouter._def.procedures,
  ...metadataWikipediaRouter._def.procedures,
  ...metadataChaptersRouter._def.procedures,
  ...metadataStaticAnalysisRouter._def.procedures,
});
