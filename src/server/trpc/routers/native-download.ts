/**
 * Native Download Router - Main Aggregator
 *
 * This router aggregates all native download sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - native-download/website-operations.ts - Website validation & scraping (3 procedures)
 * - native-download/download-operations.ts - Search & download operations (5 procedures)
 * - native-download/mangadex-operations.ts - MangaDex chapter search & download (7 procedures)
 *
 * Total: 15 procedures across 3 routers
 *
 * @module server/trpc/routers/native-download
 */

import { router } from '../trpc';

// Import all sub-routers
import { nativeDownloadOperationsRouter } from './native-download/download-operations';
import { mangadexOperationsRouter } from './native-download/mangadex-operations';
import { nativeDownloadWebsiteOperationsRouter } from './native-download/website-operations';

/**
 * Main Native Download router
 *
 * Merges all sub-routers to expose all procedures at the top level.
 * Maintains backward compatibility with existing API consumers.
 *
 * Procedures by Category:
 *
 * Website Operations (3 procedures):
 * - validateWebsite: Validate website URL for use as source
 * - fetchWebsiteContent: Proxy fetch website HTML for visual inspector
 * - validateSelector: Test CSS selector against fetched HTML
 *
 * Download Operations (5 procedures):
 * - searchManga: Search for manga across sources
 * - downloadChapter: Queue chapter download
 * - getDownloads: Get download history/status
 * - cancelDownload: Cancel active download
 * - retryDownload: Retry failed download
 */
export const nativeDownloadRouter = router({
  // Merge all sub-routers using tRPC's procedure spreading
  ...nativeDownloadWebsiteOperationsRouter._def.procedures,
  ...nativeDownloadOperationsRouter._def.procedures,
  ...mangadexOperationsRouter._def.procedures,
});
