/**
 * useMergedMetadata Hook
 *
 * Merges selected metadata with provider metadata, prioritizing user selections.
 */

import { useMemo } from 'react';

import { isString } from '@/utils/type-guards';
import { isRecord } from '@/utils/type-guards/index';

export interface UseMergedMetadataParams {
  selectedMetadata: unknown;
  selectedSourcesMetadata: Record<string, unknown> | undefined;
  provider: string;
}

export function useMergedMetadata({
  selectedMetadata,
  selectedSourcesMetadata,
  provider,
}: UseMergedMetadataParams): Record<string, unknown> {
  return useMemo(() => {
    const providerData = selectedSourcesMetadata?.[provider];
    const providerMetadata = isRecord(providerData) ? providerData : {};

    const selectedMetadataRecord = isRecord(selectedMetadata) ? selectedMetadata : {};

    // Helper to get string property
    const getStringProp = (obj: Record<string, unknown>, key: string): string => {
      const value = obj[key];
      return isString(value) ? value : '';
    };

    // Helper to get array property
    const getArrayProp = (obj: Record<string, unknown>, key: string): unknown[] => {
      const value = obj[key];
      return Array.isArray(value) ? (value as unknown[]) : [];
    };

    return {
      ...providerMetadata,
      ...selectedMetadataRecord,
      title: getStringProp(selectedMetadataRecord, 'title') || getStringProp(providerMetadata, 'title'),
      description: getStringProp(selectedMetadataRecord, 'description'),
      synopsis: getStringProp(selectedMetadataRecord, 'synopsis'),
      status: getStringProp(selectedMetadataRecord, 'status') || getStringProp(providerMetadata, 'status'),
      format: getStringProp(selectedMetadataRecord, 'format') || getStringProp(providerMetadata, 'format'),
      genres: getArrayProp(selectedMetadataRecord, 'genres').length > 0
        ? getArrayProp(selectedMetadataRecord, 'genres')
        : getArrayProp(providerMetadata, 'genres'),
      authors: getArrayProp(selectedMetadataRecord, 'authors').length > 0
        ? getArrayProp(selectedMetadataRecord, 'authors')
        : getArrayProp(providerMetadata, 'authors'),
      artists: getArrayProp(selectedMetadataRecord, 'artists').length > 0
        ? getArrayProp(selectedMetadataRecord, 'artists')
        : getArrayProp(providerMetadata, 'artists'),
      tags: getArrayProp(selectedMetadataRecord, 'tags').length > 0
        ? getArrayProp(selectedMetadataRecord, 'tags')
        : getArrayProp(providerMetadata, 'tags'),
      themes: getArrayProp(selectedMetadataRecord, 'themes').length > 0
        ? getArrayProp(selectedMetadataRecord, 'themes')
        : getArrayProp(providerMetadata, 'themes'),
      alternativeTitles: getArrayProp(selectedMetadataRecord, 'alternativeTitles').length > 0
        ? getArrayProp(selectedMetadataRecord, 'alternativeTitles')
        : getArrayProp(providerMetadata, 'alternativeTitles'),
      publisher: getStringProp(selectedMetadataRecord, 'publisher') || getStringProp(providerMetadata, 'publisher'),
      demographic: getStringProp(selectedMetadataRecord, 'demographic') || getStringProp(providerMetadata, 'demographic'),
      startDate: getStringProp(selectedMetadataRecord, 'startDate') || getStringProp(providerMetadata, 'startDate'),
      endDate: getStringProp(selectedMetadataRecord, 'endDate') || getStringProp(providerMetadata, 'endDate'),
    };
  }, [selectedMetadata, selectedSourcesMetadata, provider]);
}
