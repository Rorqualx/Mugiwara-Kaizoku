/**
 * Manga Detail View Component
 * 
 * This component displays detailed information about a manga series,
 * including metadata, volumes, chapters, and actions for management.
 * Includes provenance tracking to show which provider supplied each field.
 * 
 * TypeScript Migration:
 * - Updated to use domain types from ../types/domain
 * - Changed from custom MangaDetail interface to standardized MangaWithRelations
 * - Updated property access patterns (coverUrl instead of coverLarge)
 * - Used MangaStatus enum for status values
 * - Added AsyncResult pattern for state management
 */

import * as React from 'react';

import { Box, Text, Title, ScrollArea } from '@mantine/core';
import { MangaPublicationStatus as MangaStatus } from '@prisma/client';

import { VolumeGroupedChapters } from '@/components/volumeChapters';
import type { MangaWithRelations, ID } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { isSuccess } from '@/utils/async-result';
import { getMetadataString } from '@/utils/entityMetadataUtils';
import { toNumberId } from '@/utils/id-converters';


import { ConflictResolutionModal } from '../metadata/ConflictResolutionModal';

import { ContinueReadingBanner } from './ContinueReadingBanner';
import { MangaDetailBanner } from './MangaDetailBanner';
import { MangaDetailStates } from './MangaDetailStates';
import { calculateTotalSize } from './mangaDetailUtils';
import { useMangaDetailState } from './useMangaDetailState';

/**
 * Props for MangaDetailView component
 */
export interface MangaDetailViewProps {
  mangaResult: AsyncResult<MangaWithRelations, Error>;
  onToggleMonitoring?: (chapterId: ID, monitored: boolean) => void;
  onAutoSearch?: (chapterId: ID) => void;
  onManualSearch?: (chapterId: ID) => void;
  onRefreshMetadata?: () => void;
  className?: string;
}

/**
 * MangaDetailView component
 */
export function MangaDetailView({
  mangaResult,
  onToggleMonitoring,
  onAutoSearch,
  onManualSearch,
  onRefreshMetadata,
  className = ''
}: MangaDetailViewProps): React.ReactElement {
  // Extract mangaId before useMangaDetailState since the hook needs it for the
  // conflicts query. Returns undefined while mangaResult is loading/error;
  // the inner useQuery is gated on `enabled: mangaId > 0`.
  const earlyMangaId = isSuccess(mangaResult) ? toNumberId(mangaResult.data["id"]) : undefined;
  const state = useMangaDetailState(earlyMangaId, onRefreshMetadata);

  // Destructure state for easier access
  const {
    isDescriptionExpanded,
    setIsDescriptionExpanded,
    isSynonymsExpanded,
    setIsSynonymsExpanded,
    isConflictModalOpen,
    setIsConflictModalOpen,
    conflictsState,
    conflictsCount,
    handleConflictsResolved
  } = state;

  // Handle loading/error/no-data states - returns null if data is ready
  const stateComponent = MangaDetailStates({
    mangaResult,
    onRefreshMetadata,
    className
  });

  if (stateComponent !== null) {
    return stateComponent;
  }

  // Type guard: If we're here, we must have success state
  if (!isSuccess(mangaResult)) {
    return <></>;
  }

  // Now TypeScript knows mangaResult.data is safe to use
  const manga = mangaResult.data;

  // Get manga ID as number for API calls
  const mangaIdNum = toNumberId(manga["id"]);

  // Calculate total size of manga with proper type safety
  const totalSize = calculateTotalSize(manga);

  // Format status for display with nullish coalescing
  // This is better than || because it only falls back if the value is null or undefined, not falsy
  const formattedStatus = manga.Metadata?.status ?? MangaStatus.UNKNOWN;

  // Determine cover image URL with nullish coalescing and proper type safety
  const coverUrl = getMetadataString(manga, 'coverUrl', '/cover-not-found.jpg');

  return (
    <ScrollArea h="calc(100vh - 88px)" type="auto" scrollbarSize={0}>
      {/* Banner with manga title and cover */}
      <MangaDetailBanner
        manga={manga}
        mangaIdNum={mangaIdNum}
        coverUrl={coverUrl}
        formattedStatus={formattedStatus}
        totalSize={totalSize}
        conflictsState={conflictsState}
        conflictsCount={conflictsCount}
        isDescriptionExpanded={isDescriptionExpanded}
        setIsDescriptionExpanded={setIsDescriptionExpanded}
        isSynonymsExpanded={isSynonymsExpanded}
        setIsSynonymsExpanded={setIsSynonymsExpanded}
        setIsConflictModalOpen={setIsConflictModalOpen}
        handleConflictsResolved={handleConflictsResolved}
      />

      {/* Continue Reading Banner */}
      <Box px="xl">
        <ContinueReadingBanner mangaId={mangaIdNum} />
      </Box>

      {/* Reading Statistics Panel - Commented out for now to prevent errors */}
      {/* <Box px="xl">
        <ReadingStatsPanel mangaId={mangaIdNum} compact />
      </Box> */}

      {/* Chapters section */}
      <Box px="xl" pb="xl">
        <Title order={2} mb="lg">Chapters</Title>

        {manga['Chapter'].length ? (() => {
          // Map MangaWithRelations to MangaForVolumeGrouping interface
          const mangaForVolumes = {
            chapters: manga.Chapter,
            source: manga.source,
            title: manga.title,
            metadata: manga.Metadata,
            providerMetadata: manga.providerMetadata
          };

          return <VolumeGroupedChapters
          manga={mangaForVolumes}
          {...(onToggleMonitoring !== undefined && { onToggleMonitoring })}
          {...(onAutoSearch !== undefined && { onAutoSearch })}
          {...(onManualSearch !== undefined && { onManualSearch })} />;
        })() :
        <Text c="dimmed">No chapters available for this manga.</Text>
        }
      </Box>
      
      {/* Conflict resolution modal */}
      <ConflictResolutionModal
        opened={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        mangaId={mangaIdNum}
        onConflictsResolved={handleConflictsResolved} />

    </ScrollArea>);

}

export default MangaDetailView;