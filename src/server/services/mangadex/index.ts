/**
 * MangaDex Service Module
 *
 * Main entry point for MangaDex integration services.
 * Uses mangadex-ts-client under the hood via KaizokuMangaDexClient.
 *
 * @module server/services/mangadex
 */

// New ts-mangadex based client (primary export)
export { mangadexClient, KaizokuMangaDexClient, tsMangadexClient } from './ts-client-factory';

// Re-export from mangadex-ts-client for direct access
export { MangaDexClient, MangaDexApiError, createDefaultClient } from 'mangadex-ts-client';

// DB-backed config service (unchanged)
export { mangadexConfigService } from './configService';

// App-specific types (kept for consumers)
export * from './types';

// Standalone helpers for working with MangaDex API response data
export {
  buildImageUrl,
  getEnglishTitle,
  getEnglishDescription,
  extractCoverUrl,
  extractCreators,
  extractScanlationGroups,
} from './client/helpers';
