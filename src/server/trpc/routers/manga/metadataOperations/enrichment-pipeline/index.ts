/**
 * Enrichment Pipeline
 *
 * Barrel re-export for the enrichment pipeline module.
 */

// Re-export value via import so isolatedModules checker can resolve it
import { runEnrichmentPipeline } from './pipeline-orchestrator';

export { runEnrichmentPipeline };
export type { EnrichmentProgress, EnrichmentPipelineOptions, EnrichmentPipelineResult } from './types';
