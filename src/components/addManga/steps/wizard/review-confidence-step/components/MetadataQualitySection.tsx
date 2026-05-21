/**
 * MetadataQualitySection Component
 *
 * Displays metadata quality indicators showing which fields are set
 * and their source providers.
 */

import React, { useMemo } from 'react';

import {
  Paper,
  Stack,
  Title,
  Group,
  Text,
  Badge,
} from '@mantine/core';

import { MetadataProvenanceSummary } from '@/components/manga/MetadataProvenance/MetadataProvenanceSummary';
import type { EnhancedProviderData } from '@/components/manga/MetadataProvenance/types';

interface MetadataQualitySectionProps {
  mergedMetadata: Record<string, unknown>;
  selectedCover: string | undefined;
  selectedBanner: string | undefined;
  selectedVolumes: (number | string)[];
  selectedChapters: unknown[] | undefined;
  getFieldSource: (fieldName: string, fieldValue: unknown) => string | 'none';
  provider: string;
  metadataVersion: number;
  calculateFieldConfidence?: ((field: string, value: unknown, sourceProvider?: string, currentProvider?: string) => number) | undefined;
  getConfidenceColor?: ((score: number) => string) | undefined;
  selectedSourcesMetadata?: Record<string, unknown> | undefined;
}

export const MetadataQualitySection: React.FC<MetadataQualitySectionProps> = React.memo(({
  mergedMetadata,
  selectedCover,
  selectedBanner,
  selectedVolumes,
  selectedChapters,
  getFieldSource,
  provider,
  metadataVersion,
  calculateFieldConfidence,
  getConfidenceColor,
  selectedSourcesMetadata,
}) => {
  // Helper function to get confidence score for a field
  const getFieldConfidence = (field: string, value: unknown, sourceProvider?: string): number | undefined => {
    if (!calculateFieldConfidence) return undefined;
    const confidence = calculateFieldConfidence(field, value, sourceProvider);
    // Convert from 0-1 to 0-100 percentage
    return Math.round(confidence * 100);
  };

  // Helper function to get confidence color
  const getFieldConfidenceColor = (confidence: number | undefined): string => {
    if (!confidence || !getConfidenceColor) return 'gray';
    return getConfidenceColor(confidence);
  };

  // Helper function to get confidence label
  const getConfidenceLabel = (confidence: number | undefined): string => {
    if (!confidence) return 'N/A';
    if (confidence >= 80) return 'Excellent';
    if (confidence >= 60) return 'Good';
    if (confidence >= 40) return 'Fair';
    return 'Poor';
  };

  // Calculate field provenance from selected sources metadata
  const fieldProvenance = useMemo((): Record<string, EnhancedProviderData> => {
    if (!selectedSourcesMetadata || !calculateFieldConfidence) {
      return {};
    }

    const provenance: Record<string, EnhancedProviderData> = {};
    const providerPriority = ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'];
    const fields = [
      'title', 'description', 'cover', 'status', 'format', 'genres', 'tags',
      'authors', 'artists', 'startDate', 'endDate', 'chapters', 'volumes',
      'alternativeTitles', 'anilistId', 'myAnimeListId'
    ];

    fields.forEach((field) => {
      // Find the best value for this field from all sources
      let bestProvider = '';
      let bestConfidence: number = 0;
      const alternatives: Array<{
        provider: string;
        value: unknown;
        confidence: number;
        quality?: number;
      }> = [];

      providerPriority.forEach((provider) => {
        const providerData = selectedSourcesMetadata[provider];
        if (!providerData || typeof providerData !== 'object') return;

        const value = (providerData as Record<string, unknown>)[field];
        const rawConfidence = calculateFieldConfidence(field, value, provider);
        // Convert from 0-1 to 0-100 percentage
        const confidence = Math.round(rawConfidence * 100);

        if (confidence > 0) {
          alternatives.push({
            provider,
            value,
            confidence
          });

          if (confidence > bestConfidence) {
            bestProvider = provider;
            bestConfidence = confidence;
          }
        }
      });

      // Only add field if a value was found
      if (bestConfidence > 0 && bestProvider !== '') {
        // Remove the best provider from alternatives (it will be the primary)
        const otherAlternatives = alternatives.filter(alt => alt.provider !== bestProvider);

        provenance[field] = {
          provider: bestProvider,
          confidence: bestConfidence,
          alternatives: otherAlternatives.length > 0 ? otherAlternatives : []
        };
      }
    });

    return provenance;
  }, [selectedSourcesMetadata, calculateFieldConfidence]);

  return (
    <Paper p="md" key={`quality-${metadataVersion}`}>
      <Title order={5} mb="md">Metadata Quality & Provenance</Title>
      <Stack gap="md">
        {/* Field-by-field quality indicators */}
        <Stack gap="xs">
          {Object.entries(mergedMetadata).map(([key, value]) => {
            // Check actual selected values for certain fields instead of metadata
            let hasValue = value && (!Array.isArray(value) || value.length > 0);

            // Override hasValue for fields that have separate selected values
            if (key === 'coverImage' || key === 'cover') {
              hasValue = !!selectedCover;
            } else if (key === 'bannerImage' || key === 'banner') {
              hasValue = !!selectedBanner;
            } else if (key === 'volumeData') {
              hasValue = selectedVolumes.length > 0;
            } else if (key === 'chapterData') {
              hasValue = (selectedChapters?.length ?? 0) > 0;
            }

            if (key === 'isAdult') return null; // Skip boolean fields in quality display

            // Skip internal/technical fields that aren't user-facing metadata
            const skipFields = [
              'cachedSearchResults', 'metadata', 'searchProvider', 'selectedSource',
              'volumeInfo', 'externalIds', 'externalLinks', 'volumes', 'chapters',
              'selectedVolumes', 'selectedChapters', 'coverUrl', 'bannerUrl'
            ];
            if (skipFields.includes(key)) return null;

            const source = getFieldSource(key, value);
            const sourceColor = source === 'user' ? 'blue' :
                               source === provider ? 'green' :
                               source === 'none' ? 'gray' : 'violet';

            const confidence = getFieldConfidence(key, value);
            const confidenceColor = getFieldConfidenceColor(confidence);
            const _confidenceLabel = getConfidenceLabel(confidence);

            return (
              <Group key={key} justify="space-between">
                <Text size="xs" tt="capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </Text>
                <Group gap={4}>
                  {hasValue ? (
                    <>
                      <Badge size="xs" color="green">Set</Badge>
                      {source !== 'none' && (
                        <Badge size="xs" color={sourceColor} variant="dot">
                          {source}
                        </Badge>
                      )}
                      {confidence !== undefined && (
                        <Badge size="xs" color={confidenceColor} variant="light">
                          {confidence}%
                        </Badge>
                      )}
                    </>
                  ) : (
                    <Badge size="xs" color="gray">Missing</Badge>
                  )}
                </Group>
              </Group>
            );
          })}
        </Stack>

        {/* Comprehensive provenance summary */}
        {Object.keys(fieldProvenance).length > 0 && (
          <MetadataProvenanceSummary
            fieldProvenance={fieldProvenance}
            title="Metadata Provenance Summary"
            showFieldBreakdown={true}
            showProviderDistribution={true}
          />
        )}
      </Stack>
    </Paper>
  );
});

MetadataQualitySection.displayName = 'MetadataQualitySection';
