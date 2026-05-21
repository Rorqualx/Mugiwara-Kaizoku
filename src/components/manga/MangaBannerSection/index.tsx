/**
 * MangaBannerSection - Main Component
 *
 * Displays the banner/cover section of the manga detail page including:
 * - Cover image with selector
 * - Metadata provider box with provider bindings
 * - Title, author, artist, publisher information
 * - Stats (volumes, chapters, popularity, score)
 * - Expandable details (descriptions, genres, tags, gallery, etc.)
 *
 * Architecture:
 * - types.ts - Shared types and props
 * - CoverSection.tsx - Cover image and provider box (~308 lines)
 * - HeaderSection.tsx - Title and actions (~196 lines)
 * - StatsSection.tsx - Stats and badges (~257 lines)
 * - ContentSection.tsx - Description, genres, tags (~116 lines)
 * - ExpandedDetailsSection.tsx - All expanded details (~396 lines)
 *
 * Original: 1054 lines -> Refactored: ~190 lines aggregator
 *
 * @module components/manga/MangaBannerSection
 */

import React from 'react';

import { Box, Grid } from '@mantine/core';

import { getCoverUrl } from '@/utils/cover-url';
import { proxyImageUrl } from '@/utils/image-proxy';

// Import sub-components
import { ContentSection } from './ContentSection';
import { CoverSection } from './CoverSection';
import { ExpandedDetailsSection } from './ExpandedDetailsSection';
import { HeaderSection } from './HeaderSection';
import { StatsSection } from './StatsSection';

// Import types and re-export
import type { MangaBannerSectionProps, MangaWithRelations } from './types';
export type { MangaBannerSectionProps };
export { CoverSection, HeaderSection, StatsSection, ContentSection, ExpandedDetailsSection };

/**
 * Gets the appropriate banner image based on provider selection
 *
 * Priority:
 * 1. User-selected banner from import profile mediaSelections
 * 2. Metadata bannerImage only if primary source is AniList
 * 3. undefined (falls through to cover image fallback)
 *
 * @param manga - The manga entity with relations
 * @returns The banner image URL or undefined
 */
function getBannerImage(manga: MangaWithRelations): string | undefined {
  // Priority 1: Check if user specifically selected a banner in import profile
  const providerMeta = manga.providerMetadata as Record<string, unknown> | null;
  const importProfile = providerMeta?.['importProfile'] as {
    mediaSelections?: { banner?: string };
    primarySource?: string;
  } | undefined;

  if (importProfile?.mediaSelections?.banner) {
    return importProfile.mediaSelections.banner;
  }

  // Priority 2: Use bannerImage if the metadata was merged (user explicitly selected fields)
  // or if the primary source is AniList (which provides banner images)
  const primarySource = importProfile?.primarySource ?? manga.source;
  const isMerged = manga.Metadata?.source === 'merged';

  if (isMerged || primarySource.toLowerCase() === 'anilist') {
    return manga.Metadata?.bannerImage ?? undefined;
  }

  // Non-merged, non-AniList sources: don't use banner
  // Return undefined to fall through to cover image fallback
  return undefined;
}

/**
 * MangaBannerSection Component
 *
 * Main aggregator that combines all banner sub-components.
 */
export function MangaBannerSection({
  manga,
  extractedMetadata,
  mangaId,
  isProvidersExpanded,
  setIsProvidersExpanded,
  setIsCoverSelectorOpen,
  setIsAniListModalOpen,
  setIsComicVineModalOpen,
  setIsFandomModalOpen,
  setIsWikipediaModalOpen,
  setIsMangaDexModalOpen,
  setIsMangaUpdatesModalOpen,
  setIsMalModalOpen,
  setIsKitsuModalOpen,
  allMonitored,
  someMonitored,
  monitoredCount,
  totalChapters,
  isDetailsExpanded,
  setIsDetailsExpanded,
  toggleSeriesMonitoringMutation,
  seriesQuickDownloadMutation,
  handleToggleMangaBookmark,
  handleSeriesQuickDownload,
  isProviderBound
}: MangaBannerSectionProps): React.ReactElement {
  return (
    <Box
      pos="relative"
      h="auto"
      mb="xl"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9)), url(${
          // Wrap raw banner URLs through the image proxy so wikia/anilist
          // hotlink protection doesn't 403 the background image. getCoverUrl
          // already proxies; getBannerImage returns a raw URL that needs it.
          proxyImageUrl(getBannerImage(manga) ?? '') ?? getCoverUrl(manga.Metadata, manga.id)
        })`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        width: '100%',
        padding: '10px 0',
        marginTop: '0px',
        marginLeft: '0px'
      }}
    >
      <Grid gutter={0} style={{ height: '100%', alignItems: 'flex-start' }}>
        {/* Left column for cover image */}
        <Grid.Col
          span={{ base: 12, sm: 4, md: 3 }}
          style={{
            paddingTop: '10px',
            paddingRight: '0px',
            paddingBottom: '24px',
            paddingLeft: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            position: 'relative',
            zIndex: 2
          }}
        >
          <CoverSection
            manga={manga}
            setIsCoverSelectorOpen={setIsCoverSelectorOpen}
            isProvidersExpanded={isProvidersExpanded}
            setIsProvidersExpanded={setIsProvidersExpanded}
            setIsAniListModalOpen={setIsAniListModalOpen}
            setIsComicVineModalOpen={setIsComicVineModalOpen}
            setIsFandomModalOpen={setIsFandomModalOpen}
            setIsWikipediaModalOpen={setIsWikipediaModalOpen}
            setIsMangaDexModalOpen={setIsMangaDexModalOpen}
            setIsMangaUpdatesModalOpen={setIsMangaUpdatesModalOpen}
            setIsMalModalOpen={setIsMalModalOpen}
            setIsKitsuModalOpen={setIsKitsuModalOpen}
            mangaId={mangaId}
            isProviderBound={isProviderBound}
          />
        </Grid.Col>

        {/* Right column for manga info */}
        <Grid.Col
          span={{ base: 12, sm: 8, md: 9 }}
          style={{
            position: 'relative',
            zIndex: 3,
            paddingTop: '10px',
            paddingRight: '40px',
            paddingBottom: '40px',
            paddingLeft: '10px',
            marginLeft: '-60px'
          }}
        >
          <Box
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start'
            }}
          >
            <HeaderSection
              manga={manga}
              extractedMetadata={extractedMetadata}
              allMonitored={allMonitored}
              someMonitored={someMonitored}
              monitoredCount={monitoredCount}
              totalChapters={totalChapters}
              isDetailsExpanded={isDetailsExpanded}
              setIsDetailsExpanded={setIsDetailsExpanded}
              toggleSeriesMonitoringMutation={toggleSeriesMonitoringMutation}
              seriesQuickDownloadMutation={seriesQuickDownloadMutation}
              handleToggleMangaBookmark={handleToggleMangaBookmark}
              handleSeriesQuickDownload={handleSeriesQuickDownload}
            />

            <StatsSection
              manga={manga}
              extractedMetadata={extractedMetadata}
              isDetailsExpanded={isDetailsExpanded}
            />

            <ContentSection
              manga={manga}
              extractedMetadata={extractedMetadata}
              isDetailsExpanded={isDetailsExpanded}
            />

            {isDetailsExpanded && (
              <ExpandedDetailsSection
                manga={manga}
                extractedMetadata={extractedMetadata}
              />
            )}
          </Box>
        </Grid.Col>
      </Grid>
    </Box>
  );
}
