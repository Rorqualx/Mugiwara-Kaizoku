/**
 * Merged metadata for the manga detail page.
 *
 * @module hooks/manga/useMangaMetadataExtraction
 */

import React from 'react';

import type { MangaWithRelations } from '@/types/search.types';

import { extractMergedMetadata } from './metadata-extraction';

/**
 * Hook for extracting and merging metadata from provider metadata and Metadata relation.
 *
 * When Metadata.source === 'merged', Metadata model is the primary source of truth.
 * Otherwise, providerMetadata JSON takes priority and Metadata fills gaps.
 */
export function useMangaMetadataExtraction(manga: MangaWithRelations | null): unknown {
  return React.useMemo(() => {
    if (!manga) return null;
    return extractMergedMetadata(manga);
  }, [manga]);
}
