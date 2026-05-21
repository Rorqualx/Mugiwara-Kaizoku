/**
 * MangaDex Client Re-exports
 *
 * Backward-compatible barrel that now re-exports from the ts-mangadex based client.
 * Consumers importing from '@/server/services/mangadex/client' continue to work.
 */

// New client
export { mangadexClient, KaizokuMangaDexClient as MangaDexClientService } from './ts-client-factory';
export { MangaDexApiError } from 'mangadex-ts-client';

// Helper function exports (still using old helpers for MangaDex API response types)
export {
  buildImageUrl,
  getEnglishTitle,
  getEnglishDescription,
  extractCoverUrl,
  extractCreators,
  extractScanlationGroups
} from './client/helpers';
