/**
 * Wikipedia Fallback Types
 */

/** Options passed from pipeline orchestrator */
export interface WikipediaFallbackOptions {
  /** When true, force Wikipedia to run for volume data even if title coverage is sufficient */
  forceVolumeExtraction?: boolean;
}