/**
 * SourceSelection Component
 *
 * Controls for selecting the data source for volume and chapter display.
 * Allows switching between primary provider and other available metadata sources.
 *
 * Enhanced with field-level source selection for:
 * - Cover images
 * - Title/Summary text
 * - Chapter data
 *
 * @module components/addManga/steps/wizard/volumes-chapters/components/SourceSelection
 */

import React from 'react';

import { Paper, Group, Select, Stack, Text, Divider, Badge, Tooltip, Grid } from '@mantine/core';
import { IconPhoto, IconFileText, IconTags } from '@tabler/icons-react';

import { getSourceOptions } from '../utils';

import type { Logger } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Field-level source preferences for volume data
 */
export interface VolumeFieldSources {
  /** Source for volume cover images */
  volumeCover: string;
  /** Source for volume summary/description */
  volumeSummary: string;
  /** Source for volume title */
  volumeTitle: string;
  /** Source for chapter cover images */
  chapterCover: string;
  /** Source for chapter summary/description */
  chapterSummary: string;
  /** Source for chapter title */
  chapterTitle: string;
}

/**
 * Props for the SourceSelection component
 */
export interface SourceSelectionProps {
  /** Currently selected volume display source */
  volumeDisplaySource: string;
  /** Setter for volume display source */
  setVolumeDisplaySource: (source: string) => void;
  /** Currently selected chapter display source */
  chapterDisplaySource: string;
  /** Setter for chapter display source */
  setChapterDisplaySource: (source: string) => void;
  /** Primary provider name */
  provider: string;
  /** Available metadata sources */
  selectedSourcesMetadata: Record<string, unknown>;
  /** User-selected sources (only these should appear in dropdowns) */
  selectedSources: string[];
  /** Logger instance for debugging */
  logger: Logger;
  /** Field-level source preferences (optional) */
  volumeFieldSources?: VolumeFieldSources;
  /** Setter for field-level source preferences (optional) */
  setVolumeFieldSources?: (sources: VolumeFieldSources) => void;
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

// ============================================================================
// Component
// ============================================================================

/**
 * SourceSelection - Dropdown controls for selecting volume/chapter data sources
 *
 * Provides dropdowns for choosing which metadata source to use for:
 * - Cover images (ComicVine recommended for quality)
 * - Summary/Description text (Fandom recommended for detail)
 * - Chapter data
 *
 * Sources are dynamically generated based on available metadata.
 */
export const SourceSelection: React.FC<SourceSelectionProps> = React.memo(
  function SourceSelection({
    volumeDisplaySource,
    setVolumeDisplaySource,
    chapterDisplaySource,
    setChapterDisplaySource,
    provider,
    selectedSourcesMetadata,
    selectedSources,
    logger,
    volumeFieldSources,
    setVolumeFieldSources,
  }): JSX.Element {
    const sourceOptions = getSourceOptions(provider, selectedSourcesMetadata, selectedSources);
    const hasFieldLevelSelection = volumeFieldSources && setVolumeFieldSources;

    // Helper to get provider color for badge
    const getProviderColor = (src: string): string => {
      const providerLower = src.toLowerCase();
      return PROVIDER_COLORS[providerLower] ?? 'gray';
    };

    // Handle field-level source change
    // Each field (cover, summary, title) can be set independently to mix and match providers
    // Cover field syncs to main display source (data fetch)
    // Summary and Title are stored for field-level lookups in VolumeDetailsDrawer
    const handleFieldSourceChange = (field: keyof VolumeFieldSources, value: string | null): void => {
      if (!volumeFieldSources || !setVolumeFieldSources) return;

      const newValue = value ?? 'primary';

      // Update only the specific field that was changed
      const updatedSources = {
        ...volumeFieldSources,
        [field]: newValue,
      };
      setVolumeFieldSources(updatedSources);

      // Sync to main display source when Cover field changes
      // Cover is the primary visual element and drives what data gets loaded
      if (field === 'volumeCover' && newValue !== volumeDisplaySource) {
        setVolumeDisplaySource(newValue);
      }

      if (field === 'chapterCover' && newValue !== chapterDisplaySource) {
        setChapterDisplaySource(newValue);
      }

      logger.info('[SourceSelection] Field source update complete', {
        field,
        newValue,
        updatedSources,
      });
    };

    return (
      <Paper p="md" bg="gray.9" mb="md">
        <Stack gap="md">
          {/* Field-level source selection */}
          {hasFieldLevelSelection ? (
            <>
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>Data Source Selection</Text>
                <Tooltip label="Select which provider to use for each type of data" withArrow>
                  <Badge size="xs" variant="light" color="blue">Field-level selection</Badge>
                </Tooltip>
              </Group>

              {/* Volume Data Sources */}
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed" tt="uppercase">Volume Data</Text>
                <Grid gutter="sm">
                  <Grid.Col span={4}>
                    <Select
                      label={
                        <Group gap={4}>
                          <IconPhoto size={12} />
                          <Text size="xs">Cover</Text>
                        </Group>
                      }
                      value={volumeFieldSources.volumeCover}
                      onChange={(value) => handleFieldSourceChange('volumeCover', value)}
                      data={sourceOptions}
                      size="xs"
                      styles={{
                        input: { borderColor: `var(--mantine-color-${getProviderColor(volumeFieldSources.volumeCover)}-6)` }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Select
                      label={
                        <Group gap={4}>
                          <IconFileText size={12} />
                          <Text size="xs">Summary</Text>
                        </Group>
                      }
                      value={volumeFieldSources.volumeSummary}
                      onChange={(value) => handleFieldSourceChange('volumeSummary', value)}
                      data={sourceOptions}
                      size="xs"
                      styles={{
                        input: { borderColor: `var(--mantine-color-${getProviderColor(volumeFieldSources.volumeSummary)}-6)` }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Select
                      label={
                        <Group gap={4}>
                          <IconTags size={12} />
                          <Text size="xs">Title</Text>
                        </Group>
                      }
                      value={volumeFieldSources.volumeTitle}
                      onChange={(value) => handleFieldSourceChange('volumeTitle', value)}
                      data={sourceOptions}
                      size="xs"
                      styles={{
                        input: { borderColor: `var(--mantine-color-${getProviderColor(volumeFieldSources.volumeTitle)}-6)` }
                      }}
                    />
                  </Grid.Col>
                </Grid>
              </Stack>

              <Divider />

              {/* Chapter Data Sources */}
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed" tt="uppercase">Chapter Data</Text>
                <Grid gutter="sm">
                  <Grid.Col span={4}>
                    <Select
                      label={
                        <Group gap={4}>
                          <IconPhoto size={12} />
                          <Text size="xs">Cover</Text>
                        </Group>
                      }
                      value={volumeFieldSources.chapterCover}
                      onChange={(value) => handleFieldSourceChange('chapterCover', value)}
                      data={sourceOptions}
                      size="xs"
                      styles={{
                        input: { borderColor: `var(--mantine-color-${getProviderColor(volumeFieldSources.chapterCover)}-6)` }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Select
                      label={
                        <Group gap={4}>
                          <IconFileText size={12} />
                          <Text size="xs">Summary</Text>
                        </Group>
                      }
                      value={volumeFieldSources.chapterSummary}
                      onChange={(value) => handleFieldSourceChange('chapterSummary', value)}
                      data={sourceOptions}
                      size="xs"
                      styles={{
                        input: { borderColor: `var(--mantine-color-${getProviderColor(volumeFieldSources.chapterSummary)}-6)` }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Select
                      label={
                        <Group gap={4}>
                          <IconTags size={12} />
                          <Text size="xs">Title</Text>
                        </Group>
                      }
                      value={volumeFieldSources.chapterTitle}
                      onChange={(value) => handleFieldSourceChange('chapterTitle', value)}
                      data={sourceOptions}
                      size="xs"
                      styles={{
                        input: { borderColor: `var(--mantine-color-${getProviderColor(volumeFieldSources.chapterTitle)}-6)` }
                      }}
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </>
          ) : (
            /* Fallback to simple volume/chapter source selection */
            <Group>
              <Select
                label="Volume Source"
                value={volumeDisplaySource}
                onChange={(value) => {
                  logger.info('Volume source changed:', {
                    from: volumeDisplaySource,
                    to: value,
                    availableSources: Object.keys(selectedSourcesMetadata),
                    options: sourceOptions,
                  });
                  setVolumeDisplaySource(value ?? 'primary');
                }}
                data={sourceOptions}
                style={{ minWidth: 150 }}
                description="Select provider for volume data"
              />

              <Select
                label="Chapter Source"
                value={chapterDisplaySource}
                onChange={(value) => {
                  logger.info('Chapter source changed:', {
                    from: chapterDisplaySource,
                    to: value,
                    availableSources: Object.keys(selectedSourcesMetadata),
                  });
                  setChapterDisplaySource(value ?? 'primary');
                }}
                data={sourceOptions}
                style={{ minWidth: 150 }}
                description="Select provider for chapter data"
              />
            </Group>
          )}
        </Stack>
      </Paper>
    );
  }
);

export default SourceSelection;
