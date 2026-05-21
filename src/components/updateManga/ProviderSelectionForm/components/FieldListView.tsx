/**
 * FieldListView Component
 *
 * Renders an accordion-based list view of metadata fields with provider selection.
 * This component displays provider metadata in an organized, field-by-field format
 * with options to select providers for each metadata field.
 */

'use client';

import React from 'react';

import {
  Accordion,
  Badge,
  Box,
  Card,
  Divider,
  Group,
  Radio,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';

import { providerFieldCategories } from '@/components/metadata/fieldCategories';
import {
  getFieldValue,
  formatFieldValue,
} from '@/components/updateManga/providerFormUtils';
import type {
  FieldData,
  SelectOption,
  ProviderMetadataInfo,
  FieldProviderOption,
  Manga,
} from '@/components/updateManga/providerFormUtils';
import type { MangaWithRelations } from '@/types/search.types';

import type { Manga as MangaEntity } from '@prisma/client';

/**
 * Props for the FieldListView component
 */
interface FieldListViewProps {
  fieldData: Record<string, FieldData>;
  manga: MangaWithRelations | MangaEntity;
  onValueChange: (field: string, value: string | null) => void;
  onProviderChange: (field: string, provider: string) => void;
  renderProviderBadge: (provider: string) => React.ReactNode;
  renderImagePreview: (url: unknown) => React.ReactNode;
}

/**
 * Props for the SelectOption interface in Mantine
 */
interface SelectOptionProps {
  value?: string;
  label?: string;
  group?: string;
}

/**
 * Type guard for valid select options
 */
function isValidSelectOption(opt: unknown): opt is SelectOptionProps {
  return (
    typeof opt === 'object' &&
    opt !== null &&
    (('value' in opt && typeof (opt as Record<string, unknown>)['value'] === 'string') ||
      ('label' in opt && typeof (opt as Record<string, unknown>)['label'] === 'string'))
  );
}

/**
 * Type guard for SelectOption type
 */
function isSelectOption(opt: unknown): opt is SelectOption {
  return (
    typeof opt === 'object' &&
    opt !== null &&
    'value' in opt &&
    'label' in opt &&
    typeof (opt as Record<string, unknown>)['value'] === 'string'
  );
}

/**
 * Retrieves a provider option from field data
 */
function getProviderOption(
  data: FieldData | undefined,
  provider: string
): FieldProviderOption | undefined {
  if (!data?.options) return undefined;
  return data.options.find((opt) => opt.provider === provider);
}

/**
 * Renders a formatted provider value with fallbacks
 */
function renderProviderValue(
  data: FieldData | undefined,
  field: string
): string {
  if (!data) return 'Not available';
  if (!Array.isArray(data.selectOptions)) return 'No options available';
  if (typeof data.selectedProvider !== 'string') return 'No provider selected';

  const selectedOption = data.selectOptions.find(
    (opt) => isSelectOption(opt) && opt.value === data.selectedValue
  );

  if (selectedOption && isSelectOption(selectedOption) && selectedOption.label) {
    return selectedOption.label;
  }

  const providerOption = getProviderOption(data, data.selectedProvider);
  if (providerOption !== undefined && providerOption.value !== null) {
    return formatFieldValue(field, providerOption.value);
  }

  return 'Not available';
}

/**
 * Renders an image preview for cover fields if available
 */
function renderProviderImage(
  data: FieldData | undefined,
  field: string,
  renderImagePreview: (url: unknown) => React.ReactNode
): React.ReactNode {
  if (!data?.selectedProvider || !field.includes('cover')) return null;
  const providerOption = getProviderOption(data, data.selectedProvider);
  if (providerOption?.value) {
    return <Box mt="xs">{renderImagePreview(providerOption.value)}</Box>;
  }
  return null;
}

/**
 * Converts manga entity to internal Manga type for utility functions
 */
function convertToMangaForField(
  manga: MangaWithRelations | MangaEntity
): Manga {
  const result: Manga = {
    id: manga['id'],
    title: typeof manga['title'] === 'string' ? manga['title'] : String(manga['title']),
    metadata: (() => {
      if (manga.providerMetadata && typeof manga.providerMetadata === 'object') {
        return manga.providerMetadata as Record<string, unknown>;
      }
      const metadataObj: Record<string, unknown> = {};
      if ('summary' in manga && manga.summary) {
        metadataObj['description'] = manga.summary;
      }
      if ('coverUrl' in manga && manga.coverUrl) {
        metadataObj['coverUrl'] = manga.coverUrl;
      }
      if ('genres' in manga && manga['genres']) {
        metadataObj['genres'] = manga['genres'];
      }
      return metadataObj;
    })(),
    providerMetadata: buildProviderMetadata(manga),
    genres: [],
  };

  // Add optional properties only if they have values
  if (typeof manga.summary === 'string') {
    result.description = manga.summary;
  }

  return result;
}

/**
 * Builds provider metadata from manga entity
 */
function buildProviderMetadata(
  manga: MangaWithRelations | MangaEntity
): ProviderMetadataInfo | Array<{
  providerId: string;
  externalId?: string | number;
  metadata: Record<string, unknown>;
}> {
  const emptyProviderMetadataInfo: ProviderMetadataInfo = {
    metadataProvenance: {},
    preferences: {},
  };

  if (!manga.providerMetadata) {
    return emptyProviderMetadataInfo;
  }

  if (Array.isArray(manga.providerMetadata)) {
    const validProviders: Array<{
      providerId: string;
      externalId?: string | number;
      metadata: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < manga.providerMetadata.length; i++) {
      const item = manga.providerMetadata[i];
      if (
        item &&
        typeof item === 'object' &&
        'providerId' in item &&
        typeof item['providerId'] === 'string' &&
        'metadata' in item &&
        item['metadata'] !== null &&
        typeof item['metadata'] === 'object'
      ) {
        validProviders.push({
          providerId: item['providerId'],
          ...(typeof item['externalId'] === 'string' || typeof item['externalId'] === 'number'
            ? { externalId: item['externalId'] }
            : {}),
          metadata: item['metadata'] as Record<string, unknown>,
        });
      }
    }
    return validProviders;
  }

  if (typeof manga.providerMetadata === 'object') {
    if (
      'metadataProvenance' in manga.providerMetadata ||
      'preferences' in manga.providerMetadata
    ) {
      const providerMeta = manga.providerMetadata as Partial<ProviderMetadataInfo>;
      return {
        metadataProvenance:
          providerMeta.metadataProvenance && typeof providerMeta.metadataProvenance === 'object'
            ? (providerMeta.metadataProvenance as Record<string, string>)
            : {},
        preferences:
          providerMeta.preferences && typeof providerMeta.preferences === 'object'
            ? (providerMeta.preferences as Record<string, { provider: string; value: unknown }>)
            : {},
      };
    }
  }

  return emptyProviderMetadataInfo;
}

/**
 * Renders the select option with provider badge
 */
interface RenderOptionProps {
  option: unknown;
  renderProviderBadge: (provider: string) => React.ReactNode;
}

function SelectOptionRenderer({
  option,
  renderProviderBadge,
}: RenderOptionProps): React.ReactElement {
  if (!isValidSelectOption(option) || !option.value) {
    return (
      <Group wrap="nowrap" gap="xs">
        <Box mr="xs">{renderProviderBadge('unknown')}</Box>
        <Box style={{ flex: 1 }}>
          <Text size="sm">{isValidSelectOption(option) ? option.label : 'Unknown'}</Text>
        </Box>
      </Group>
    );
  }

  const providerName = (() => {
    if (typeof option.value !== 'string') return '';
    const parts = option.value.split(':');
    const firstPart = parts[0];
    return firstPart ?? '';
  })();

  return (
    <Group wrap="nowrap" gap="xs">
      <Box mr="xs">{renderProviderBadge(providerName)}</Box>
      <Box style={{ flex: 1 }}>
        <Text size="sm">{option.label ?? ''}</Text>
      </Box>
    </Group>
  );
}

/**
 * Renders a single field item within the accordion panel
 */
interface FieldItemProps {
  field: string;
  display: string;
  data: FieldData;
  manga: MangaWithRelations | MangaEntity;
  onValueChange: (field: string, value: string | null) => void;
  onProviderChange: (field: string, provider: string) => void;
  renderProviderBadge: (provider: string) => React.ReactNode;
  renderImagePreview: (url: unknown) => React.ReactNode;
}

function FieldItem({
  field,
  display,
  data,
  manga,
  onValueChange,
  onProviderChange,
  renderProviderBadge,
  renderImagePreview,
}: FieldItemProps): React.ReactElement {
  const mangaForField = convertToMangaForField(manga);
  const currentFieldValue = getFieldValue(mangaForField, field);

  return (
    <Box>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Text fw={500}>{display}</Text>
          <Tooltip label="Current provider" withArrow>
            {renderProviderBadge(data.currentProvider)}
          </Tooltip>
        </Group>
        <Tooltip label="Number of available providers" withArrow>
          <Badge color="gray" size="sm">
            {data.options.length} sources
          </Badge>
        </Tooltip>
      </Group>

      <Text size="sm" mb="xs">
        Current value: {formatFieldValue(field, currentFieldValue)}
      </Text>

      {field.includes('cover') && (
        <Box mb="md">{renderImagePreview(currentFieldValue)}</Box>
      )}

      <Select
        label="Select value"
        placeholder="Choose a value"
        value={data.selectedValue}
        onChange={(value: string | null) => {
          if (value !== null) {
            onValueChange(field, value);
          }
        }}
        data={data.selectOptions
          .filter(
            (option): option is SelectOption =>
              typeof option === 'object' && !!option.provider && !!option.value
          )
          .map((option) => ({
            value: option.value,
            label: option.label || '',
          }))}
        mb="md"
        searchable
        clearable={false}
        maxDropdownHeight={300}
        renderOption={({ option }: { option: unknown }) => (
          <SelectOptionRenderer option={option} renderProviderBadge={renderProviderBadge} />
        )}
      />

      <Box mb="md">
        <Text size="sm" fw={500} mb="xs">
          Or select by provider:
        </Text>
        <Radio.Group
          value={data.selectedProvider}
          onChange={(value: string) => {
            if (typeof value === 'string' && value.trim() !== '') {
              onProviderChange(field, value);
            }
          }}
          name={`provider-${field}`}
        >
          <Group gap="sm">
            {data.options.map((option) => (
              <Radio
                key={option.provider}
                value={option.provider}
                label={renderProviderBadge(option.provider)}
              />
            ))}
          </Group>
        </Radio.Group>
      </Box>

      <Box>
        <Text size="sm" fw={500} mb="xs">
          Preview:
        </Text>
        <Card padding="xs" withBorder>
          {data.selectedValue && (
            <Box>
              <Group gap="xs" mb="xs">
                <Text size="sm" fw={500}>
                  Provider:
                </Text>
                {renderProviderBadge(data.selectedProvider)}
              </Group>
              <Text size="sm" mb="xs">
                {renderProviderValue(data, field)}
              </Text>
              {renderProviderImage(data, field, renderImagePreview)}
            </Box>
          )}
        </Card>
      </Box>

      <Divider my="sm" />
    </Box>
  );
}

/**
 * FieldListView Component
 *
 * Renders an accordion-based list view of metadata fields with provider selection.
 * Fields are organized by category (Basic Information, Publication Details, etc.)
 *
 * @param props - Component props
 * @returns Accordion component with field items
 */
export function FieldListView({
  fieldData,
  manga,
  onValueChange,
  onProviderChange,
  renderProviderBadge,
  renderImagePreview,
}: FieldListViewProps): React.ReactElement {
  return (
    <Accordion>
      {Object.entries(providerFieldCategories).map(([category, fields]) => (
        <Accordion.Item key={category} value={category}>
          <Accordion.Control>
            <Text fw={600}>{category}</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              {fields.map(({ field, display }) => {
                const data = fieldData[field];
                if (!data) return null;
                if (data.options.length === 0) return null;

                return (
                  <FieldItem
                    key={field}
                    field={field}
                    display={display}
                    data={data}
                    manga={manga}
                    onValueChange={onValueChange}
                    onProviderChange={onProviderChange}
                    renderProviderBadge={renderProviderBadge}
                    renderImagePreview={renderImagePreview}
                  />
                );
              })}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

export default FieldListView;
