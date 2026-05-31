/**
 * MangaDetailBanner - Main Component
 *
 * Displays the hero banner section for MangaDetailView including:
 * - Background cover image with gradient overlay
 * - Cover image thumbnail
 * - Manga title and metadata badges
 * - Alternative titles (collapsible)
 * - Description (collapsible)
 * - Additional metadata fields (genres, authors, file size)
 *
 * Architecture:
 * - types.ts - Shared types and props
 * - MetadataBadges.tsx - Source, status, counts, conflicts (~170 lines)
 * - AlternativeTitlesSection.tsx - Collapsible alternative titles (~80 lines)
 * - DescriptionSection.tsx - Collapsible description with HTML parsing (~100 lines)
 * - AdditionalMetadata.tsx - Genres, authors, file size (~90 lines)
 *
 * Original: 475 lines -> Refactored: ~140 lines aggregator
 *
 * Extracted from: MangaDetailView.tsx (lines 173-471)
 *
 * @module components/manga/manga-detail-banner
 */

import * as React from 'react';

import { Box, Group, LoadingOverlay, Title } from '@mantine/core';

import { MangaCover } from '@/components/manga/MangaCover';
import { isLoading } from '@/utils/async-result';


import { AdditionalMetadata } from './AdditionalMetadata';
import { AlternativeTitlesSection } from './AlternativeTitlesSection';
import { DescriptionSection } from './DescriptionSection';
import { MetadataBadges } from './MetadataBadges';

import type { MangaDetailBannerProps } from './types';

// Re-export types and components
export type { MangaDetailBannerProps };
export { MetadataBadges, AlternativeTitlesSection, DescriptionSection, AdditionalMetadata };

/**
 * MangaDetailBanner Component
 *
 * Displays the hero banner with manga cover, title, and metadata.
 * Includes collapsible sections for alternative titles and description.
 *
 * @param props - Component props
 * @returns React element for the banner section
 */
export function MangaDetailBanner({
  manga,
  mangaIdNum,
  coverUrl,
  formattedStatus,
  totalSize,
  conflictsState,
  conflictsCount,
  isDescriptionExpanded,
  setIsDescriptionExpanded,
  isSynonymsExpanded,
  setIsSynonymsExpanded,
  setIsConflictModalOpen,
  handleConflictsResolved
}: MangaDetailBannerProps): React.ReactElement {
  return (
    <Box
      pos="relative"
      h="auto"
      mb="xl"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9)), url(${coverUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        width: '100%',
        padding: '20px 0'
      }}>
      {/* Loading overlay for conflicts state */}
      {isLoading(conflictsState) && (
        <LoadingOverlay
          visible={true}
          overlayProps={{ backgroundOpacity: 0.6, blur: 2 }}
          loaderProps={{ color: 'blue', variant: 'dots', size: 'md' }}
        />
      )}

      <Box px="xl">
        <Group align="flex-start" gap="xl">
          {/* Cover image */}
          <Box
            style={{
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              overflow: 'hidden',
              width: '280px',
              maxWidth: '100%'
            }}>
            <MangaCover
              src={coverUrl}
              alt={manga.title}
              seed={coverUrl}
              style={{ maxHeight: '400px' }}
            />
          </Box>

          {/* Manga details */}
          <Box style={{ flex: 1 }}>
            <Title order={1} c="white" mb="md">
              {manga.title}
            </Title>

            {/* Metadata badges */}
            <MetadataBadges
              manga={manga}
              mangaIdNum={mangaIdNum}
              formattedStatus={formattedStatus}
              conflictsState={conflictsState}
              conflictsCount={conflictsCount}
              setIsConflictModalOpen={setIsConflictModalOpen}
              handleConflictsResolved={handleConflictsResolved}
            />

            {/* Alternative titles */}
            <AlternativeTitlesSection
              manga={manga}
              isExpanded={isSynonymsExpanded}
              setIsExpanded={setIsSynonymsExpanded}
            />

            {/* Description */}
            <DescriptionSection
              manga={manga}
              isExpanded={isDescriptionExpanded}
              setIsExpanded={setIsDescriptionExpanded}
            />

            {/* Additional metadata */}
            <AdditionalMetadata manga={manga} totalSize={totalSize} />
          </Box>
        </Group>
      </Box>
    </Box>
  );
}
