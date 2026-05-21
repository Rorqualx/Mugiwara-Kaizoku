/**
 * AniList Provider Types Module
 *
 * Shared type definitions and imports for AniList provider modules.
 * Extracted from: AniListProvider.ts
 */


import { SortCriteria, SortOrder } from '@prisma/client';
import { MetadataProvider } from '@prisma/client';

import type { SearchOptions } from '@/types/search-types/configuration.types';
import type { SearchResult } from '@/types/search-types/core-search.types';
import type { AniListSearchResult } from '@/types/search-types/provider.types';


// ============================================================================
// Type Re-exports
// ============================================================================

// Re-export imported types for convenience
export type { SearchResult, SearchOptions, AniListSearchResult };
export { MetadataProvider, SortCriteria, SortOrder };

// ============================================================================
// Provider-Specific Types
// ============================================================================

// Add any provider-specific type definitions here
// Currently none, but structure is ready for future additions