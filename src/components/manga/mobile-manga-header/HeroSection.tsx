/**
 * HeroSection Component
 *
 * Displays the hero section with cover image, title, badges, and quick actions overlay.
 *
 * Extracted from: MobileMangaHeader.tsx
 */

import React, { useState } from 'react';

import {
  Box,
  Group,
  Stack,
  Text,
  Image,
  Badge,
  Paper,
  Collapse,
  ActionIcon,
  Overlay
} from '@mantine/core';
import {
  IconChevronDown,
  IconRefresh,
  IconEdit,
  IconTrash
} from '@tabler/icons-react';

import { mapToMangaStatus } from '@/utils/status-mapper';

import type { HeroSectionProps } from './types';

/**
 * Hero section with cover image, badges, and quick actions
 */
export function HeroSection({
  manga,
  coverUrl,
  showActions,
  setShowActions,
  onEdit,
  onRefresh,
  onRemove,
  isUpdating
}: HeroSectionProps): React.ReactElement {
  const [imageError, setImageError] = useState(false);

  const metadata = manga.Metadata;

  const getStatusColor = (): string => {
    return mapToMangaStatus(manga.fileStatus);
  };

  const getStatusText = (): string => {
    return mapToMangaStatus(manga.fileStatus);
  };

  return (
    <Box pos="relative">
      {/* Background Image with Overlay */}
      <Box
        h={250}
        pos="relative"
        style={{
          backgroundImage: imageError ? undefined : `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)'
        }}
      >
        <Overlay
          gradient="linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)"
          radius="0 0 lg lg"
        />

        {/* Cover and Basic Info */}
        <Group
          align="flex-end"
          gap="md"
          p="md"
          pos="absolute"
          bottom={0}
          left={0}
          right={0}
        >
          <Image
            src={coverUrl}
            alt={manga.title}
            width={100}
            height={150}
            radius="md"
            onError={() => setImageError(true)}
            style={{
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          />

          <Stack gap="xs" style={{ flex: 1, color: 'white' }}>
            <Text size="xl" fw={700} lineClamp={2}>
              {manga.title}
            </Text>

            <Group gap="xs">
              <Badge color={getStatusColor()}>
                {getStatusText()}
              </Badge>
              <Badge variant="dot">
                {manga.source}
              </Badge>
              {metadata?.status && (
                <Badge variant="light">
                  {metadata.status}
                </Badge>
              )}
            </Group>
          </Stack>
        </Group>
      </Box>

      {/* Quick Actions Overlay */}
      <Collapse in={showActions}>
        <Paper
          p="sm"
          pos="absolute"
          top="md"
          right="md"
          shadow="md"
          radius="md"
          style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Group gap="xs">
            <ActionIcon
              size="lg"
              variant="light"
              color="blue"
              onClick={onEdit}
            >
              <IconEdit size={20} />
            </ActionIcon>
            <ActionIcon
              size="lg"
              variant="light"
              color="green"
              onClick={onRefresh}
              loading={isUpdating}
            >
              <IconRefresh size={20} />
            </ActionIcon>
            <ActionIcon
              size="lg"
              variant="light"
              color="red"
              onClick={onRemove}
            >
              <IconTrash size={20} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() => setShowActions(false)}
            >
              <IconChevronDown size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      </Collapse>
    </Box>
  );
}
