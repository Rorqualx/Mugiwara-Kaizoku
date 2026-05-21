/**
 * Sub-components for VolumeCoversPanel
 * Extracted to reduce file size and improve maintainability.
 */

import React from 'react';

import {
  Stack,
  Text,
  SimpleGrid,
  Badge,
  Group,
  Box,
  Paper,
  Checkbox,
  Image
} from '@mantine/core';

import { proxyImageUrl } from '@/utils/image-proxy';

import {
  isRecord,
  getStringProp,
  getNumberProp,
  type Logger
} from './utils';
import {
  VolumeWithAlternatives,
  ProviderBadge,
  COVER_PRIORITY,
  type VolumeCoversGroup
} from './VolumeWithAlternatives';

// ============================================================================
// Types
// ============================================================================

export interface ByVolumeViewProps {
  volumeGroups: VolumeCoversGroup[];
  selectedVolumes: (number | string)[];
  setSelectedVolumes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  selectedCoverProviders: Record<number, string>;
  handleToggleVolumeSelection: (volumeNumber: number) => void;
  handleSelectCoverProvider: (volumeNumber: number, provider: string) => void;
  logger: Logger;
}

export interface ByProviderViewProps {
  volumesByProvider: Map<string, unknown[]>;
  selectedVolumes: (number | string)[];
  setSelectedVolumes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  logger: Logger;
}

// ============================================================================
// Volume Placeholder Component
// ============================================================================

/** Volume placeholder for volumes without covers */
export const VolumePlaceholder = ({
  volumeNumber,
  isSelected,
  onClick
}: {
  volumeNumber: number;
  isSelected: boolean;
  onClick: () => void;
}): JSX.Element => (
  <Box
    style={{
      position: 'relative',
      cursor: 'pointer',
      opacity: isSelected ? 1 : 0.7
    }}
    onClick={onClick}
  >
    <Paper
      p="xs"
      withBorder
      style={{
        borderColor: isSelected ? 'var(--mantine-color-green-6)' : undefined,
        borderWidth: isSelected ? 2 : 1,
      }}
    >
      <Box
        style={{
          height: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--mantine-color-dark-6)',
          borderRadius: 'var(--mantine-radius-sm)'
        }}
      >
        <Text size="xs" c="dimmed">No cover</Text>
      </Box>
      {isSelected && (
        <Badge
          size="xs"
          color="green"
          variant="filled"
          style={{ position: 'absolute', top: 8, right: 8 }}
        >
          Selected
        </Badge>
      )}
      <Text size="xs" fw={500} ta="center" mt={4}>
        Vol {volumeNumber}
      </Text>
    </Paper>
  </Box>
);

// ============================================================================
// By-Volume View Component
// ============================================================================

/** By-volume view showing all volumes with cover alternatives */
export const ByVolumeView = ({
  volumeGroups,
  selectedVolumes,
  setSelectedVolumes,
  selectedCoverProviders,
  handleToggleVolumeSelection,
  handleSelectCoverProvider,
  logger
}: ByVolumeViewProps): JSX.Element => {
  const allSelected = volumeGroups.every(g =>
    selectedVolumes.some(id => String(id).endsWith(`-${g.volumeNumber}`))
  );

  const handleSelectAll = (checked: boolean): void => {
    if (checked) {
      const newSelections = volumeGroups.map(g => {
        const selectedProvider = selectedCoverProviders[g.volumeNumber];
        const effectiveProvider = selectedProvider ?? g.covers.sort((a, b) => {
          const priorityA = COVER_PRIORITY[a.provider.toLowerCase()] ?? 0;
          const priorityB = COVER_PRIORITY[b.provider.toLowerCase()] ?? 0;
          return priorityB - priorityA;
        })[0]?.provider;
        return `${effectiveProvider}-${g.volumeNumber}`;
      });
      setSelectedVolumes(newSelections as never[]);
    } else {
      setSelectedVolumes([]);
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Click a volume to select it. Click the photo icon to choose alternative covers.
        </Text>
        <Checkbox
          label="Select all"
          size="xs"
          checked={allSelected}
          onChange={(event): void => handleSelectAll(event.currentTarget.checked)}
        />
      </Group>

      <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }}>
        {volumeGroups.map(group => {
          const isSelected = selectedVolumes.some(id => String(id).endsWith(`-${group.volumeNumber}`));

          if (group.covers.length === 0) {
            return (
              <VolumePlaceholder
                key={group.volumeNumber}
                volumeNumber={group.volumeNumber}
                isSelected={isSelected}
                onClick={(): void => handleToggleVolumeSelection(group.volumeNumber)}
              />
            );
          }

          return (
            <VolumeWithAlternatives
              key={group.volumeNumber}
              group={group}
              isSelected={isSelected}
              selectedCoverProvider={selectedCoverProviders[group.volumeNumber]}
              onToggleSelect={(): void => handleToggleVolumeSelection(group.volumeNumber)}
              onSelectCover={(p): void => handleSelectCoverProvider(group.volumeNumber, p)}
              logger={logger}
            />
          );
        })}
      </SimpleGrid>
    </Stack>
  );
};

// ============================================================================
// Provider Section Component
// ============================================================================

/** Single provider section in by-provider view */
export const ProviderSection = ({
  providerName,
  volumes,
  selectedVolumes,
  setSelectedVolumes,
  logger
}: {
  providerName: string;
  volumes: unknown[];
  selectedVolumes: (number | string)[];
  setSelectedVolumes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  logger: Logger;
}): JSX.Element => {
  const allProviderVolumesSelected = volumes.every((v): v is Record<string, unknown> => {
    if (!isRecord(v)) return false;
    const volumeNum = v['volumeNumber'] ?? v['number'];
    const volumeId = `${providerName}-${volumeNum}`;
    return selectedVolumes.includes(volumeId as never);
  });

  const handleSelectAllProvider = (checked: boolean): void => {
    if (checked) {
      setSelectedVolumes(prev => {
        const newSet = new Set(prev);
        volumes.filter(isRecord).forEach((v: Record<string, unknown>) => {
          const volumeNum = v['volumeNumber'] ?? v['number'];
          if (volumeNum) {
            const volumeId = `${providerName}-${volumeNum}`;
            newSet.add(volumeId as never);
          }
        });
        return Array.from(newSet);
      });
    } else {
      setSelectedVolumes(prev => {
        const providerVolumeIds = new Set<string>();
        volumes.filter(isRecord).forEach((v: Record<string, unknown>) => {
          const volumeNum = v['volumeNumber'] ?? v['number'];
          if (volumeNum) {
            const volumeId = `${providerName}-${volumeNum}`;
            providerVolumeIds.add(volumeId);
          }
        });
        return prev.filter(id => !providerVolumeIds.has(String(id)));
      });
    }
  };

  return (
    <Paper p="sm" withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <ProviderBadge provider={providerName} size="sm" />
            <Badge size="xs" variant="outline" color="gray">
              {volumes.length} volumes
            </Badge>
          </Group>
          <Checkbox
            label="Select all"
            size="xs"
            checked={allProviderVolumesSelected}
            onChange={(event): void => handleSelectAllProvider(event.currentTarget.checked)}
          />
        </Group>

        <SimpleGrid cols={{ base: 4, sm: 6, md: 8 }}>
          {volumes.map((volume, index: number) => {
            if (!isRecord(volume)) return null;

            const coverImageUrl = getStringProp(volume, 'coverImageUrl');
            const coverUrl = getStringProp(volume, 'coverUrl');
            const coverImage = getStringProp(volume, 'coverImage');
            const volumeNumberProp = getNumberProp(volume, 'volumeNumber');
            const numberProp = getNumberProp(volume, 'number');

            const coverUrlFinal = coverImageUrl ?? coverUrl ?? coverImage ?? '';
            const volumeNumber = volumeNumberProp ?? numberProp ?? index + 1;
            const volumeId = `${providerName}-${volumeNumber}`;
            const isSelected = selectedVolumes.includes(volumeId as never);

            return (
              <Box
                key={`${providerName}-${index}`}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  opacity: isSelected ? 1 : 0.7
                }}
                onClick={(): void => {
                  setSelectedVolumes(prev => {
                    const isCurrentlySelected = prev.includes(volumeId as never);
                    if (isCurrentlySelected) {
                      return prev.filter(id => String(id) !== volumeId);
                    } else {
                      return [...prev, volumeId as never];
                    }
                  });
                }}
              >
                {coverUrlFinal ? (
                  <Image
                    src={proxyImageUrl(coverUrlFinal) ?? coverUrlFinal}
                    alt={`Volume ${volumeNumber}`}
                    height={120}
                    width="auto"
                    radius="sm"
                    fit="contain"
                    fallbackSrc="/cover-not-found.jpg"
                    style={{ maxWidth: '100%', objectFit: 'contain' }}
                    onError={(_e: React.SyntheticEvent<HTMLImageElement>): void => {
                      logger.warn(`Failed to load volume cover for ${providerName} vol ${volumeNumber}: ${coverUrlFinal}`);
                    }}
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
                    style={{ position: 'absolute', top: 4, right: 4 }}
                  >
                    Selected
                  </Badge>
                )}
                <Text size="xs" ta="center" mt={2}>
                  Vol {volumeNumber}
                </Text>
              </Box>
            );
          })}
        </SimpleGrid>
      </Stack>
    </Paper>
  );
};

// ============================================================================
// By-Provider View Component
// ============================================================================

/** By-provider view grouping covers by their source provider */
export const ByProviderView = ({
  volumesByProvider,
  selectedVolumes,
  setSelectedVolumes,
  logger
}: ByProviderViewProps): JSX.Element => (
  <>
    {Array.from(volumesByProvider.entries()).map(([providerName, volumes]) => (
      <ProviderSection
        key={providerName}
        providerName={providerName}
        volumes={volumes}
        selectedVolumes={selectedVolumes}
        setSelectedVolumes={setSelectedVolumes}
        logger={logger}
      />
    ))}
  </>
);
