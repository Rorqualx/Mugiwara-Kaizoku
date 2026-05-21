/**
 * Metadata Panel Types
 */

import type { MetadataProvenance, MangaWithRelations, MangaMetadata } from '@/types/search.types';

/**
 * Props for the MetadataPanel component
 */
export interface MetadataPanelProps {
  /**
   * Manga object with title and optional metadata
   */
  manga: MangaWithRelations | {
    /** Title of the manga - required as it's the primary identifier */
    title: string;
    /** Optional metadata object containing additional manga information */
    metadata?: MangaMetadata;
    /** Optional provenance information tracking which provider supplied each field */
    metadataProvenance?: MetadataProvenance;
  };

  /**
   * Whether metadata is currently being loaded
   *
   * @default false
   */
  isLoading?: boolean;

  /**
   * Handler for refreshing metadata
   */
  onRefresh: () => void;
}

/**
 * Metadata field display props
 */
export interface MetadataFieldProps {
  metadata?: MangaMetadata | undefined;
  provenance?: MetadataProvenance | undefined;
}
