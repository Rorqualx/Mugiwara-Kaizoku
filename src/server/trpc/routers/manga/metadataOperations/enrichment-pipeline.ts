/**
 * Shared Enrichment Pipeline
 *
 * Re-exports from the enrichment-pipeline/ subdirectory.
 * Split into focused modules for maintainability (was 630 lines).
 */

// Re-export value via import so isolatedModules checker can resolve it
import { runEnrichmentPipeline } from './enrichment-pipeline/pipeline-orchestrator';

export { runEnrichmentPipeline };
export type { EnrichmentProgress, EnrichmentPipelineResult } from './enrichment-pipeline/types';
