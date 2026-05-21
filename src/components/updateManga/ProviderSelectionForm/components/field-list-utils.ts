/**
 * Utility functions for FieldListView component
 *
 * Contains helper functions for manga conversion, provider metadata handling,
 * and value rendering logic.
 */

import {
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
 * Props for the SelectOption interface in Mantine
 */
export interface SelectOptionProps {
  value?: string;
  label?: string;
  group?: string;
}

/**
 * Type guard for valid select options
 */
export function isValidSelectOption(opt: unknown): opt is SelectOptionProps {
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
export function isSelectOption(opt: unknown): opt is SelectOption {
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
export function getProviderOption(
  data: FieldData | undefined,
  provider: string
): FieldProviderOption | undefined {
  if (!data?.options) return undefined;
  return data.options.find((opt) => opt.provider === provider);
}

/**
 * Renders a formatted provider value with fallbacks
 */
export function renderProviderValue(
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
 * Builds provider metadata from manga entity
 */
export function buildProviderMetadata(
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
 * Converts manga entity to internal Manga type for utility functions
 */
export function convertToMangaForField(
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
 * Extracts provider name from select option value
 * Value format is "provider:index"
 */
export function extractProviderFromValue(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  const parts = value.split(':');
  const firstPart = parts[0];
  return firstPart ?? '';
}
