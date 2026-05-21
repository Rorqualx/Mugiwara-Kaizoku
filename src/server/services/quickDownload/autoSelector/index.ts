/**
 * Quick Download Auto-Selector — barrel export
 *
 * The 5-module Prowlarr-only orchestrator that lived here previously was
 * replaced by a thin shim over the unified release-search pipeline. The
 * only public surface is the QuickDownloadService class.
 */

export * from './service';
