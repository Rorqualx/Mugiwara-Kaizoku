/**
 * MetadataDisplaySection Component
 *
 * Displays the selected metadata values including title, status, format,
 * authors, genres, publisher, dates, and external IDs.
 */

import React from 'react';

import {
  Paper,
  Stack,
  Title,
  Group,
  Text,
  Badge,
  ScrollArea,
} from '@mantine/core';

import { formatDateForDisplay } from '@/components/addManga/utils/wizard/dataTransformers';
import { isStringArray } from '@/lib/type-guards';
import { isString } from '@/utils/validation/type-guards';

import type { ExternalIds } from '../types';

interface MetadataDisplaySectionProps {
  mergedMetadata: Record<string, unknown>;
  externalIds: ExternalIds;
  metadataVersion: number;
}

export const MetadataDisplaySection: React.FC<MetadataDisplaySectionProps> = React.memo(({
  mergedMetadata,
  externalIds,
  metadataVersion,
}) => {
  return (
    <Paper p="md" h="100%" key={`metadata-${metadataVersion}`}>
      <Title order={5} mb="md">Selected Metadata</Title>
      <ScrollArea h={300}>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>Title</Text>
            <Text size="sm">
              {(() => {
                const titleValue = mergedMetadata["title"];
                return isString(titleValue) ? titleValue : 'Not set';
              })()}
            </Text>
          </Group>

          {(() => {
            const altTitles = mergedMetadata["alternativeTitles"];
            return isStringArray(altTitles) && altTitles.length > 0 && (
              <Group justify="space-between" align="flex-start">
                <Text size="sm" fw={500}>Alt Titles</Text>
                <Stack gap={2} align="flex-end">
                  {altTitles.map((title, i) => (
                    <Text key={i} size="xs">{title}</Text>
                  ))}
                </Stack>
              </Group>
            );
          })()}

          <Group justify="space-between">
            <Text size="sm" fw={500}>Status</Text>
            <Badge size="sm" variant="light">
              {isString(mergedMetadata["status"]) ? mergedMetadata["status"] : 'Unknown'}
            </Badge>
          </Group>

          <Group justify="space-between">
            <Text size="sm" fw={500}>Format</Text>
            <Badge size="sm" variant="light">
              {isString(mergedMetadata["format"]) ? mergedMetadata["format"] : 'manga'}
            </Badge>
          </Group>

          {(() => {
            const authors = mergedMetadata["authors"];
            return isStringArray(authors) && authors.length > 0 && (
              <Group justify="space-between" align="flex-start">
                <Text size="sm" fw={500}>Authors</Text>
                <Group gap="xs">
                  {authors.map((author, i) => (
                    <Badge key={i} size="xs">{author}</Badge>
                  ))}
                </Group>
              </Group>
            );
          })()}

          {(() => {
            const genres = mergedMetadata["genres"];
            return isStringArray(genres) && genres.length > 0 && (
              <Group justify="space-between" align="flex-start">
                <Text size="sm" fw={500}>Genres</Text>
                <Group gap="xs">
                  {genres.slice(0, 5).map((genre, i) => (
                    <Badge key={i} size="xs" variant="dot">{genre}</Badge>
                  ))}
                  {genres.length > 5 && (
                    <Badge size="xs" variant="outline">
                      +{genres.length - 5}
                    </Badge>
                  )}
                </Group>
              </Group>
            );
          })()}

          {(() => {
            const publisher = mergedMetadata["publisher"];
            return isString(publisher) && (
              <Group justify="space-between">
                <Text size="sm" fw={500}>Publisher</Text>
                <Text size="sm">{publisher}</Text>
              </Group>
            );
          })()}

          {(() => {
            const startDate = mergedMetadata["startDate"];
            const endDate = mergedMetadata["endDate"];
            const hasStartDate = startDate !== undefined && startDate !== null;
            const hasEndDate = endDate !== undefined && endDate !== null;

            return (hasStartDate || hasEndDate) && (
              <Group justify="space-between">
                <Text size="sm" fw={500}>Dates</Text>
                <Text size="xs">
                  {formatDateForDisplay(startDate) || '?'} - {formatDateForDisplay(endDate) || 'ongoing'}
                </Text>
              </Group>
            );
          })()}

          {externalIds.anilistId && (
            <Group justify="space-between">
              <Text size="sm" fw={500}>AniList ID</Text>
              <Badge size="sm" variant="outline">{externalIds.anilistId}</Badge>
            </Group>
          )}

          {externalIds.malId && (
            <Group justify="space-between">
              <Text size="sm" fw={500}>MAL ID</Text>
              <Badge size="sm" variant="outline">{externalIds.malId}</Badge>
            </Group>
          )}
        </Stack>
      </ScrollArea>
    </Paper>
  );
});

MetadataDisplaySection.displayName = 'MetadataDisplaySection';
