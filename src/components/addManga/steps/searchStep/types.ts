/**
 * SearchStep Type Definitions
 *
 * Shared type definitions used across all searchStep modules.
 *
 * Extracted from: searchStep.tsx (lines 21-26, 80-94, 296-305)
 */


import type { FormType } from '@/components/addManga/form';
import type { ExtendedMangaSearchResult } from '@/types/search.types';

import type { SupportedUrlProvider } from './helpers';
import type { UseFormReturnType } from '@mantine/form';

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Represents a metadata provider configuration
 * Used to display available search providers in the UI
 */
export interface MetadataProvider {
    /** Unique identifier for the provider (e.g., 'anilist', 'myanimelist') */
    id: string;
    /** Display name for the provider */
    name: string;
    /** Provider status (e.g., 'active', 'disabled') */
    status: string;
}

// ============================================================================
// Search Query Types
// ============================================================================

/**
 * Represents a parsed search query with extracted metadata
 * Used to determine search type and provider routing
 */
export interface ParsedSearchQuery {
    /** The original search text */
    searchText: string;
    /** Extracted text portion of the query */
    text?: string;
    /** Type of search query detected */
    type?: 'url' | 'identifier' | 'text' | 'id' | 'isbn' | 'filtered';
    /** Extracted identifiers from the query */
    identifiers?: {
        anilistId?: number;
        malId?: number;
        comicvineId?: string;
        isbn?: string;
        kitsuId?: string;
    };
    /** Suggested providers based on query analysis */
    suggestedProviders?: string[];
    /** Explicitly specified provider in the query */
    provider?: string;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for the SearchStep component
 *
 * @interface SearchStepProps
 * @property {UseFormReturnType<FormType>} form - Form state from Mantine useForm hook
 * @property {Function} onSelect - Callback when a manga is selected
 * @property {Function} onQuickAdd - Optional callback for quick-add flow
 * @property {number} selectedLibraryId - Selected library ID
 */
export interface SearchStepProps {
    /** Form state from Mantine useForm hook */
    form: UseFormReturnType<FormType>;
    /** Callback when a manga is selected - now also passes all search results */
    onSelect?: (manga: ExtendedMangaSearchResult, allResults?: Record<string, unknown[]>) => void;
    /** Optional callback for quick-add flow - now also passes all search results */
    onQuickAdd?: (manga: ExtendedMangaSearchResult, allResults?: Record<string, ExtendedMangaSearchResult[]>) => void;
    /** Selected library ID */
    selectedLibraryId: number;
    /** Optional callback when a URL is detected instead of a search query */
    onUrlDetected?: (url: string, provider: SupportedUrlProvider) => void | Promise<void>;
}
