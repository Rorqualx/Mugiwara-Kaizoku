/**
 * MetadataSelectionStep Component - Main Aggregator
 *
 * This component aggregates all metadata selection sub-components into a unified
 * interface. It handles comprehensive metadata selection for manga import as
 * step 2 of the UniversalImportWizard.
 *
 * Architecture:
 * - types.ts - Type definitions and props interfaces
 * - utils.ts - Utility functions for value extraction and cleaning
 * - StatusFormatSection.tsx - Status & Format selection
 * - DescriptionsSection.tsx - Main description with edit mode
 * - GenresTagsThemesSection.tsx - Genres, Tags, Themes TagsInput
 * - CreatorsSection.tsx - Authors & Artists
 * - PublicationSection.tsx - Publisher, Demographic, Dates
 * - VolumesChaptersSection.tsx - Volume & Chapter counts
 * - AlternativeTitlesSection.tsx - Alternative titles
 * - ExternalIdsSection.tsx - External ID selections
 * - ExternalLinksSection.tsx - External links list
 *
 * Original file: 1,179 lines -> Refactored: ~230 lines (80% reduction)
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';

import { Stack, Title, Group, Badge, Tooltip, ScrollArea } from '@mantine/core';
import { IconSettings, IconCheck } from '@tabler/icons-react';

import { useFieldProviderPreferences } from '@/hooks/useFieldProviderPreferences';
import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { normalizeAllProviderMetadata } from '@/utils/metadata-normalizer';


// Import all section components
import { AlternativeTitlesSection } from './AlternativeTitlesSection';
import { CreatorsSection } from './CreatorsSection';
import { DescriptionsSection } from './DescriptionsSection';
import { ExternalIdsSection } from './ExternalIdsSection';
import { ExternalLinksSection } from './ExternalLinksSection';
import { GenresTagsThemesSection } from './GenresTagsThemesSection';
import { PublicationSection } from './PublicationSection';
import { StatusFormatSection } from './StatusFormatSection';
import { extractProviderUrl, extractUrlsFromMetadata } from './utils';
import { VolumesChaptersSection } from './VolumesChaptersSection';

import type { MetadataSelectionStepProps } from './types';

/**
 * MetadataSelectionStep Component
 *
 * Handles comprehensive metadata selection for manga import.
 * This is step 2 of the UniversalImportWizard.
 */
export const MetadataSelectionStep: React.FC<MetadataSelectionStepProps> = React.memo(({
  selectedMetadata,
  setSelectedMetadata,
  statusOptions,
  formatOptions,
  getFieldOptions,
  getExternalIdOptions,
  logger,
  descriptionEditMode,
  setDescriptionEditMode,
  selectedSourcesMetadata,
  selectedSources,
  externalIds,
  setExternalIds,
  externalLinks,
  setExternalLinks
}): JSX.Element => {
  // State for additional descriptions
  const [additionalDescriptions, setAdditionalDescriptions] = useState<string[]>([]);

  // Normalize metadata to ensure no undefined values in arrays
  const normalizedMetadata = useMemo(() => {
    return normalizeAllProviderMetadata(selectedSourcesMetadata as Record<string, ProviderMetadata>);
  }, [selectedSourcesMetadata]);

  // Debug log to see what metadata we have from all providers
  useEffect(() => {
    logger.info('[MetadataSelectionStep] Available metadata from providers:', {
      providers: Object.keys(normalizedMetadata),
      totalProviders: Object.keys(normalizedMetadata).length
    });

    // Log details for each provider
    Object.entries(normalizedMetadata).forEach(([provider, metadata]) => {
      const metaObj = metadata as Record<string, unknown>;
      logger.info(`[MetadataSelectionStep] ${provider} metadata:`, {
        hasAuthors: !!(Array.isArray(metaObj['authors']) && (metaObj['authors'] as unknown[]).length > 0),
        hasArtists: !!(Array.isArray(metaObj['artists']) && (metaObj['artists'] as unknown[]).length > 0),
        hasAlternativeTitles: !!(Array.isArray(metaObj['alternativeTitles']) && (metaObj['alternativeTitles'] as unknown[]).length > 0),
        hasGenres: !!(Array.isArray(metaObj['genres']) && (metaObj['genres'] as unknown[]).length > 0),
        hasTags: !!(Array.isArray(metaObj['tags']) && (metaObj['tags'] as unknown[]).length > 0),
        hasThemes: !!(Array.isArray(metaObj['themes']) && (metaObj['themes'] as unknown[]).length > 0),
        publisher: metaObj['publisher'],
        startDate: metaObj['startDate'],
        endDate: metaObj['endDate'],
        volumes: metaObj['volumes'],
        chapters: metaObj['chapters']
      });
    });
  }, [normalizedMetadata, logger]);

  // Get provider preferences information
  const { enabled: preferencesEnabled } = useFieldProviderPreferences();

  // Handlers for additional descriptions
  const handleAddDescription = useCallback((): void => {
    setAdditionalDescriptions(prev => [...prev, '']);
  }, []);

  const handleUpdateAdditionalDescription = useCallback((index: number, value: string): void => {
    setAdditionalDescriptions(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const handleRemoveAdditionalDescription = useCallback((index: number): void => {
    setAdditionalDescriptions(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Initialize external links from selected sources metadata only
  // Only include links from providers that are in selectedSources array
  useEffect(() => {
    const hasValidLinks = externalLinks.some(link => link && link.trim().length > 0);
    if (hasValidLinks) return;

    const linksSet = new Set<string>();

    // Normalize selected sources for comparison
    const normalizedSelectedSources = selectedSources.map(s => s.toLowerCase());

    Object.entries(normalizedMetadata).forEach(([provider, metadata]) => {
      // Only include links from selected sources
      const normalizedProvider = provider.toLowerCase();
      if (!normalizedSelectedSources.includes(normalizedProvider)) {
        return;
      }

      if (typeof metadata !== 'object') return;

      const metaObj = metadata as Record<string, unknown>;

      // Get the canonical URL for the provider (e.g., the Fandom wiki URL)
      const providerUrl = extractProviderUrl(provider, metaObj);
      if (providerUrl) {
        linksSet.add(providerUrl);
      }

      // Also extract additional URLs from metadata fields and externalLinks array
      // This picks up external links like MAL URLs that are stored in externalLinks[]
      const commonUrls = extractUrlsFromMetadata(metaObj);
      commonUrls.forEach(url => {
        // Add URLs, but avoid duplicates and filter by provider domain when needed
        // MAL URLs from Fandom are allowed since they're cross-provider links
        linksSet.add(url);
      });
    });

    const uniqueLinks = Array.from(linksSet);
    if (uniqueLinks.length > 0) {
      logger.info('[MetadataSelectionStep] Pre-populating external links from selected sources:', {
        selectedSources: normalizedSelectedSources,
        links: uniqueLinks
      });
      setExternalLinks(uniqueLinks);
    }
  }, [normalizedMetadata, selectedSources, externalLinks, setExternalLinks, logger]);

  return (
    <ScrollArea h={600} offsetScrollbars>
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={4}>Comprehensive Metadata</Title>
          {preferencesEnabled && (
            <Tooltip label="Field provider preferences are active - fields will auto-select from preferred providers">
              <Group gap="xs">
                <IconSettings size={16} color="var(--mantine-color-blue-6)" />
                <Badge variant="light" color="blue" leftSection={<IconCheck size={12} />}>
                  Preferences Active
                </Badge>
              </Group>
            </Tooltip>
          )}
        </Group>

        <StatusFormatSection
          selectedMetadata={selectedMetadata}
          setSelectedMetadata={setSelectedMetadata}
          getFieldOptions={getFieldOptions}
          statusOptions={statusOptions}
          formatOptions={formatOptions}
        />

        <DescriptionsSection
          selectedMetadata={selectedMetadata}
          setSelectedMetadata={setSelectedMetadata}
          getFieldOptions={getFieldOptions}
          descriptionEditMode={descriptionEditMode}
          setDescriptionEditMode={setDescriptionEditMode}
          additionalDescriptions={additionalDescriptions}
          handleAddDescription={handleAddDescription}
          handleUpdateAdditionalDescription={handleUpdateAdditionalDescription}
          handleRemoveAdditionalDescription={handleRemoveAdditionalDescription}
        />

        <GenresTagsThemesSection
          selectedMetadata={selectedMetadata}
          setSelectedMetadata={setSelectedMetadata}
          getFieldOptions={getFieldOptions}
        />

        <CreatorsSection
          selectedMetadata={selectedMetadata}
          setSelectedMetadata={setSelectedMetadata}
          getFieldOptions={getFieldOptions}
          logger={logger}
        />

        <PublicationSection
          selectedMetadata={selectedMetadata}
          setSelectedMetadata={setSelectedMetadata}
          getFieldOptions={getFieldOptions}
        />

        <VolumesChaptersSection
          selectedMetadata={selectedMetadata}
          setSelectedMetadata={setSelectedMetadata}
          getFieldOptions={getFieldOptions}
        />

        <AlternativeTitlesSection
          selectedMetadata={selectedMetadata}
          setSelectedMetadata={setSelectedMetadata}
          getFieldOptions={getFieldOptions}
          logger={logger}
        />

        <ExternalIdsSection
          externalIds={externalIds}
          setExternalIds={setExternalIds}
          getExternalIdOptions={getExternalIdOptions}
        />

        <ExternalLinksSection
          externalLinks={externalLinks}
          setExternalLinks={setExternalLinks}
        />
      </Stack>
    </ScrollArea>
  );
});

MetadataSelectionStep.displayName = 'MetadataSelectionStep';

// Re-export types for backward compatibility
export type { MetadataSelectionStepProps } from './types';
