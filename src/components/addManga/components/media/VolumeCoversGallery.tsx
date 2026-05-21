/**
 * Volume Covers Gallery Component
 * 
 * Displays a gallery of volume covers with selection capability
 */
import React from 'react';

import { 
  Image, 
  SimpleGrid, 
  Card, 
  Text, 
  Checkbox,
  ScrollArea,
  Stack,
  Badge,
  Group
} from '@mantine/core';

export interface VolumeData {
  volumeNumber?: number;
  number?: number;
  index?: number;
  title?: string;
  coverUrl?: string;
  coverImage?: string;
  cover?: string;
  chapterCount?: number;
  chapters?: unknown[];
  chapterRange?: string;
}

/**
 * Check if a title is a generic placeholder like "Volume 1"
 */
function isGenericTitle(title: string | undefined, volumeNum: number): boolean {
  if (!title) return true;
  const generic = [
    `Volume ${volumeNum}`,
    `Vol ${volumeNum}`,
    `Vol. ${volumeNum}`
  ];
  return generic.includes(title);
}

interface VolumeCoversGalleryProps {
  volumes: VolumeData[];
  selectedCovers: string[];
  onToggleCover: (url: string) => void;
  height?: number;
  columns?: number;
}

export function VolumeCoversGallery({
  volumes,
  selectedCovers,
  onToggleCover,
  height = 400,
  columns = 4
}: VolumeCoversGalleryProps): React.ReactElement {
  const volumesWithCovers = volumes.filter(v => !!(v.coverUrl ?? v.coverImage ?? v.cover));
  
  if (volumesWithCovers.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No volume covers available
      </Text>
    );
  }
  
  return (
    <ScrollArea h={height}>
      <SimpleGrid cols={columns} spacing="md">
        {volumesWithCovers.map((volume, index) => {
          const coverUrl = volume.coverUrl ?? volume.coverImage ?? volume.cover ?? '';
          const isSelected = selectedCovers.includes(coverUrl);
          const volumeNum = volume.volumeNumber ?? volume.number ?? volume.index ?? index + 1;
          
          return (
            <Card 
              key={index}
              p="xs"
              withBorder
              style={{ 
                borderColor: isSelected ? '#228BE6' : undefined,
                borderWidth: isSelected ? 2 : 1,
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => onToggleCover(coverUrl)}
                style={{ 
                  position: 'absolute', 
                  top: 8, 
                  right: 8, 
                  zIndex: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: 4,
                  padding: 2
                }}
              />
              <Image
                src={coverUrl}
                alt={volume["title"] ?? `Volume ${volumeNum}`}
                height={200}
                fit="cover"
                radius="sm"
              />
              <Stack gap="xs" mt="xs">
                <Group justify="space-between" align="center">
                  <Text size="sm" fw={500} lineClamp={1}>
                    {isGenericTitle(volume["title"], volumeNum)
                      ? `Volume ${volumeNum}`
                      : volume["title"]}
                  </Text>
                  {volume.chapterCount && (
                    <Badge size="xs" variant="light">
                      {volume.chapterCount} chapters
                    </Badge>
                  )}
                </Group>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </ScrollArea>
  );
}