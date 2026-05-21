/**
 * Manga Detail States Component
 *
 * Handles loading, error, and no-data states for MangaDetailView.
 * Returns early-return UI states using the AsyncResult pattern.
 * Returns null when data is ready to render.
 *
 * Extracted from: MangaDetailView.tsx (lines 140-181)
 *
 * @module components/manga/MangaDetailStates
 */

import React from 'react';

import { Box, Title, Text, Button, LoadingOverlay } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

import type { MangaWithRelations } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { isLoading, isError, isSuccess } from '@/utils/async-result';

/**
 * Props for MangaDetailStates component
 */
export interface MangaDetailStatesProps {
  /** AsyncResult containing manga data with loading/error states */
  mangaResult: AsyncResult<MangaWithRelations, Error>;
  /** Optional callback to refresh metadata (shown in error state) */
  onRefreshMetadata?: (() => void) | undefined;
  /** Optional className for styling the container */
  className?: string | undefined;
}

/**
 * MangaDetailStates Component
 *
 * Displays loading overlay, error messages, or no-data state.
 * Returns null if data is successfully loaded.
 *
 * @param props - Component props
 * @returns React element for loading/error/no-data, or null if success
 */
export function MangaDetailStates({
  mangaResult,
  onRefreshMetadata,
  className = ''
}: MangaDetailStatesProps): React.ReactElement | null {
  // Handle loading state with AsyncResult pattern
  if (isLoading(mangaResult)) {
    return (
      <Box className={className} style={{ position: 'relative', minHeight: '500px' }}>
        <LoadingOverlay
          visible={true}
          // Type-safe prop definitions for LoadingOverlay
          overlayProps={{ backgroundOpacity: 0.6, blur: 2 }}
          loaderProps={{ color: 'blue', variant: 'dots', size: 'md' }}
        />
      </Box>
    );
  }

  // Handle error state with AsyncResult pattern
  if (isError(mangaResult)) {
    return (
      <Box className={className} p="md">
        <Title order={3} c="red" mb="md">
          Error Loading Manga Details
        </Title>
        <Text mb="md">
          {mangaResult.error instanceof Error
            ? mangaResult.error.message
            : String(mangaResult.error)}
        </Text>
        {onRefreshMetadata && (
          <Button onClick={onRefreshMetadata} leftSection={<IconRefresh size={18} />}>
            Try Again
          </Button>
        )}
      </Box>
    );
  }

  // If we're here, it means we have a success state
  if (!isSuccess(mangaResult)) {
    // This should never happen because we've already checked for loading and error states,
    // but TypeScript needs this guard for type safety
    return (
      <Box className={className} p="md">
        <Title order={3} c="gray" mb="md">
          No Manga Data Available
        </Title>
        <Text mb="md">Unable to display manga details.</Text>
      </Box>
    );
  }

  // Data loaded successfully - return null to let parent render content
  return null;
}
