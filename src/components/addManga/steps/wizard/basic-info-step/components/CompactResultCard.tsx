/**
 * CompactResultCard Component
 *
 * Individual search result card with cover, metadata, and selection button.
 * Shows result details and allows selection of a specific result.
 *
 * @module components/addManga/steps/wizard/basic-info-step/components
 */

import React from 'react';

import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  Image,
  Tooltip,
  Box
} from '@mantine/core';
import { IconCheck, IconBooks } from '@tabler/icons-react';

import { isRecord } from '@/lib/type-guards';

import { getStringProp, getNumberProp } from '../utils';

/**
 * Props for CompactResultCard component
 */
export interface CompactResultCardProps {
  /** Search result data */
  result: unknown;
  /** Provider name */
  provider: string;
  /** Whether this result is selected */
  isSelected: boolean;
  /** Whether selection is loading */
  isLoading: boolean;
  /** Selection handler */
  onSelect: () => void;
  /** Card index for key generation */
  index: number;
  /** Whether this result is already in the current library */
  inCurrentLibrary?: boolean | undefined;
  /** Whether this result is in another library */
  inOtherLibrary?: boolean | undefined;
  /** Name of the library where this result exists (for other library) */
  libraryName?: string | undefined;
  /** ID of the existing manga entry */
  existingMangaId?: number | undefined;
}

/**
 * CompactResultCard Component
 *
 * Displays a search result with cover image, title, type, year, and description.
 * Provides selection button or shows selected badge.
 */
// eslint-disable-next-line complexity -- UI component with conditional rendering for cover image, library badges, selection state
export const CompactResultCard: React.FC<CompactResultCardProps> = ({
  result,
  provider,
  isSelected,
  isLoading,
  onSelect,
  index,
  inCurrentLibrary,
  inOtherLibrary,
  libraryName
}): React.ReactElement | null => {
  if (!isRecord(result)) return null;

  // Try multiple field names for cover image (providers use different field names)
  const coverImage = getStringProp(result, 'coverImage') ?? getStringProp(result, 'cover') ?? getStringProp(result, 'coverUrl');
  const title = getStringProp(result, 'title') ?? 'Unknown';
  const type = getStringProp(result, 'type');
  const year = getNumberProp(result, 'year');
  const deck = getStringProp(result, 'deck');
  const description = getStringProp(result, 'description');
  const isComicVine = provider.toLowerCase() === 'comicvine';
  const hasDescription = isComicVine && (deck ?? description);

  return (
    <Card
      key={`${provider}-${index}`}
      padding="xs"
      radius="sm"
      withBorder
      style={{
        borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
        borderWidth: isSelected ? 2 : 1,
        backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
        position: 'relative'
      }}
    >
      {/* Library status badges - positioned at top right */}
      {inCurrentLibrary && (
        <Box
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 1
          }}
        >
          <Badge
            color="green"
            size="xs"
            variant="filled"
            leftSection={<IconBooks size={10} />}
          >
            In Library
          </Badge>
        </Box>
      )}
      {inOtherLibrary && !inCurrentLibrary && (
        <Box
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 1
          }}
        >
          <Tooltip
            label={`Already in: ${libraryName ?? 'another library'}`}
            position="left"
            withArrow
          >
            <Badge
              color="yellow"
              size="xs"
              variant="filled"
              leftSection={<IconBooks size={10} />}
            >
              Other Library
            </Badge>
          </Tooltip>
        </Box>
      )}

      <Group gap="xs" wrap="nowrap" align="flex-start">
        <Image
          src={coverImage ?? '/cover-not-found.jpg'}
          alt={title}
          w={hasDescription ? 40 : 32}
          h={hasDescription ? 60 : 48}
          radius="xs"
          fallbackSrc="/cover-not-found.jpg"
        />
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={500} size="sm" lineClamp={1}>{title}</Text>
          <Group gap={4}>
            {type && <Badge size="xs" variant="light">{type}</Badge>}
            {year && <Badge size="xs" variant="light" color="gray">{year}</Badge>}
          </Group>
          {/* Show deck/description for ComicVine results */}
          {hasDescription && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {deck ?? description}
            </Text>
          )}
        </Stack>
        {isSelected ? (
          <Badge color="green" variant="filled" size="sm" leftSection={<IconCheck size={12} />}>
            Selected
          </Badge>
        ) : (
          <Button
            size="xs"
            variant="light"
            onClick={onSelect}
            loading={isLoading}
          >
            Use This
          </Button>
        )}
      </Group>
    </Card>
  );
};

export default CompactResultCard;
