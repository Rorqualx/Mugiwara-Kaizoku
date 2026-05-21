/**
 * Volume Covers Panel - displays volume covers with multi-select capability.
 * Groups covers by volume/provider with selection badges.
 */

import React, { useState, useMemo } from 'react';

import {
  Stack,
  Text,
  Badge,
  Group,
  ScrollArea,
  Paper,
  SegmentedControl
} from '@mantine/core';

import {
  isRecord,
  getStringProp,
  getNumberProp,
  type Logger
} from './utils';
import { ByVolumeView, ByProviderView } from './VolumeCoversViewComponents';
import {
  COVER_PRIORITY,
  type VolumeCover,
  type VolumeCoversGroup
} from './VolumeWithAlternatives';

// ============================================================================
// Types
// ============================================================================

/** View mode for the panel */
type ViewMode = 'by-provider' | 'by-volume';

interface VolumeCoversPanelProps {
  displayVolumes: unknown[];
  selectedVolumes: (number | string)[];
  setSelectedVolumes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  provider: string;
  volumeDisplaySource: string;
  volumeCoversByProvider: Record<string, string[]>;
  logger: Logger;
  /** Enable merged cover view with provider options per volume */
  showMergedView?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export const VolumeCoversPanel = ({
  displayVolumes,
  selectedVolumes,
  setSelectedVolumes,
  provider,
  volumeDisplaySource,
  volumeCoversByProvider,
  logger,
  showMergedView = false
}: VolumeCoversPanelProps): JSX.Element => {
  const [viewMode, setViewMode] = useState<ViewMode>(showMergedView ? 'by-volume' : 'by-provider');
  const [selectedCoverProviders, setSelectedCoverProviders] = useState<Record<number, string>>({});

  // Collect all covers from all sources
  const allCovers = useMemo((): VolumeCover[] => {
    const covers: VolumeCover[] = [];

    // Add from displayVolumes
    displayVolumes.forEach((v) => {
      if (!isRecord(v)) return;
      const coverUrl = getStringProp(v, 'coverImageUrl') ?? getStringProp(v, 'coverUrl') ?? getStringProp(v, 'coverImage');
      const volumeNumber = getNumberProp(v, 'volumeNumber') ?? getNumberProp(v, 'number');
      if (coverUrl && volumeNumber) {
        covers.push({
          volumeNumber,
          coverUrl,
          provider: volumeDisplaySource || provider,
        });
      }
    });

    // Add from volumeCoversByProvider
    Object.entries(volumeCoversByProvider).forEach(([providerName, providerCovers]) => {
      providerCovers.forEach((coverUrl, index) => {
        // Check if we already have this volume from displayVolumes
        const volumeNumber = index + 1;
        const existingCover = covers.find(c => c.volumeNumber === volumeNumber && c.provider === providerName);
        if (!existingCover && coverUrl) {
          covers.push({
            volumeNumber,
            coverUrl,
            provider: providerName,
          });
        }
      });
    });

    return covers;
  }, [displayVolumes, volumeCoversByProvider, volumeDisplaySource, provider]);

  // Group covers by volume number (include volumes without covers)
  const volumeGroups = useMemo((): VolumeCoversGroup[] => {
    const groupMap = new Map<number, VolumeCoversGroup>();

    // First add all volumes from displayVolumes (even without covers)
    displayVolumes.forEach((v, index) => {
      if (!isRecord(v)) return;
      const volumeNumber = getNumberProp(v, 'volumeNumber') ?? getNumberProp(v, 'number') ?? index + 1;
      if (!groupMap.has(volumeNumber)) {
        groupMap.set(volumeNumber, {
          volumeNumber,
          covers: [],
        });
      }
    });

    // Then add all covers
    allCovers.forEach(cover => {
      const existing = groupMap.get(cover.volumeNumber);
      if (existing) {
        existing.covers.push(cover);
      } else {
        groupMap.set(cover.volumeNumber, {
          volumeNumber: cover.volumeNumber,
          covers: [cover],
        });
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => a.volumeNumber - b.volumeNumber);
  }, [allCovers, displayVolumes]);

  // Group by provider for the provider view
  const volumesByProvider = useMemo(() => {
    const map = new Map<string, unknown[]>();

    // Add ALL volumes from the current display source (including those without covers)
    if (displayVolumes.length > 0) {
      const validVolumes = displayVolumes.filter((v): v is Record<string, unknown> => isRecord(v));
      if (validVolumes.length > 0) {
        map.set(volumeDisplaySource || provider, validVolumes);
      }
    }

    // Add volumes from ALL providers in volumeCoversByProvider
    Object.entries(volumeCoversByProvider).forEach(([providerName, covers]) => {
      if (covers.length > 0) {
        // Skip if we already have detailed volume data for this provider from displayVolumes
        if (providerName === (volumeDisplaySource || provider) && displayVolumes.length > 0) {
          return; // Already added above with more detail
        }

        const volumes = covers.map((coverUrl: string, index: number) => ({
          volumeNumber: index + 1,
          coverImageUrl: coverUrl,
          provider: providerName
        }));
        map.set(providerName, volumes);
      }
    });

    return map;
  }, [displayVolumes, volumeCoversByProvider, volumeDisplaySource, provider]);

  // Handle selecting a cover provider for a volume
  const handleSelectCoverProvider = (volumeNumber: number, providerName: string): void => {
    setSelectedCoverProviders(prev => ({
      ...prev,
      [volumeNumber]: providerName,
    }));
  };

  // Handle toggling volume selection in merged view
  const handleToggleVolumeSelection = (volumeNumber: number): void => {
    const selectedProvider = selectedCoverProviders[volumeNumber];
    const group = volumeGroups.find(g => g.volumeNumber === volumeNumber);
    if (!group) return;

    // Use the selected provider or the highest priority one
    const effectiveProvider = selectedProvider ?? group.covers.sort((a, b) => {
      const priorityA = COVER_PRIORITY[a.provider.toLowerCase()] ?? 0;
      const priorityB = COVER_PRIORITY[b.provider.toLowerCase()] ?? 0;
      return priorityB - priorityA;
    })[0]?.provider;

    const volumeId = `${effectiveProvider}-${volumeNumber}`;

    setSelectedVolumes(prev => {
      const isCurrentlySelected = prev.some(id => String(id).endsWith(`-${volumeNumber}`));
      if (isCurrentlySelected) {
        // Remove any selection for this volume number
        return prev.filter(id => !String(id).endsWith(`-${volumeNumber}`));
      } else {
        return [...prev, volumeId as never];
      }
    });
  };

  if (volumesByProvider.size === 0 && volumeGroups.length === 0) {
    return <Text c="dimmed">No volume covers available</Text>;
  }

  // Summary stats
  const totalVolumes = volumeGroups.length;
  const volumesWithMultipleCovers = volumeGroups.filter(g => g.covers.length > 1).length;
  const uniqueProviders = new Set(allCovers.map(c => c.provider)).size;

  return (
    <ScrollArea h={500}>
      <Stack gap="md">
        {/* View mode toggle and stats */}
        {uniqueProviders > 1 && (
          <Paper p="sm" withBorder>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs">
                <Text size="sm" fw={500}>
                  {totalVolumes} volumes from {uniqueProviders} providers
                </Text>
                {volumesWithMultipleCovers > 0 && (
                  <Badge size="xs" color="blue" variant="light">
                    {volumesWithMultipleCovers} with alternatives
                  </Badge>
                )}
              </Group>
              <SegmentedControl
                size="xs"
                value={viewMode}
                onChange={(v): void => setViewMode(v as ViewMode)}
                data={[
                  { label: 'By Provider', value: 'by-provider' },
                  { label: 'By Volume', value: 'by-volume' },
                ]}
              />
            </Group>
          </Paper>
        )}

        {/* Merged view (by volume) */}
        {viewMode === 'by-volume' && (
          <ByVolumeView
            volumeGroups={volumeGroups}
            selectedVolumes={selectedVolumes}
            setSelectedVolumes={setSelectedVolumes}
            selectedCoverProviders={selectedCoverProviders}
            handleToggleVolumeSelection={handleToggleVolumeSelection}
            handleSelectCoverProvider={handleSelectCoverProvider}
            logger={logger}
          />
        )}

        {/* Provider view (original) */}
        {viewMode === 'by-provider' && (
          <ByProviderView
            volumesByProvider={volumesByProvider}
            selectedVolumes={selectedVolumes}
            setSelectedVolumes={setSelectedVolumes}
            logger={logger}
          />
        )}
      </Stack>
    </ScrollArea>
  );
};

export default VolumeCoversPanel;
