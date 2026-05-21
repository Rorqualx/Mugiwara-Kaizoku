/**
 * Metadata Display Component
 *
 * Displays manga metadata with field selection capabilities.
 * Shows data from multiple providers and allows users to choose which values to use.
 */

import React from 'react';

import {
  Card,
  Stack,
  Group,
  Text,
  Badge,
  Divider,
  Box,
  Title,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

import {
  getCoverImageValue,
  getChaptersValue,
  getVolumesValue
} from './metadata-display/field-value-helpers';
import { MetadataAlternativeTitles } from './metadata-display/MetadataAlternativeTitles';
import { MetadataCoverSection } from './metadata-display/MetadataCoverSection';
import { MetadataDescriptionSection } from './metadata-display/MetadataDescriptionSection';
import { MetadataExternalLinks } from './metadata-display/MetadataExternalLinks';
import { MetadataFieldsGrid } from './metadata-display/MetadataFieldsGrid';
import { MetadataGenresAndTags } from './metadata-display/MetadataGenresAndTags';

interface VolumeWithChapters {
  volumeNumber?: number;
  chapterCount?: number;
  chapters?: unknown[];
  [key: string]: unknown;
}

interface SelectedResult {
  title?: string;
  coverImage?: string;
  cover?: string;
  coverUrl?: string;
  description?: string;
  synopsis?: string;
  status?: string;
  format?: string;
  author?: string;
  artist?: string;
  year?: number;
  genres?: string[];
  tags?: string[];
  alternativeTitles?: string[];
  volumes?: VolumeWithChapters[] | number;
  chapters?: unknown[] | number;
  totalVolumes?: number;
  volumeCount?: number;
  totalChapters?: number;
  chapterCount?: number;
  url?: string;
  bannerImage?: string;
  rawData?: {
    coverImage?: string;
    cover?: string;
    synopsis?: string;
    totalChapters?: number;
    chapterCount?: number;
    totalVolumes?: number;
    volumes?: VolumeWithChapters[];
  };
  metadata?: {
    synopsis?: string;
    totalChapters?: number;
    chapterCount?: number;
  };
  [key: string]: unknown;
}

interface FieldSelection {
  source: string;
  value: unknown;
}

interface MetadataDisplayProps {
  selectedResult: SelectedResult;
  fieldSelections: Record<string, unknown>;
  alternativeMetadata: Record<string, unknown>;
  selectedFromProvider: Record<string, string>;
  metadataConfidence: Record<string, number>;
  onFieldSelect: (field: string, selection: FieldSelection) => void;
  onEditMetadata: () => void;
  onBannerClick: () => void;
}

export function MetadataDisplay({
  selectedResult,
  fieldSelections,
  alternativeMetadata,
  selectedFromProvider,
  metadataConfidence,
  onFieldSelect: _onFieldSelect,
  onEditMetadata,
  onBannerClick
}: MetadataDisplayProps): React.ReactElement {
  // Helper to safely get field value from fieldSelections
  const getFieldSelectionValue = React.useCallback((field: string): unknown => {
    const selection = fieldSelections[field];
    return selection && typeof selection === 'object' && 'value' in selection ? selection.value : undefined;
  }, [fieldSelections]);

  // Debug logging for cover image
  React.useEffect(() => {
    logger.info('[MetadataDisplay] Cover image debug:', {

      hasSelectedResult: !!selectedResult,
      selectedResultKeys: Object.keys(selectedResult),
      coverImage: selectedResult.coverImage,
      cover: selectedResult.cover,
      coverUrl: selectedResult.coverUrl,
      rawDataCover: selectedResult.rawData?.coverImage,
      fieldSelectionsCover: getFieldSelectionValue('coverImage') ?? getFieldSelectionValue('cover')
    });
  }, [selectedResult, fieldSelections, getFieldSelectionValue]);

  const getFieldValue = React.useCallback((field: string): unknown => {
    if (field === 'coverImage' || field === 'cover') {
      return getCoverImageValue(selectedResult, getFieldSelectionValue);
    }
    if (field === 'chapters') {
      return getChaptersValue(selectedResult, getFieldSelectionValue);
    }
    if (field === 'volumes') {
      return getVolumesValue(selectedResult, getFieldSelectionValue);
    }
    return (getFieldSelectionValue(field) ?? selectedResult[field]);
  }, [selectedResult, getFieldSelectionValue]);

  const getFieldProvider = React.useCallback((field: string): string => {
    const provider = selectedFromProvider[field];
    return (provider as string | undefined) ?? 'original';
  }, [selectedFromProvider]);

  const getFieldConfidence = React.useCallback((field: string): number => {
    const confidence = metadataConfidence[field];
    return (confidence as number | undefined) ?? 0;
  }, [metadataConfidence]);

  const renderField = React.useCallback((label: string, field: string, value: unknown): React.ReactNode => {
    const provider = getFieldProvider(field);
    const confidence = getFieldConfidence(field);
    const alternativesField = alternativeMetadata[field];
    const alternatives = (Array.isArray(alternativesField)) ? alternativesField : [];

    if (!value && alternatives.length === 0) return null;

    // Skip rendering complex object arrays (volumes, chapters) - they have dedicated displays
    if (field === 'volumes' || field === 'chapters') {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        // Show count instead of objects
        return (
          <Box>
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={600} c="dimmed">
                {label}
              </Text>
              {alternatives.length > 0 && (
                <Tooltip label={`${alternatives.length} alternative(s) available`}>
                  <Badge size="xs" variant="dot">
                    {provider}
                  </Badge>
                </Tooltip>
              )}
            </Group>

            <Text size="sm">
              {value.length} {field}
            </Text>

            {confidence > 0 && (
              <Text size="xs" c="dimmed" mt={2}>
                Confidence: {(confidence * 100).toFixed(0)}%
              </Text>
            )}
          </Box>
        );
      }
    }

    return (
      <Box>
        <Group justify="space-between" mb={4}>
          <Text size="sm" fw={600} c="dimmed">
            {label}
          </Text>
          {alternatives.length > 0 && (
            <Tooltip label={`${alternatives.length} alternative(s) available`}>
              <Badge size="xs" variant="dot">
                {provider}
              </Badge>
            </Tooltip>
          )}
        </Group>

        <Text size="sm">
          {Array.isArray(value) ? value.join(', ') : (value !== null && value !== '' ? String(value) : 'Not available')}
        </Text>

        {confidence > 0 && (
          <Text size="xs" c="dimmed" mt={2}>
            Confidence: {(confidence * 100).toFixed(0)}%
          </Text>
        )}
      </Box>
    );
  }, [alternativeMetadata, getFieldProvider, getFieldConfidence]);

  // Extract values for sub-components
  const coverUrl = React.useMemo(() => {
    const coverValue = getFieldValue('coverImage');
    return typeof coverValue === 'string' ? coverValue : '/placeholder-cover.jpg';
  }, [getFieldValue]);

  const title = React.useMemo(() => {
    const titleValue = getFieldValue('title');
    return typeof titleValue === 'string' ? titleValue : 'Untitled';
  }, [getFieldValue]);

  const hasBanner = React.useMemo(() => {
    const bannerValue = getFieldValue('bannerImage');
    return !!bannerValue;
  }, [getFieldValue]);

  const description = React.useMemo(() => {
    const descriptionValue = getFieldValue('description');
    return typeof descriptionValue === 'string' ? descriptionValue : undefined;
  }, [getFieldValue]);

  const synopsis = React.useMemo(() => {
    const synopsisValue = (
      getFieldSelectionValue('synopsis') ??
      selectedResult.synopsis ??
      selectedResult.rawData?.synopsis ??
      selectedResult.metadata?.synopsis ??
      null
    );
    return typeof synopsisValue === 'string' ? synopsisValue : undefined;
  }, [getFieldSelectionValue, selectedResult]);

  const genres = React.useMemo(() => {
    const genresValue = getFieldValue('genres');
    if (!Array.isArray(genresValue)) return undefined;
    return genresValue.map((genre: unknown) => typeof genre === 'string' ? genre : String(genre));
  }, [getFieldValue]);

  const tags = React.useMemo(() => {
    const tagsValue = getFieldValue('tags');
    if (!Array.isArray(tagsValue)) return undefined;
    return tagsValue.map((tag: unknown) => typeof tag === 'string' ? tag : String(tag));
  }, [getFieldValue]);

  const alternativeTitles = React.useMemo(() => {
    const altTitlesValue = getFieldValue('alternativeTitles');
    if (!Array.isArray(altTitlesValue)) return undefined;
    return altTitlesValue.map((altTitle: unknown) => typeof altTitle === 'string' ? altTitle : String(altTitle));
  }, [getFieldValue]);

  const url = React.useMemo(() => {
    const urlValue = getFieldValue('url');
    return typeof urlValue === 'string' ? urlValue : undefined;
  }, [getFieldValue]);

  return (
    <Stack gap="md">
      {/* Main Info Card */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group gap="md" align="flex-start">
          {/* Cover Image */}
          <MetadataCoverSection
            coverUrl={coverUrl}
            title={title}
            hasBanner={hasBanner}
            onBannerClick={onBannerClick}
          />

          {/* Metadata Fields */}
          <Stack style={{ flex: 1 }} gap="sm">
            <Group justify="space-between">
              <Title order={3}>{title}</Title>
              <ActionIcon variant="light" onClick={onEditMetadata}>
                <IconEdit size={18} />
              </ActionIcon>
            </Group>

            <MetadataFieldsGrid
              renderField={renderField}
              getFieldValue={getFieldValue}
            />

            <Divider />

            <MetadataDescriptionSection
              description={description}
              synopsis={synopsis}
            />

            <MetadataGenresAndTags
              genres={genres}
              tags={tags}
            />
          </Stack>
        </Group>
      </Card>

      {/* Alternative Titles */}
      <MetadataAlternativeTitles alternativeTitles={alternativeTitles} />

      {/* External Links */}
      <MetadataExternalLinks url={url} />
    </Stack>
  );
}
