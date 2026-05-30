/**
 * Shared types for the metadata enrichment pipeline result shape.
 *
 * `ProviderMatch` describes a single provider's best candidate for a manga,
 * and `EnrichmentResult` is the envelope returned by the enrichment flow
 * (modern pipeline + scanner auto-match adapter).
 *
 * Lives in `src/types/domain/` so the modern pipeline and the scanner share
 * one source of truth without coupling to a transport/service module.
 */

/**
 * Result of a provider match.
 *
 * `perFieldProvenance` is populated by the modern pipeline's
 * enrichment-result-builder; legacy/adapter paths may omit it.
 *
 * Read by phase-db-persistence to stamp `Metadata.providerMetadata.metadataProvenance`
 * with real per-field provenance instead of a single match-level provider.
 */
export interface ProviderMatch {
  id: string;
  provider: string;
  providerId: string;
  title: string;
  confidence: number;
  metadata?: unknown;
  perFieldProvenance?: Record<string, string>;
}

/** Envelope returned by enrichment flows (status + applied match + raw enriched payload). */
export interface EnrichmentResult {
  status: 'no_matches' | 'matches_found' | 'enriched' | 'error';
  manga: {
    id: number;
    title: string;
  };
  matches?: ProviderMatch[];
  appliedMatch?: ProviderMatch;
  requiresUserSelection?: boolean;
  error?: Error;
  enrichedData?: unknown;
}
