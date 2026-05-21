/**
 * useAutoSwitchSource Hook
 *
 * Automatically switches volume/chapter display source when the primary source
 * has no volumeData but a secondary source does. Also syncs field sources.
 *
 * IMPORTANT: Auto-switch only happens ONCE on initial metadata load.
 * After that, user selections are always respected.
 */

import { useEffect, useRef } from 'react';

import { getSourcesWithVolumeData } from '@/components/addManga/services/sourceManagementService/data-retrieval';
import type { ProviderMetadata } from '@/types/universalImportWizard.types';

import type { VolumeFieldSources } from '../components/SourceSelection';

interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
}

interface UseAutoSwitchSourceParams {
  selectedSourcesMetadata: Record<string, unknown>;
  volumeDisplaySource: string;
  chapterDisplaySource: string;
  provider: string;
  logger: Logger;
  setVolumeDisplaySource: (source: string) => void;
  setChapterDisplaySource: (source: string) => void;
  setVolumeFieldSources: React.Dispatch<React.SetStateAction<VolumeFieldSources>>;
}

/** Check if a source has volumeData */
function hasVolumeData(metadata: ProviderMetadata | undefined): boolean {
  return Boolean(metadata?.volumeData && Array.isArray(metadata.volumeData) && metadata.volumeData.length > 0);
}

/** Find fallback source with volumeData */
function findFallbackSource(metadata: Record<string, unknown>, primarySource: string): string | undefined {
  const typedMetadata = metadata as Record<string, ProviderMetadata>;
  const sourcesWithData = getSourcesWithVolumeData(typedMetadata);
  return sourcesWithData.find(s => s !== primarySource);
}

/** Create synced field sources for all fields */
function createSyncedFieldSources(volSource: string, chapSource: string): VolumeFieldSources {
  return {
    volumeCover: volSource, volumeSummary: volSource, volumeTitle: volSource,
    chapterCover: chapSource, chapterSummary: chapSource, chapterTitle: chapSource,
  };
}

/** Result of auto-switch check */
interface AutoSwitchResult {
  /** Source to switch to, or null if no switch needed */
  fallback: string | null;
  /** Whether primary already has volumeData (marks as done, no need to retry) */
  primaryHasData: boolean;
}

/** Determine if auto-switch should be performed and return the fallback source if so */
function shouldAutoSwitch(
  metadata: Record<string, unknown>,
  volumeDisplaySource: string,
  provider: string,
  hasAutoSwitched: boolean
): AutoSwitchResult {
  if (Object.keys(metadata).length === 0) return { fallback: null, primaryHasData: false };
  if (hasAutoSwitched) return { fallback: null, primaryHasData: false };
  if (volumeDisplaySource !== 'primary') return { fallback: null, primaryHasData: false };

  const primarySource = provider.toLowerCase();
  const primaryMetadata = metadata[primarySource] as ProviderMetadata | undefined;
  if (hasVolumeData(primaryMetadata)) return { fallback: null, primaryHasData: true };

  const fallback = findFallbackSource(metadata, primarySource) ?? null;
  return { fallback, primaryHasData: false };
}

/**
 * Hook that automatically switches display sources when primary has no volumeData.
 * Auto-switch only happens ONCE on initial metadata load.
 */
export function useAutoSwitchSource({
  selectedSourcesMetadata, volumeDisplaySource, chapterDisplaySource, provider,
  logger, setVolumeDisplaySource, setChapterDisplaySource, setVolumeFieldSources,
}: UseAutoSwitchSourceParams): void {
  const hasAutoSwitchedRef = useRef(false);

  // Auto-switch effect - retries until fallback found or primary has data
  useEffect(() => {
    const result = shouldAutoSwitch(selectedSourcesMetadata, volumeDisplaySource, provider, hasAutoSwitchedRef.current);

    // Only mark as done when:
    // 1. We found a fallback and switched to it
    // 2. Primary already has volumeData (no need to switch)
    // This allows retries when secondary sources load later
    if (result.fallback) {
      hasAutoSwitchedRef.current = true;
      logger.info('[useAutoSwitchSource] Auto-switching to fallback', { to: result.fallback });
      setVolumeDisplaySource(result.fallback);
      setChapterDisplaySource(result.fallback);
    } else if (result.primaryHasData) {
      hasAutoSwitchedRef.current = true;
      logger.info('[useAutoSwitchSource] Primary has volumeData, no switch needed');
    }
    // If no fallback found and primary has no data, don't mark as done - allow retry when more metadata loads
  }, [selectedSourcesMetadata, volumeDisplaySource, provider, logger, setVolumeDisplaySource, setChapterDisplaySource]);

  // Sync field sources when main sources change
  useEffect(() => {
    setVolumeFieldSources(prev => {
      const sourceMetadata = selectedSourcesMetadata[volumeDisplaySource] as ProviderMetadata | undefined;
      if (hasVolumeData(sourceMetadata)) {
        return createSyncedFieldSources(volumeDisplaySource, chapterDisplaySource);
      }
      if (prev.volumeCover === volumeDisplaySource && prev.chapterCover === chapterDisplaySource) {
        return prev;
      }
      return { ...prev, volumeCover: volumeDisplaySource, chapterCover: chapterDisplaySource };
    });
  }, [volumeDisplaySource, chapterDisplaySource, selectedSourcesMetadata, setVolumeFieldSources]);
}
