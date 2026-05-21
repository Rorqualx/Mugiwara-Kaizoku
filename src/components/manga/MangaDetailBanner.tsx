/**
 * Manga Detail Banner Component
 *
 * Re-export of the decomposed MangaDetailBanner component.
 *
 * This file maintains backward compatibility for existing imports.
 * The actual implementation is now split into focused sub-components
 * in the manga-detail-banner subdirectory.
 *
 * Architecture:
 * - types.ts - Shared types and props
 * - MetadataBadges.tsx - Source, status, counts, conflicts
 * - AlternativeTitlesSection.tsx - Collapsible alternative titles
 * - DescriptionSection.tsx - Collapsible description with HTML parsing
 * - AdditionalMetadata.tsx - Genres, authors, file size
 * - index.tsx - Main aggregator component
 *
 * @module components/manga/MangaDetailBanner
 */

export {
  MangaDetailBanner,
  MetadataBadges,
  AlternativeTitlesSection,
  DescriptionSection,
  AdditionalMetadata
} from './manga-detail-banner';

export type { MangaDetailBannerProps } from './manga-detail-banner';
