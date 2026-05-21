/**
 * MediaGalleries Component
 *
 * Displays volume covers, chapter covers, and gallery images
 * for the manga confirmation step.
 */
import React from 'react';

import {
  Paper,
  Stack,
  Group,
  Title,
  Badge,
  ScrollArea,
  Image,
  Box,
  Text
} from '@mantine/core';

import type { VolumeData, ChapterData } from '@/types/api/manga-router-types';

// Extended volume data with all possible fields
interface ExtendedVolumeData extends Omit<VolumeData, 'number'> {
  number?: number;
  name?: string;
  volumeName?: string;
  coverUrl?: string;
  coverImage?: string;
  summary?: string;
  description?: string;
  chapterCount?: number;
}

// Extended chapter data with all possible fields
interface ExtendedChapterData extends ChapterData {
  coverUrl?: string;
  coverImageUrl?: string;
  description?: string;
  synopsis?: string;
  summary?: string;
  volumeNumber?: number;
}

interface MediaGalleriesProps {
  volumes?: ExtendedVolumeData[];
  galleryImages?: string[];
}

/**
 * VolumeCoversGallery - Displays volume covers with metadata
 */
function VolumeCoversGallery({ volumes }: { volumes: ExtendedVolumeData[] }): React.ReactElement | null {
  const volumeCovers = volumes.filter((v) => {
    return v['coverImageUrl'] ?? v['coverUrl'] ?? v['coverImage'];
  });

  if (volumeCovers.length === 0) return null;

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="xs">
        <Group gap="xs">
          <Title order={5} size="h6">Volume Covers</Title>
          <Badge size="sm" variant="light" color="blue">
            {volumeCovers.length} volumes
          </Badge>
        </Group>
        <ScrollArea h={300} type="hover">
          <Group gap="sm">
            {volumeCovers.map((vol, index) => {
              const coverUrl = vol['coverImageUrl'] ?? vol['coverUrl'] ?? vol['coverImage'] ?? '';
              const volumeNumber = Number(vol['volumeNumber'] ?? vol['number'] ?? index + 1);
              const volumeTitle = (vol['title'] ?? vol['name'] ?? vol['volumeName']) as string;
              const chapterCount = (vol['chapterCount'] ?? (Array.isArray(vol['chapters']) ? vol['chapters'].length : 0)) || 0;

              return (
                <Stack key={`vol-${index}`} gap={4} align="center" style={{ maxWidth: 120 }}>
                  <Image
                    src={coverUrl}
                    alt={`Volume ${volumeNumber}`}
                    width={120}
                    height={180}
                    radius="sm"
                    fit="cover"
                    fallbackSrc="/cover-not-found.jpg"
                  />
                  <Text>Volume {volumeNumber}</Text>
                  {volumeTitle && volumeTitle.length > 0 ? (
                    <Text size="xs" fw={500} ta="center" lineClamp={2}>
                      {volumeTitle}
                    </Text>
                  ) : null}
                  {typeof vol['summary'] === 'string' && vol['summary'] ? (
                    <Text size="xs" c="dimmed" ta="center" lineClamp={2}>
                      {vol['summary']}
                    </Text>
                  ) : null}
                  {chapterCount > 0 ? (
                    <Badge size="xs" variant="light">
                      {chapterCount} chapters
                    </Badge>
                  ) : null}
                </Stack>
              );
            })}
          </Group>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

/**
 * ChapterCoversGallery - Displays chapter covers with metadata
 */
function ChapterCoversGallery({ volumes }: { volumes: ExtendedVolumeData[] }): React.ReactElement | null {
  const allChapters: ExtendedChapterData[] = [];

  volumes.forEach((volume) => {
    if (volume['chapters'] && Array.isArray(volume['chapters'])) {
      volume['chapters'].forEach((chapter) => {
        const ch = chapter as ExtendedChapterData;
        if (ch.coverImageUrl ?? ch.coverUrl) {
          allChapters.push({
            ...chapter,
            volumeNumber: volume['volumeNumber'] ?? volume.number ?? undefined
          } as ExtendedChapterData);
        }
      });
    }
  });

  if (allChapters.length === 0) return null;

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="xs">
        <Group gap="xs">
          <Title order={5} size="h6">Chapter Covers</Title>
          <Badge size="sm" variant="light" color="cyan">
            {allChapters.length} chapters
          </Badge>
        </Group>
        <ScrollArea h={200} type="hover">
          <Group gap="md">
            {allChapters.slice(0, 20).map((chapter, index) => {
              const coverUrl = chapter.coverImageUrl ?? chapter.coverUrl ?? '';
              const chapterNumber = chapter.number ?? chapter.chapterNumber;
              const chapterTitle = chapter.title ?? `Chapter ${chapterNumber ?? ''}`;
              const chapterSummary = chapter.summary ?? chapter.description ?? chapter.synopsis;

              return (
                <Stack key={`ch-${index}`} gap={4} align="center" style={{ maxWidth: 90 }}>
                  <Box style={{ position: 'relative' }}>
                    <Image
                      src={coverUrl}
                      alt={chapterTitle}
                      width={90}
                      height={135}
                      radius="sm"
                      fit="cover"
                      fallbackSrc="/cover-not-found.jpg"
                    />
                    {chapter.volumeNumber ? (
                      <Badge
                        size="xs"
                        color="blue"
                        variant="filled"
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 4
                        }}
                      >
                        V{chapter.volumeNumber}
                      </Badge>
                    ) : null}
                  </Box>
                  <Text size="xs" fw={500} ta="center" lineClamp={1}>
                    {chapterTitle}
                  </Text>
                  {chapterSummary ? (
                    <Text size="xs" c="dimmed" ta="center" lineClamp={2}>
                      {chapterSummary}
                    </Text>
                  ) : null}
                </Stack>
              );
            })}
          </Group>
        </ScrollArea>
        {allChapters.length > 20 ? (
          <Text size="xs" c="dimmed" ta="center">
            And {allChapters.length - 20} more chapters...
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}

/**
 * GalleryImagesDisplay - Displays gallery/promotional images
 */
function GalleryImagesDisplay({ images }: { images: string[] }): React.ReactElement | null {
  if (!Array.isArray(images) || images.length === 0) return null;

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="xs">
        <Group gap="xs">
          <Title order={5} size="h6">Gallery Images</Title>
          <Badge size="sm" variant="light" color="teal">
            {images.length} images
          </Badge>
        </Group>
        <ScrollArea h={200} type="hover">
          <Group gap="md">
            {images.map((imageUrl: string, index: number) => (
              <Box key={`gallery-${index}`}>
                <Image
                  src={imageUrl}
                  alt={`Gallery image ${index + 1}`}
                  width={120}
                  height={160}
                  radius="sm"
                  fit="cover"
                  fallbackSrc="/cover-not-found.jpg"
                />
              </Box>
            ))}
          </Group>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

/**
 * MediaGalleries - Main component that renders all media galleries
 */
export function MediaGalleries({ volumes = [], galleryImages = [] }: MediaGalleriesProps): React.ReactElement {
  return (
    <>
      <VolumeCoversGallery volumes={volumes} />
      <ChapterCoversGallery volumes={volumes} />
      <GalleryImagesDisplay images={galleryImages} />
    </>
  );
}

export default MediaGalleries;
