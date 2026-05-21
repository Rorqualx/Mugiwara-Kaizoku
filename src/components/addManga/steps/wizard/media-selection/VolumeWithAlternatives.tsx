/**
 * Volume With Alternatives Component
 *
 * Displays a volume card with expandable alternative cover options from different providers.
 * Shows the primary cover with provider attribution and allows selecting alternatives.
 */

import React, { useState } from 'react';

import {
  Box,
  Paper,
  Image,
  Badge,
  Group,
  Text,
  Tooltip,
  ActionIcon,
  Collapse
} from '@mantine/core';
import { IconPhoto, IconChevronDown, IconChevronUp, IconCheck } from '@tabler/icons-react';

import { proxyImageUrl } from '@/utils/image-proxy';

import type { Logger } from './utils';

// ============================================================================
// Types
// ============================================================================

/** Volume cover from a specific provider */
export interface VolumeCover {
  volumeNumber: number;
  coverUrl: string;
  provider: string;
}

/** Grouped covers for a single volume number */
export interface VolumeCoversGroup {
  volumeNumber: number;
  covers: VolumeCover[];
  selectedProvider?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PROVIDER_COLORS: Record<string, string> = {
  wikipedia: 'gray',
  fandom: 'orange',
  comicvine: 'red',
  anilist: 'blue',
};

const PROVIDER_LABELS: Record<string, string> = {
  wikipedia: 'Wikipedia',
  fandom: 'Fandom',
  comicvine: 'ComicVine',
  anilist: 'AniList',
};

/** Priority for cover sources (higher = preferred) */
export const COVER_PRIORITY: Record<string, number> = {
  comicvine: 3,
  fandom: 2,
  wikipedia: 1,
  anilist: 0,
};

// ============================================================================
// Helper Components
// ============================================================================

/** Small provider badge for cover attribution */
export const ProviderBadge: React.FC<{ provider: string; size?: 'xs' | 'sm' }> = ({
  provider,
  size = 'xs'
}) => {
  const providerLower = provider.toLowerCase();
  const color = PROVIDER_COLORS[providerLower] ?? 'gray';
  const label = PROVIDER_LABELS[providerLower] ?? provider;

  return (
    <Badge size={size} color={color} variant="light">
      {label}
    </Badge>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface VolumeWithAlternativesProps {
  group: VolumeCoversGroup;
  isSelected: boolean;
  selectedCoverProvider: string | undefined;
  onToggleSelect: () => void;
  onSelectCover: (provider: string) => void;
  logger: Logger;
}

/** Volume card with alternative cover options */
export const VolumeWithAlternatives: React.FC<VolumeWithAlternativesProps> = ({
  group,
  isSelected,
  selectedCoverProvider,
  onToggleSelect,
  onSelectCover,
  logger
}) => {
  const [showAlternatives, setShowAlternatives] = useState(false);

  // Sort covers by priority
  const sortedCovers = [...group.covers].sort((a, b) => {
    const priorityA = COVER_PRIORITY[a.provider.toLowerCase()] ?? 0;
    const priorityB = COVER_PRIORITY[b.provider.toLowerCase()] ?? 0;
    return priorityB - priorityA;
  });

  // Get the selected cover (or first by priority)
  const selectedProvider = selectedCoverProvider ?? sortedCovers[0]?.provider;
  const selectedCover = sortedCovers.find(c => c.provider === selectedProvider) ?? sortedCovers[0];
  const hasAlternatives = sortedCovers.length > 1;

  if (!selectedCover) return null;

  return (
    <Box>
      <Paper
        p="xs"
        withBorder
        style={{
          cursor: 'pointer',
          opacity: isSelected ? 1 : 0.7,
          borderColor: isSelected ? 'var(--mantine-color-green-6)' : undefined,
          borderWidth: isSelected ? 2 : 1,
        }}
      >
        {/* Main cover image */}
        <Box
          style={{ position: 'relative' }}
          onClick={onToggleSelect}
        >
          <Image
            src={proxyImageUrl(selectedCover.coverUrl) ?? selectedCover.coverUrl}
            alt={`Volume ${group.volumeNumber}`}
            height={140}
            width="auto"
            radius="sm"
            fit="contain"
            fallbackSrc="/cover-not-found.jpg"
            style={{ maxWidth: '100%', objectFit: 'contain' }}
            onError={(): void => {
              logger.warn(`Failed to load cover for vol ${group.volumeNumber}: ${selectedCover.coverUrl}`);
            }}
          />
          {isSelected && (
            <Badge
              size="xs"
              color="green"
              variant="filled"
              style={{ position: 'absolute', top: 4, right: 4 }}
            >
              <IconCheck size={10} />
            </Badge>
          )}
        </Box>

        {/* Volume number and provider */}
        <Group justify="space-between" mt={4} wrap="nowrap">
          <Text size="xs" fw={500}>Vol {group.volumeNumber}</Text>
          <ProviderBadge provider={selectedCover.provider} />
        </Group>

        {/* Alternatives toggle */}
        {hasAlternatives && (
          <Tooltip label={`${sortedCovers.length - 1} alternative cover(s) available`} withArrow>
            <ActionIcon
              variant="subtle"
              size="xs"
              onClick={(e): void => {
                e.stopPropagation();
                setShowAlternatives(!showAlternatives);
              }}
              style={{ width: '100%', marginTop: 4 }}
            >
              <Group gap={2}>
                <IconPhoto size={12} />
                <Text size="xs">+{sortedCovers.length - 1}</Text>
                {showAlternatives ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
              </Group>
            </ActionIcon>
          </Tooltip>
        )}
      </Paper>

      {/* Alternative covers collapse */}
      <Collapse in={showAlternatives}>
        <Paper p="xs" mt={4} withBorder style={{ backgroundColor: 'var(--mantine-color-dark-7)' }}>
          <Text size="xs" c="dimmed" mb={4}>Select cover source:</Text>
          <Group gap={4}>
            {sortedCovers.map((cover) => (
              <Tooltip
                key={cover.provider}
                label={`Use cover from ${PROVIDER_LABELS[cover.provider.toLowerCase()] ?? cover.provider}`}
                withArrow
              >
                <Box
                  style={{
                    cursor: 'pointer',
                    border: cover.provider === selectedProvider
                      ? '2px solid var(--mantine-color-blue-6)'
                      : '1px solid var(--mantine-color-dark-4)',
                    borderRadius: 4,
                    padding: 2,
                  }}
                  onClick={(e): void => {
                    e.stopPropagation();
                    onSelectCover(cover.provider);
                  }}
                >
                  <Image
                    src={proxyImageUrl(cover.coverUrl) ?? cover.coverUrl}
                    alt={`Volume ${group.volumeNumber} - ${cover.provider}`}
                    height={60}
                    width={40}
                    fit="contain"
                    fallbackSrc="/cover-not-found.jpg"
                  />
                  <ProviderBadge provider={cover.provider} />
                </Box>
              </Tooltip>
            ))}
          </Group>
        </Paper>
      </Collapse>
    </Box>
  );
};

export default VolumeWithAlternatives;
