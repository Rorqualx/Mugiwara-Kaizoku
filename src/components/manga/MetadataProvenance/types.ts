/**
 * Shared types for MetadataProvenance components
 *
 * @module components/manga/MetadataProvenance/types
 */

import type { MetadataProvenance as MetadataProvenanceType } from '@/types/search.types';

/**
 * Provider data structure from provenance
 */
export interface ProviderData {
  source: string;
  confidence: number;
  lastUpdated: Date;
}

/**
 * Enhanced provider data structure with alternatives
 */
export interface EnhancedProviderData {
  provider: string;
  confidence: number;
  quality?: number;
  alternatives?: Array<{
    provider: string;
    value: unknown;
    confidence: number;
    quality?: number;
  }>;
}

/**
 * Parsed providers structure
 */
export interface ParsedProviders {
  primaryProvider: string | undefined;
  additionalProviders: string[];
  allProviders: string[];
}

/**
 * Common props for provenance components
 */
export interface BaseProvenanceProps {
  /**
   * The field name to show provenance for
   */
  field: string;

  /**
   * The provenance data
   */
  provenance?: MetadataProvenanceType | null | undefined;

  /**
   * Enhanced provenance data with alternatives
   */
  enhancedProvenance?: EnhancedProviderData | null | undefined;

  /**
   * Whether to show confidence scores
   */
  showConfidence?: boolean;

  /**
   * Custom label for the field
   */
  label?: string | undefined;

  /**
   * The value being displayed
   */
  value?: React.ReactNode | undefined;

  /**
   * Size of the badge
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | undefined;
}

/**
 * Props for MetadataProvenance component
 */
export interface MetadataProvenanceProps extends BaseProvenanceProps {
  /**
   * Whether to show as inline badge or tooltip
   */
  inline?: boolean;
}

/**
 * Props for ProviderBadge component
 */
export interface ProviderBadgeProps {
  provider: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

/**
 * Props for ProvenanceIndicator component
 */
export interface ProvenanceIndicatorProps {
  field: string;
  provenance?: MetadataProvenanceType | null;
  size?: number;
}
