/* eslint-disable max-lines -- Component requires all field rendering logic; refactoring would break feature cohesion */
/**
 * @file-size-justified: single component renders all metadata sections with
 * field-level provenance; splitting would obscure the per-field source/score
 * coupling that the badges rely on.
 *
 * BasicInfoStepMetadataPreview Component
 *
 * Shows aggregated metadata preview with field-level provenance badges
 * for the BasicInfoStep wizard step.
 *
 * @module components/addManga/steps/wizard/BasicInfoStepMetadataPreview
 */

import React, { useMemo } from 'react';

import { Paper, Stack, Text, Group, Badge, Tooltip, Grid, Divider } from '@mantine/core';
import { IconInfoCircle, IconSettings } from '@tabler/icons-react';

import { FieldProvenanceBadge } from '@/components/manga/MetadataProvenance/FieldProvenanceBadge';
import type { EnhancedProviderData } from '@/components/manga/MetadataProvenance/types';
import { useFieldProviderPreferences } from '@/hooks/useFieldProviderPreferences';
import { getFieldConfidence } from '@/lib/confidence';
import type { ProviderMetadata } from '@/types/universalImportWizard.types';

interface BasicInfoStepMetadataPreviewProps {
  /**
   * Metadata from selected providers
   */
  selectedSourcesMetadata: Record<string, ProviderMetadata>;

  /**
   * All available provider search results
   */
  additionalProviders: Record<string, { results?: unknown[] }>;

  /**
   * Currently selected sources
   */
  selectedSources: string[];

  /**
   * Pre-computed field provenance (optional)
   * If provided, uses this instead of computing from selectedSourcesMetadata
   */
  fieldProvenance?: Record<string, { provider: string; confidence: number }>;

  /**
   * Callback when field alternative provider is selected
   */
  onSelectFieldAlternative?: (field: string, provider: string) => void;
}

/**
 * Extract field values from provider metadata
 */
function extractFieldFromProvider(
  provider: string,
  metadata: ProviderMetadata,
  field: string
): unknown {
  return metadata[field as keyof ProviderMetadata];
}

/**
 * Calculate confidence for a field value from a provider
 * Uses dynamic confidence system from @/lib/confidence
 */
function calculateFieldConfidenceLocal(
  field: string,
  value: unknown,
  provider: string
): number {
  return getFieldConfidence(field, value, provider);
}

/**
 * Preferences parameter for aggregateMetadataWithProvenance
 */
interface AggregationPreferences {
  enabled: boolean;
  getPreferredProvider: (field: string) => string | null;
}

/**
 * Aggregate metadata from all selected providers with field-level provenance
 * When preferences are enabled, uses user's preferred providers for each field
 */
function aggregateMetadataWithProvenance(
  selectedSourcesMetadata: Record<string, ProviderMetadata>,
  selectedSources: string[],
  preferences?: AggregationPreferences
): {
  aggregated: Record<string, unknown>;
  fieldProvenance: Record<string, EnhancedProviderData>;
} {
  const aggregated: Record<string, unknown> = {};
  const fieldProvenance: Record<string, EnhancedProviderData> = {};

  // Default priority order for providers (used when preferences disabled or no preference for field)
  const defaultProviderPriority = ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'];

  // Fields to aggregate (including volume metadata and Wikipedia-specific fields)
  const fields = [
    'title', 'description', 'synopsis', 'cover', 'status', 'format', 'genres', 'tags',
    'authors', 'artists', 'startDate', 'endDate', 'chapters', 'volumes',
    'alternativeTitles', 'anilistId', 'myAnimeListId',
    // Volume metadata fields
    'isbn', 'isbn13', 'publisher', 'pageCount',
    // Wikipedia-specific fields
    'magazine', 'englishPublisher', 'imprint', 'demographic', 'originalRun'
  ];

  fields.forEach((field) => {
    // Find the best value for this field from all sources
    let bestValue: unknown = null;
    let bestProvider = '';
    let bestConfidence: number = 0;
    const alternatives: Array<{
      provider: string;
      value: unknown;
      confidence: number;
      quality?: number;
    }> = [];

    // Determine provider priority for this field based on preferences
    let providerPriority = defaultProviderPriority;

    if (preferences?.enabled) {
      const preferredProvider = preferences.getPreferredProvider(field);
      if (preferredProvider && selectedSources.includes(preferredProvider)) {
        // Put preferred provider first, then the rest
        providerPriority = [
          preferredProvider,
          ...defaultProviderPriority.filter(p => p !== preferredProvider)
        ];
      }
    }

    providerPriority.forEach((provider) => {
      if (!selectedSources.includes(provider)) return;

      const providerData = selectedSourcesMetadata[provider];
      if (!providerData) return;

      const value = extractFieldFromProvider(provider, providerData, field);
      const confidence = calculateFieldConfidenceLocal(field, value, provider);

      if (confidence > 0) {
        // Include actual value in alternatives array for dropdown display
        alternatives.push({
          provider,
          value, // Include the actual value for selection
          confidence
        });

        // For preferred provider, use it regardless of confidence score
        // This ensures user preferences are respected
        const isPreferred = preferences?.enabled &&
          preferences.getPreferredProvider(field) === provider;

        if (isPreferred || confidence > bestConfidence) {
          bestValue = value;
          bestProvider = provider;
          bestConfidence = confidence;

          // If this is the preferred provider, stop looking - user preference takes priority
          if (isPreferred) return;
        }
      }
    });

    // Only add field if a value was found
    if (bestConfidence > 0 && bestProvider !== '') {
      aggregated[field] = bestValue;

      // Remove the best provider from alternatives (it will be the primary)
      const otherAlternatives = alternatives.filter(alt => alt.provider !== bestProvider);

      fieldProvenance[field] = {
        provider: bestProvider,
        confidence: bestConfidence,
        alternatives: otherAlternatives.length > 0 ? otherAlternatives : []
      };
    }
  });

  return { aggregated, fieldProvenance };
}

/**
 * Format field value for display
 */
function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Not available';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.slice(0, 3).join(', ') + (value.length > 3 ? `... (+${value.length - 3} more)` : '');
  }

  if (typeof value === 'string') {
    if (field === 'description') {
      return value.length > 100 ? value.substring(0, 100) + '...' : value;
    }
    return value;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  return String(value);
}

/**
 * Get field display label
 */
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: 'Title',
    description: 'Description',
    synopsis: 'Synopsis',
    cover: 'Cover Image',
    status: 'Status',
    format: 'Format',
    genres: 'Genres',
    tags: 'Tags',
    authors: 'Authors',
    artists: 'Artists',
    startDate: 'Start Date',
    endDate: 'End Date',
    chapters: 'Chapter Count',
    volumes: 'Volume Count',
    alternativeTitles: 'Alternative Titles',
    anilistId: 'AniList ID',
    myAnimeListId: 'MyAnimeList ID',
    // Volume metadata fields
    isbn: 'ISBN',
    isbn13: 'ISBN-13',
    publisher: 'Publisher',
    pageCount: 'Page Count',
    // Wikipedia-specific fields
    magazine: 'Magazine',
    englishPublisher: 'English Publisher',
    imprint: 'Imprint',
    demographic: 'Demographic',
    originalRun: 'Original Run'
  };

  return labels[field] ?? field;
}

/**
 * Check if field should be displayed (has value)
 */
function shouldDisplayField(field: string, value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  if (Array.isArray(value) && value.length === 0) {
    return false;
  }

  // Skip ID fields in preview
  if (field.includes('Id') || field.includes('ID')) {
    return false;
  }

  return true;
}

export function BasicInfoStepMetadataPreview({
  selectedSourcesMetadata,
  additionalProviders: _additionalProviders,
  selectedSources,
  fieldProvenance: providedFieldProvenance,
  onSelectFieldAlternative
}: BasicInfoStepMetadataPreviewProps): React.ReactElement {
  // Get field provider preferences from settings
  const { enabled: preferencesEnabled, getPreferredProvider } = useFieldProviderPreferences();

  // Aggregate metadata with provenance (only if not provided)
  // When preferences are enabled, use them to determine which provider to use for each field
  const { aggregated: computedAggregated, fieldProvenance: computedFieldProvenance } = useMemo(() => {
    return aggregateMetadataWithProvenance(
      selectedSourcesMetadata,
      selectedSources,
      preferencesEnabled ? { enabled: true, getPreferredProvider } : undefined
    );
  }, [selectedSourcesMetadata, selectedSources, preferencesEnabled, getPreferredProvider]);

  // Merge provided field provenance (explicit user selections) with computed provenance
  const fieldProvenance = useMemo(() => {
    if (!providedFieldProvenance || Object.keys(providedFieldProvenance).length === 0) {
      return computedFieldProvenance;
    }
    // Merge: explicit selections override computed
    return { ...computedFieldProvenance, ...providedFieldProvenance };
  }, [providedFieldProvenance, computedFieldProvenance]);

  // Build aggregated metadata based on field provenance
  // Merge explicit user selections with computed values
  const aggregated = useMemo(() => {
    // Start with computed aggregated as base
    const result: Record<string, unknown> = { ...computedAggregated };

    // Override with explicit user selections from providedFieldProvenance
    if (providedFieldProvenance && Object.keys(providedFieldProvenance).length > 0) {
      Object.entries(providedFieldProvenance).forEach(([field, provenance]) => {
        const provider = provenance.provider;
        const providerData = selectedSourcesMetadata[provider];
        if (providerData && typeof providerData === 'object' && field in providerData) {
          result[field] = (providerData as Record<string, unknown>)[field];
        }
      });
    }

    return result;
  }, [providedFieldProvenance, selectedSourcesMetadata, computedAggregated]);

  // Count available fields
  const availableFieldCount = Object.keys(aggregated).filter(field =>
    shouldDisplayField(field, aggregated[field])
  ).length;

  // If no metadata available, show empty state
  if (availableFieldCount === 0) {
    return (
      <Paper p="md" withBorder>
        <Group gap="xs">
          <IconInfoCircle size={16} />
          <Text size="sm" c="dimmed">
            Select providers to see aggregated metadata preview
          </Text>
        </Group>
      </Paper>
    );
  }

  // Group fields by category for better organization
  const fieldCategories = {
    basic: ['title', 'status', 'format', 'chapters', 'volumes'],
    details: ['description', 'alternativeTitles'],
    creators: ['authors', 'artists'],
    dates: ['startDate', 'endDate'],
    tags: ['genres', 'tags'],
    media: ['cover'],
    volumeMetadata: ['isbn', 'isbn13', 'publisher', 'pageCount']
  };

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600} size="lg">Metadata Preview</Text>
            {preferencesEnabled && (
              <Tooltip label="Using your Quick Add field preferences from Settings">
                <Badge variant="light" color="green" size="sm" leftSection={<IconSettings size={12} />}>
                  Preferences Active
                </Badge>
              </Tooltip>
            )}
          </Group>
          <Badge variant="light" color="blue">
            {availableFieldCount} fields available
          </Badge>
        </Group>

        <Text size="sm" c="dimmed">
          {preferencesEnabled
            ? 'Preview shows metadata based on your Quick Add field preferences.'
            : 'Preview of metadata that will be aggregated from selected providers.'}
          {' '}Click on field badges to select alternative providers.
        </Text>

        <Divider />

        {/* Basic Information */}
        <div>
          <Text fw={500} size="sm" mb="xs">Basic Information</Text>
          <Grid gutter="xs">
            {fieldCategories.basic.map((field) => {
              const value = aggregated[field];
              const provenance = fieldProvenance[field];

              if (!shouldDisplayField(field, value)) return null;

              return (
                <Grid.Col key={field} span={6}>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500} style={{ minWidth: 80 }}>
                      {getFieldLabel(field)}:
                    </Text>
                    <Text size="sm" style={{ flex: 1 }}>
                      {formatFieldValue(field, value)}
                    </Text>
                    {provenance && (
                      <FieldProvenanceBadge
                        provenance={provenance}
                        field={field}
                        {...(onSelectFieldAlternative && { onSelectAlternative: onSelectFieldAlternative })}
                        size="xs"
                        showConfidenceText={false}
                      />
                    )}
                  </Group>
                </Grid.Col>
              );
            })}
          </Grid>
        </div>

        {/* Description */}
        {shouldDisplayField('description', aggregated['description']) && (
          <div>
            <Text fw={500} size="sm" mb="xs">Description</Text>
            <Group gap="xs" align="flex-start">
              <Text size="sm" style={{ flex: 1 }}>
                {formatFieldValue('description', aggregated['description'])}
              </Text>
              {fieldProvenance['description'] && (
                <FieldProvenanceBadge
                  provenance={fieldProvenance['description']}
                  field="description"
                  {...(onSelectFieldAlternative && { onSelectAlternative: onSelectFieldAlternative })}
                  size="xs"
                  showConfidenceText={false}
                />
              )}
            </Group>
          </div>
        )}

        {/* Creators */}
        {(shouldDisplayField('authors', aggregated['authors']) ||
          shouldDisplayField('artists', aggregated['artists'])) && (
          <div>
            <Text fw={500} size="sm" mb="xs">Creators</Text>
            <Grid gutter="xs">
              {fieldCategories.creators.map((field) => {
                const value = aggregated[field];
                const provenance = fieldProvenance[field];

                if (!shouldDisplayField(field, value)) return null;

                return (
                  <Grid.Col key={field} span={6}>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={500} style={{ minWidth: 60 }}>
                        {getFieldLabel(field)}:
                      </Text>
                      <Text size="sm" style={{ flex: 1 }}>
                        {formatFieldValue(field, value)}
                      </Text>
                      {provenance && (
                        <FieldProvenanceBadge
                          provenance={provenance}
                          field={field}
                          {...(onSelectFieldAlternative && { onSelectAlternative: onSelectFieldAlternative })}
                          size="xs"
                          showConfidenceText={false}
                        />
                      )}
                    </Group>
                  </Grid.Col>
                );
              })}
            </Grid>
          </div>
        )}

        {/* Tags & Genres */}
        {(shouldDisplayField('genres', aggregated['genres']) ||
          shouldDisplayField('tags', aggregated['tags'])) && (
          <div>
            <Text fw={500} size="sm" mb="xs">Categories</Text>
            <Grid gutter="xs">
              {fieldCategories.tags.map((field) => {
                const value = aggregated[field];
                const provenance = fieldProvenance[field];

                if (!shouldDisplayField(field, value)) return null;

                return (
                  <Grid.Col key={field} span={6}>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={500} style={{ minWidth: 60 }}>
                        {getFieldLabel(field)}:
                      </Text>
                      <Text size="sm" style={{ flex: 1 }}>
                        {formatFieldValue(field, value)}
                      </Text>
                      {provenance && (
                        <FieldProvenanceBadge
                          provenance={provenance}
                          field={field}
                          {...(onSelectFieldAlternative && { onSelectAlternative: onSelectFieldAlternative })}
                          size="xs"
                          showConfidenceText={false}
                        />
                      )}
                    </Group>
                  </Grid.Col>
                );
              })}
            </Grid>
          </div>
        )}

        {/* Volume Metadata (ISBN, Publisher, etc.) */}
        {(shouldDisplayField('isbn', aggregated['isbn']) ||
          shouldDisplayField('isbn13', aggregated['isbn13']) ||
          shouldDisplayField('publisher', aggregated['publisher']) ||
          shouldDisplayField('pageCount', aggregated['pageCount'])) && (
          <div>
            <Text fw={500} size="sm" mb="xs">Publication Details</Text>
            <Grid gutter="xs">
              {fieldCategories.volumeMetadata.map((field) => {
                const value = aggregated[field];
                const provenance = fieldProvenance[field];

                if (!shouldDisplayField(field, value)) return null;

                return (
                  <Grid.Col key={field} span={6}>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={500} style={{ minWidth: 80 }}>
                        {getFieldLabel(field)}:
                      </Text>
                      <Text size="sm" style={{ flex: 1, fontFamily: field.includes('isbn') ? 'monospace' : undefined }}>
                        {formatFieldValue(field, value)}
                      </Text>
                      {provenance && (
                        <FieldProvenanceBadge
                          provenance={provenance}
                          field={field}
                          {...(onSelectFieldAlternative && { onSelectAlternative: onSelectFieldAlternative })}
                          size="xs"
                          showConfidenceText={false}
                        />
                      )}
                    </Group>
                  </Grid.Col>
                );
              })}
            </Grid>
          </div>
        )}

        {/* Overall confidence */}
        {Object.keys(fieldProvenance).length > 0 && (
          <div>
            <Divider />
            <Group justify="space-between">
              <Text size="sm" fw={500}>Overall Confidence</Text>
              <Tooltip label="Average confidence score across all fields">
                <Badge variant="light" color="blue">
                  {Math.round(
                    Object.values(fieldProvenance)
                      .reduce((sum, p) => sum + p.confidence, 0) /
                    Object.keys(fieldProvenance).length
                  )}%
                </Badge>
              </Tooltip>
            </Group>
          </div>
        )}
      </Stack>
    </Paper>
  );
}

export { aggregateMetadataWithProvenance };