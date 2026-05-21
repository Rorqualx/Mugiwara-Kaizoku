/**
 * ReaderStateHandler Component
 *
 * Handles loading, error, and empty states for the reader.
 * Provides user-friendly feedback and recovery options.
 */

import React from 'react';

import { Box, Button, Group, LoadingOverlay, Text } from '@mantine/core';
import { useRouter } from 'next/router';

import { toNumberId } from '@/utils/id-converters';

interface ReaderStateHandlerProps {
  isLoading: boolean;
  error: Error | null;
  hasFile: boolean;
  backgroundColor: string;
  mangaId: string | string[] | undefined;
  chapterId: string | string[] | undefined;
  loadChapter: (mangaId: number, chapterId: number) => Promise<void>;
}

export function ReaderStateHandler({
  isLoading,
  error,
  hasFile,
  backgroundColor,
  mangaId,
  chapterId,
  loadChapter,
}: ReaderStateHandlerProps): React.JSX.Element | null {
  const router = useRouter();

  // Loading state
  if (isLoading) {
    return (
      <Box h="100vh" pos="relative" bg={backgroundColor}>
        <LoadingOverlay visible />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box h="100vh" bg={backgroundColor} p="md">
        <Box
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '1rem',
          }}
        >
          <Text c="red" size="lg">
            Error loading chapter
          </Text>
          <Text c="dimmed">{error instanceof Error ? error.message : String(error)}</Text>
          <Group>
            <Button onClick={() => router.back()}>Go Back</Button>
            <Button
              variant="light"
              onClick={() => {
                void loadChapter(toNumberId(mangaId), toNumberId(chapterId));
              }}
            >
              Retry
            </Button>
          </Group>
        </Box>
      </Box>
    );
  }

  // No file loaded
  if (!hasFile) {
    return (
      <Box h="100vh" bg={backgroundColor} p="md">
        <Text c="white" ta="center">
          No chapter loaded
        </Text>
      </Box>
    );
  }

  // No state to handle - proceed with normal render
  return null;
}
