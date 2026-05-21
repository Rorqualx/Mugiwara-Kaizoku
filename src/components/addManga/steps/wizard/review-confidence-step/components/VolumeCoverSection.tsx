/**
 * VolumeCoverSection Component
 *
 * Renders volume covers with metadata for the review step.
 */

import React from 'react';

import {
  Stack,
  Paper,
  Group,
  Text,
  Image,
  Badge,
  ScrollArea,
  Title,
} from '@mantine/core';

import { isRecord } from '@/lib/type-guards';
import { logger } from '@/utils/logger';
import { isString, isNumber } from '@/utils/validation/type-guards';

interface VolumeCoverSectionProps {
  displayVolumes: unknown[];
  volumeDisplaySource: string | undefined;
  provider: string;
}

export const VolumeCoverSection: React.FC<VolumeCoverSectionProps> = ({
  displayVolumes,
  volumeDisplaySource,
  provider,
}): JSX.Element | null => {
  // Determine the selected provider
  const selectedProvider = volumeDisplaySource === 'primary' || !volumeDisplaySource
    ? provider
    : volumeDisplaySource;

  logger.info('[VolumeCoverSection] Volume provider resolution:', {
    volumeDisplaySource,
    provider,
    selectedProvider
  });

  // Debug: Log volume structure
  const firstVolForDebug = displayVolumes[0];
  if (isRecord(firstVolForDebug)) {
    logger.info('[VolumeCoverSection] First volume data:', {
      allKeys: Object.keys(firstVolForDebug),
      volumeNumber: firstVolForDebug["volumeNumber"],
      title: firstVolForDebug["title"],
    });
  }

  // Filter volumes with covers
  const volumesWithCovers = displayVolumes.filter((v: unknown) => {
    if (!isRecord(v)) return false;
    return v["coverImageUrl"] ?? v["coverUrl"] ?? v["coverImage"];
  });

  if (volumesWithCovers.length === 0) return null;

  return (
    <Paper p="md" withBorder>
      <Stack gap="xs">
        <Group gap="xs">
          <Title order={4} size="h5">Volume Covers</Title>
          <Badge size="sm" variant="light">
            {selectedProvider}
          </Badge>
          <Badge size="sm" variant="dot" color="green">
            {volumesWithCovers.length} volumes
          </Badge>
        </Group>

        <ScrollArea h={300} type="hover">
          <Group gap="sm">
            {volumesWithCovers.map((volume: unknown, index: number) => {
              if (!isRecord(volume)) return null;

              const coverUrl = volume["coverImageUrl"] ?? volume["coverUrl"] ?? volume["coverImage"];
              const volumeNumberValue = volume["volumeNumber"] ?? volume["number"];
              const volumeNumber = isNumber(volumeNumberValue) ? volumeNumberValue : index + 1;

              const chapters = volume["chapters"];
              const chapterCountValue = volume["chapterCount"];
              const chapterCount = isNumber(chapterCountValue)
                ? chapterCountValue
                : (Array.isArray(chapters) ? chapters.length : 0);

              const volumeTitle = volume["title"] ?? volume["name"] ?? volume["volumeName"] ?? volume["volumeTitle"];
              const volumeTitleStr = isString(volumeTitle) ? volumeTitle : '';

              const description = volume["description"];
              const summary = volume["summary"];
              const descriptionText = isString(description) ? description : (isString(summary) ? summary : '');

              logger.debug('[VolumeCoverSection] Volume cover', {
                volumeNumber,
                coverUrl: isString(coverUrl) ? String(coverUrl).substring(0, 50) : 'invalid',
                fit: 'contain',
                width: 120,
                height: 180
              });

              return (
                <Stack key={`${selectedProvider}-${index}`} gap={4} align="center" style={{ maxWidth: 120 }}>
                  <Image
                    src={isString(coverUrl) ? coverUrl : ''}
                    alt={`Volume ${volumeNumber}`}
                    width={120}
                    height={180}
                    radius="sm"
                    fit="contain"
                    fallbackSrc="/cover-not-found.jpg"
                  />
                  <Text size="xs" fw={500} ta="center">Vol {String(volumeNumber)}</Text>

                  {volumeTitleStr.length > 0 && (
                    <Text size="xs" fw={500} ta="center" lineClamp={2} style={{ width: '100%' }}>
                      {volumeTitleStr}
                    </Text>
                  )}

                  {descriptionText.length > 0 && (
                    <Text size="xs" c="dimmed" ta="center" lineClamp={2} style={{ width: '100%' }}>
                      {descriptionText}
                    </Text>
                  )}

                  {isNumber(chapterCount) && chapterCount > 0 && (
                    <Badge size="xs" variant="light">
                      {String(chapterCount)} chapters
                    </Badge>
                  )}
                </Stack>
              );
            })}
          </Group>
        </ScrollArea>
      </Stack>
    </Paper>
  );
};

VolumeCoverSection.displayName = 'VolumeCoverSection';
