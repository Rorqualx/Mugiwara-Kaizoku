/**
 * Download Manager Service
 *
 * Re-exports from decomposed modules for backward compatibility.
 *
 * Architecture:
 * - downloadManager/types.ts - Type definitions
 * - downloadManager/utils.ts - Type guards and helpers
 * - downloadManager/validation.ts - Request validation
 * - downloadManager/client-selection.ts - Client round-robin
 * - downloadManager/pack-tracking.ts - Pack download tracking
 * - downloadManager/prowlarr-handler.ts - Prowlarr downloads
 * - downloadManager/direct-handler.ts - Direct URL downloads
 * - downloadManager/download-manager.ts - Core manager class
 *
 * Original: 1013 lines → Refactored: 9 modules (max 401 lines each)
 */

export { DownloadManager } from './downloadManager/download-manager';
export type { DownloadPayload, MangaWithTitle, PackDownloadParams, ClientResult, SendToClientOptions } from './downloadManager/types';
