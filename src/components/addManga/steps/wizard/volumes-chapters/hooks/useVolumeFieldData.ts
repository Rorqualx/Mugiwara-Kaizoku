/**
 * useVolumeFieldData Hook
 *
 * Handles field-level data selection from multiple sources.
 * Determines which source to use for each field (cover, summary, title)
 * based on user preferences.
 */

import { useMemo } from 'react';

import { findFieldInSelectedSources, getStringField, getVolumeFromSource } from '../utils/volume-data-extraction';

import type { VolumeDetails, VolumeFieldSources } from '../components/VolumeDetailsDrawer';

interface UseVolumeFieldDataParams {
  volume: VolumeDetails | null;
  volumeFieldSources?: VolumeFieldSources | undefined;
  selectedSourcesMetadata?: Record<string, unknown> | undefined;
  volumeNumber?: number | string | undefined;
  selectedSources: string[];
}

interface VolumeFieldData {
  coverImage: string | null;
  coverSource: string | null;
  description: string | null;
  summarySource: string | null;
  title: string | null;
  titleSource: string | null;
}

interface FieldResult {
  value: string | null;
  source: string | null;
}

interface ExtractContext {
  volNum: number | string;
  hasFieldSources: boolean;
  selectedSourcesMetadata: Record<string, unknown>;
  selectedSources: string[];
  /** Whether to allow fallback to other sources (only when source is "primary") */
  allowFallback: boolean;
}

const EMPTY_RESULT: FieldResult = { value: null, source: null };

/**
 * Helper to check if source is "primary" (meaning search all sources for best data)
 */
function isPrimarySource(source: string): boolean {
  return source === 'primary' || source === '';
}

/**
 * Extract cover image from sources
 * Only falls back to other sources if allowFallback is true (source is "primary")
 */
function extractCover(
  volume: VolumeDetails,
  sourceVolume: Record<string, unknown> | null,
  fieldSource: string | undefined,
  ctx: ExtractContext
): FieldResult {
  if (sourceVolume) {
    const value = getStringField(sourceVolume, 'coverImageUrl', 'coverImage', 'cover') ?? volume.coverImage ?? null;
    return { value, source: fieldSource ?? volume.source ?? null };
  }
  if (volume.coverImage) {
    return { value: volume.coverImage, source: volume.source ?? null };
  }
  // Only search other sources if "primary" was selected (allowFallback = true)
  // When user explicitly selects a source, don't fall back to other providers
  if (ctx.allowFallback && ctx.hasFieldSources && ctx.selectedSources.length > 0) {
    return findFieldInSelectedSources(
      ctx.volNum,
      ctx.selectedSourcesMetadata,
      ctx.selectedSources,
      ['coverImageUrl', 'coverImage', 'cover']
    );
  }
  return EMPTY_RESULT;
}

/**
 * Extract description/summary from sources
 * Only falls back to other sources if allowFallback is true (source is "primary")
 */
function extractDescription(
  volume: VolumeDetails,
  sourceVolume: Record<string, unknown> | null,
  fieldSource: string | undefined,
  ctx: ExtractContext
): FieldResult {
  if (sourceVolume) {
    const value = getStringField(sourceVolume, 'description', 'summary') ?? volume.description ?? volume.summary ?? null;
    return { value, source: fieldSource ?? volume.source ?? null };
  }
  const baseValue = volume.description ?? volume.summary;
  if (baseValue) {
    return { value: baseValue, source: volume.source ?? null };
  }
  // Only search other sources if "primary" was selected (allowFallback = true)
  // When user explicitly selects a source, don't fall back to other providers
  if (ctx.allowFallback && ctx.hasFieldSources && ctx.selectedSources.length > 0) {
    return findFieldInSelectedSources(
      ctx.volNum,
      ctx.selectedSourcesMetadata,
      ctx.selectedSources,
      ['description', 'summary']
    );
  }
  return EMPTY_RESULT;
}

/**
 * Extract title from sources
 * Only falls back to other sources if allowFallback is true (source is "primary")
 */
function extractTitle(
  volume: VolumeDetails,
  sourceVolume: Record<string, unknown> | null,
  fieldSource: string | undefined,
  ctx: ExtractContext
): FieldResult {
  if (sourceVolume) {
    const value = getStringField(sourceVolume, 'title') ?? volume.title ?? null;
    return { value, source: fieldSource ?? volume.source ?? null };
  }
  if (volume.title) {
    return { value: volume.title, source: volume.source ?? null };
  }
  // Only search other sources if "primary" was selected (allowFallback = true)
  // When user explicitly selects a source, don't fall back to other providers
  if (ctx.allowFallback && ctx.hasFieldSources && ctx.selectedSources.length > 0) {
    return findFieldInSelectedSources(
      ctx.volNum,
      ctx.selectedSourcesMetadata,
      ctx.selectedSources,
      ['title']
    );
  }
  return EMPTY_RESULT;
}

/**
 * Get volume from source if field source is specified and not primary
 */
function getSourceVolume(
  fieldSource: string | undefined,
  volNum: number | string,
  metadata: Record<string, unknown>
): Record<string, unknown> | null {
  if (!fieldSource || isPrimarySource(fieldSource)) {
    return null;
  }
  return getVolumeFromSource(fieldSource, volNum, metadata);
}

/**
 * Hook to extract volume field data from multiple sources
 * based on field-level source preferences.
 */
export function useVolumeFieldData({
  volume,
  volumeFieldSources,
  selectedSourcesMetadata,
  volumeNumber,
  selectedSources,
}: UseVolumeFieldDataParams): VolumeFieldData {
  // eslint-disable-next-line complexity -- Volume field resolution with multi-source lookups and fallbacks
  return useMemo(() => {
    if (!volume) {
      return {
        coverImage: null,
        coverSource: null,
        description: null,
        summarySource: null,
        title: null,
        titleSource: null,
      };
    }

    const volNum = volumeNumber ?? volume.number;
    const hasFieldSources = Boolean(volumeFieldSources && selectedSourcesMetadata && volNum);
    const metadata = selectedSourcesMetadata ?? {};

    // Determine allowFallback per field: only allow fallback when source is "primary"
    // When user explicitly selects a source, don't fall back to other providers
    const coverAllowFallback = isPrimarySource(volumeFieldSources?.volumeCover ?? 'primary');
    const summaryAllowFallback = isPrimarySource(volumeFieldSources?.volumeSummary ?? 'primary');
    const titleAllowFallback = isPrimarySource(volumeFieldSources?.volumeTitle ?? 'primary');

    // Create context for each field with its own allowFallback setting
    const baseCtx = {
      volNum,
      hasFieldSources,
      selectedSourcesMetadata: metadata,
      selectedSources,
    };
    const coverCtx: ExtractContext = { ...baseCtx, allowFallback: coverAllowFallback };
    const summaryCtx: ExtractContext = { ...baseCtx, allowFallback: summaryAllowFallback };
    const titleCtx: ExtractContext = { ...baseCtx, allowFallback: titleAllowFallback };

    // Get source volumes for each field
    const coverSourceVolume = hasFieldSources
      ? getSourceVolume(volumeFieldSources?.volumeCover, volNum, metadata)
      : null;
    const summarySourceVolume = hasFieldSources
      ? getSourceVolume(volumeFieldSources?.volumeSummary, volNum, metadata)
      : null;
    const titleSourceVolume = hasFieldSources
      ? getSourceVolume(volumeFieldSources?.volumeTitle, volNum, metadata)
      : null;

    // Extract each field with its own context
    const cover = extractCover(volume, coverSourceVolume, volumeFieldSources?.volumeCover, coverCtx);
    const desc = extractDescription(volume, summarySourceVolume, volumeFieldSources?.volumeSummary, summaryCtx);
    const titleData = extractTitle(volume, titleSourceVolume, volumeFieldSources?.volumeTitle, titleCtx);

    return {
      coverImage: cover.value,
      coverSource: cover.source,
      description: desc.value,
      summarySource: desc.source,
      title: titleData.value,
      titleSource: titleData.source,
    };
  }, [volume, volumeFieldSources, selectedSourcesMetadata, volumeNumber, selectedSources]);
}
