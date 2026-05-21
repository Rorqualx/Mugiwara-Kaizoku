/**
 * Download Manager Service
 *
 * Main entry point for download management.
 * Re-exports DownloadManager class and types.
 */

export * from './types';
export * from './utils';
export * from './validation';
export * from './pack-tracking';
export * from './client-selection';
export * from './direct-handler';
export * from './prowlarr-handler';
export { DownloadManager } from './download-manager';
