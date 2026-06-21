/**
 * Manga Loading States Component
 *
 * Displays loading spinner and error states for the manga detail page.
 * Handles loading timeout, not found, and general error scenarios.
 *
 * @module components/manga/MangaLoadingStates
 */

import React from 'react';

import { Center, Loader, Stack, Text, Button } from '@mantine/core';
import { useRouter } from 'next/router';

import type { MangaWithRelations } from '@/types/search.types';

interface MangaLoadingStatesProps {
  /** Whether data is currently being loaded */
  isLoading: boolean;
  /** Whether loading has timed out */
  loadingTimeout: boolean;
  /** The manga data (null if not loaded) */
  manga: MangaWithRelations | null;
}

/**
 * Displays loading spinner while data is being fetched
 */
function LoadingSpinner(): React.ReactElement {
  return (
    <Center style={{ height: 'calc(100vh - 88px)', paddingTop: 20 }}>
      <Loader size="xl" />
    </Center>
  );
}

/**
 * Displays error state when loading times out or manga is not found
 */
function ErrorState({
  loadingTimeout,
  manga: _manga
}: {
  loadingTimeout: boolean;
  manga: MangaWithRelations | null;
}): React.ReactElement {
  const router = useRouter();

  const title = loadingTimeout ? 'Loading timed out' : 'Manga not found';
  const message = loadingTimeout
    ? 'The manga is taking too long to load. It may not exist yet.'
    : 'This manga does not exist or has been removed.';

  const handleGoBack = (): void => {
    // Go to the library index, not /library/:id — a shared/linked title's
    // libraryId is the original owner's library, which the current user may not
    // own (which itself surfaces a "Library not found").
    void router.push('/library');
  };

  return (
    <Center style={{ height: 'calc(100vh - 88px)', paddingTop: 20 }}>
      <Stack align="center" gap="md">
        <Text size="xl" fw={500} c="dimmed">
          {title}
        </Text>
        <Text size="sm" c="dimmed">
          {message}
        </Text>
        <Button onClick={handleGoBack}>
          Go Back to Library
        </Button>
      </Stack>
    </Center>
  );
}

/**
 * MangaLoadingStates Component
 *
 * Manages the display of loading, timeout, and not found states.
 * Returns null if data is loaded successfully.
 */
export function MangaLoadingStates({
  isLoading,
  loadingTimeout,
  manga
}: MangaLoadingStatesProps): React.ReactElement | null {
  // Show loading spinner while loading (but not if timeout occurred)
  if (isLoading && !loadingTimeout) {
    return <LoadingSpinner />;
  }

  // Show error state if loading timed out or manga not found
  if (loadingTimeout || (!isLoading && !manga)) {
    return <ErrorState loadingTimeout={loadingTimeout} manga={manga} />;
  }

  // TypeScript guard: manga must be non-null at this point
  // Return loading spinner if somehow manga is still null
  if (!manga) {
    return <LoadingSpinner />;
  }

  // Data loaded successfully - return null to let parent render content
  return null;
}
