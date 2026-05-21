/**
 * Chapter Covers Panel Component
 *
 * Displays chapter covers in a selectable grid with
 * Select All/Deselect All functionality.
 *
 * Extracted from: MediaSelectionStep.tsx (lines 791-968)
 */

import React from 'react';

import {
  Stack,
  Text,
  SimpleGrid,
  Badge,
  Group,
  Box,
  ScrollArea,
  Button,
  Image
} from '@mantine/core';

import { proxyImageUrl } from '@/utils/image-proxy';

import {
  isRecord,
  getStringProp,
  getNumberProp,
  type Logger
} from './utils';

// ============================================================================
// Types
// ============================================================================

interface ChapterCoversPanelProps {
  allChapterUrls: unknown[];
  selectedChapters: unknown[];
  setSelectedChapters: React.Dispatch<React.SetStateAction<unknown[]>>;
  logger: Logger;
}

// ============================================================================
// Component
// ============================================================================

export const ChapterCoversPanel = ({
  allChapterUrls,
  selectedChapters,
  setSelectedChapters,
  logger
}: ChapterCoversPanelProps): JSX.Element => {
  // Debug logging
  logger.info('[ChapterCoversPanel] Render:', {
    selectedChaptersLength: selectedChapters.length,
    allChapterUrlsLength: allChapterUrls.length
  });

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSelectAll = (): void => {
    const allChapterIds = allChapterUrls
      .filter(isRecord)
      .map((ch) => ch['url'] ?? ch) as (string | number)[];
    setSelectedChapters(allChapterIds);
  };

  const handleDeselectAll = (): void => {
    setSelectedChapters([]);
  };

  const handleToggleChapter = (chapterId: unknown): void => {
    setSelectedChapters(prev => {
      const isCurrentlySelected = prev.includes(chapterId);
      if (isCurrentlySelected) {
        return prev.filter(c => c !== chapterId);
      } else {
        return [...prev, chapterId];
      }
    });
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (allChapterUrls.length === 0) {
    return (
      <Text c="dimmed">
        No chapters available. Go back to Volumes &amp; Chapters step to select chapters.
      </Text>
    );
  }

  return (
    <Stack>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Text size="sm" fw={500}>Selected Chapters</Text>
          <Badge size="xs" variant="light">
            {selectedChapters.length} selected
          </Badge>
        </Group>

        <Group gap="xs">
          {selectedChapters.length < allChapterUrls.length && (
            <Button size="xs" variant="light" onClick={handleSelectAll}>
              Select All
            </Button>
          )}
          {selectedChapters.length > 0 && (
            <Button size="xs" variant="subtle" color="red" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          )}
        </Group>
      </Group>

      <Text size="xs" c="dimmed" mb="sm">
        Click to toggle chapter selection
      </Text>

      <ScrollArea h={400}>
        <SimpleGrid cols={{ base: 4, sm: 6, md: 8 }}>
          {allChapterUrls
            .filter((chapter): chapter is Record<string, unknown> => isRecord(chapter))
            .map((chapter, index: number) => {
              const urlProp = getStringProp(chapter, 'url');
              const chapterId = urlProp ?? chapter;
              const isSelected = selectedChapters.includes(chapterId);

              // Extract cover URL from various possible properties
              const coverImageUrlProp = getStringProp(chapter, 'coverImageUrl');
              const coverUrlProp = getStringProp(chapter, 'coverUrl');
              const coverImageProp = getStringProp(chapter, 'coverImage');
              const imageProp = getStringProp(chapter, 'image');
              const thumbnailProp = getStringProp(chapter, 'thumbnail');

              const coverUrl = coverImageUrlProp ?? coverUrlProp ?? coverImageProp ?? imageProp ?? thumbnailProp;

              const numberProp = getNumberProp(chapter, 'number');
              const chapterNumberProp = getNumberProp(chapter, 'chapterNumber');
              // Use index as fallback (0-indexed) for manga with prologue/chapter 0
              const chapterNumber = numberProp ?? chapterNumberProp ?? index;

              // Debug first 3 chapters
              if (index < 3) {
                logger.info(`[ChapterCoversPanel] Chapter ${index}:`, {
                  chapterId,
                  chapterNumber,
                  coverUrl,
                  isSelected,
                  hasCoverImageUrl: !!coverImageUrlProp,
                  hasCoverUrl: !!coverUrlProp,
                  hasCoverImage: !!coverImageProp,
                  hasImage: !!imageProp,
                  hasThumbnail: !!thumbnailProp,
                  chapterKeys: Object.keys(chapter).slice(0, 15)
                });
              }

              return (
                <Box
                  key={index}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    opacity: isSelected ? 1 : 0.7
                  }}
                  onClick={() => handleToggleChapter(chapterId)}
                >
                  {coverUrl ? (
                    <Image
                      src={proxyImageUrl(coverUrl) ?? coverUrl}
                      alt={`Chapter ${chapterNumber}`}
                      height={120}
                      width="auto"
                      radius="sm"
                      fit="contain"
                      fallbackSrc="/cover-not-found.jpg"
                      style={{ maxWidth: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <Box
                      style={{
                        height: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--mantine-color-dark-6)',
                        borderRadius: 'var(--mantine-radius-sm)'
                      }}
                    >
                      <Text size="xs" c="dimmed">No cover</Text>
                    </Box>
                  )}
                  {isSelected && (
                    <Badge
                      size="xs"
                      color="green"
                      variant="filled"
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4
                      }}
                    >
                      {'\u2713'}
                    </Badge>
                  )}
                  <Text size="xs" ta="center" mt={2}>
                    Ch {chapterNumber}
                  </Text>
                </Box>
              );
            })}
        </SimpleGrid>
      </ScrollArea>
    </Stack>
  );
};

export default ChapterCoversPanel;
