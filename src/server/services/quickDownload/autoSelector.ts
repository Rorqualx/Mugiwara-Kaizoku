/**
 * Quick Download Auto-Selector — back-compat re-export
 *
 * Existing tRPC + UI consumers import the QuickDownloadService class from
 * this path; the implementation lives in ./autoSelector/service.ts and now
 * delegates to the unified release-search pipeline.
 */

export * from './autoSelector/service';
