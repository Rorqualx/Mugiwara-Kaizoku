/**
 * useAutoFetch Hook
 *
 * Custom React hook for automatic fetching of volume data from Fandom, ComicVine,
 * and Wikipedia when metadata is available.
 *
 * @module components/addManga/steps/wizard/volumes-chapters/hooks/useAutoFetch
 */

import React from 'react';

import { extractMangaDexId } from '@/components/addManga/services/quickAddService/volume-fetcher/provider-fetchers';

import {
  hasProperty,
  type Logger,
  extractFandomMetadata,
  extractComicVineMetadata,
  extractWikipediaMetadata,
  extractFandomUrl,
  extractComicVineUrl,
  extractWikipediaUrl,
  hasExistingVolumes,
  extractVolumeCount,
  extractTotalChapters,
} from '../index';
import { extractMangaDexMetadata } from '../utils/metadata-extraction';

// ============================================================================
// Types
// ============================================================================

/** Parameters for the useAutoFetch hook */
export interface UseAutoFetchParams {
  provider: string;
  selectedSourcesMetadata: Record<string, unknown>;
  volumesData: unknown;
  isParsingVolumeUrl: boolean;
  manualVolumeUrl: string;
  handleVolumeUrlParse: (urlOverride?: string) => void;
  setManualVolumeUrl: (url: string) => void;
  logger: Logger;
}

/** Return value from the useAutoFetch hook */
export interface UseAutoFetchReturn {
  isAutoFetching: boolean;
  autoFetchError: string | null;
  setAutoFetchError: (error: string | null) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Extract volumesListUrl from Fandom metadata */
function extractVolumesListUrl(meta: Record<string, unknown> | undefined): string | undefined {
  if (!meta) return undefined;
  const url = hasProperty(meta, 'volumesListUrl') ? meta['volumesListUrl'] : undefined;
  return typeof url === 'string' ? url : undefined;
}

/** Check if selectedSourcesMetadata already has volumeData for a provider */
function hasVolumeDataInMetadata(
  selectedSourcesMetadata: Record<string, unknown>,
  providerName: string
): boolean {
  const normalizedName = providerName.toLowerCase();
  const meta = selectedSourcesMetadata[normalizedName] as Record<string, unknown> | undefined;
  if (!meta) return false;
  const volumeData = meta['volumeData'];
  return Array.isArray(volumeData) && volumeData.length > 0;
}

/** Options for determining auto-fetch target */
interface AutoFetchTargetOptions {
  provider: string;
  fandomUrl: string | undefined;
  comicvineUrl: string | undefined;
  wikipediaUrl: string | undefined;
  mangadexId: string | undefined;
  existingVolumes: boolean;
  fandomMeta: Record<string, unknown> | undefined;
  selectedSourcesMetadata: Record<string, unknown>;
}

/** Determine which provider URL to auto-fetch */
function determineAutoFetchTarget(opts: AutoFetchTargetOptions): { providerName: string; url: string } | null {
  const { provider, fandomUrl, comicvineUrl, wikipediaUrl, mangadexId, existingVolumes, fandomMeta, selectedSourcesMetadata } = opts;

  // Skip auto-fetch if enrichment already populated volumeData in selectedSourcesMetadata
  // This prevents the auto-fetch from overwriting enriched data with empty data from URL parsing
  if (provider === 'fandom' && fandomUrl && !existingVolumes) {
    // Check if fandom already has volumeData from enrichment
    if (hasVolumeDataInMetadata(selectedSourcesMetadata, 'fandom')) {
      return null; // Skip auto-fetch - enrichment already provided data
    }
    const volumesUrl = extractVolumesListUrl(fandomMeta) ?? fandomUrl;
    return { providerName: 'Fandom', url: volumesUrl };
  }
  if (provider === 'comicvine' && comicvineUrl && !existingVolumes) {
    if (hasVolumeDataInMetadata(selectedSourcesMetadata, 'comicvine')) {
      return null;
    }
    return { providerName: 'ComicVine', url: comicvineUrl };
  }
  if (provider === 'wikipedia' && wikipediaUrl && !existingVolumes) {
    if (hasVolumeDataInMetadata(selectedSourcesMetadata, 'wikipedia')) {
      return null;
    }
    return { providerName: 'Wikipedia', url: wikipediaUrl };
  }
  if (provider === 'mangadex' && mangadexId && !existingVolumes) {
    if (hasVolumeDataInMetadata(selectedSourcesMetadata, 'mangadex')) {
      return null;
    }
    // Construct a MangaDex URL from the UUID so handleVolumeUrlParse can detect it
    return { providerName: 'MangaDex', url: `https://mangadex.org/title/${mangadexId}` };
  }
  return null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for automatic fetching of volume data
 */
export function useAutoFetch(params: UseAutoFetchParams): UseAutoFetchReturn {
  const {
    provider,
    selectedSourcesMetadata,
    volumesData,
    isParsingVolumeUrl,
    manualVolumeUrl,
    handleVolumeUrlParse,
    setManualVolumeUrl,
    logger,
  } = params;

  const hasAttemptedAutoFetchRef = React.useRef(false);
  const [isAutoFetching, setIsAutoFetching] = React.useState(false);
  const [autoFetchError, setAutoFetchError] = React.useState<string | null>(null);
  const autoFetchCompleteRef = React.useRef(false);

  /** Execute auto-fetch for a provider */
  const executeAutoFetch = React.useCallback(
    (providerName: string, url: string): void => {
      logger.info(`[useAutoFetch] Triggering ${providerName} auto-fetch:`, url);

      // For ComicVine, this will trigger:
      // Phase A: API volume fetch (instant UI update)
      // Phase B: Background chapter scraping (progressive updates)
      if (providerName === 'ComicVine') {
        logger.info('[useAutoFetch] ComicVine auto-fetch will run in 2 phases: API (instant) + Scraping (background)');
      }

      hasAttemptedAutoFetchRef.current = true;
      setIsAutoFetching(true);
      setManualVolumeUrl(url);

      setTimeout(() => {
        void (async () => {
          try {
            await handleVolumeUrlParse(url);
            logger.info(`[useAutoFetch] ${providerName} auto-fetch completed`);
            autoFetchCompleteRef.current = true;
            setAutoFetchError(null);
          } catch (error) {
            logger.error(`[useAutoFetch] ${providerName} auto-fetch failed:`, error);
            const msg = error instanceof Error ? error.message : String(error);
            setAutoFetchError(`Failed to fetch volume data: ${msg}`);
          } finally {
            setIsAutoFetching(false);
          }
        })();
      }, 100);
    },
    [handleVolumeUrlParse, setManualVolumeUrl, logger]
  );

  // Immediate auto-fetch when provider URL is detected
  React.useEffect(() => {
    if (hasAttemptedAutoFetchRef.current || isAutoFetching) return;

    const fandomMeta = extractFandomMetadata(selectedSourcesMetadata);
    const comicvineMeta = extractComicVineMetadata(selectedSourcesMetadata);
    const wikipediaMeta = extractWikipediaMetadata(selectedSourcesMetadata);
    const mangadexMeta = extractMangaDexMetadata(selectedSourcesMetadata);

    const fandomUrl = extractFandomUrl(fandomMeta);
    const comicvineUrl = extractComicVineUrl(comicvineMeta);
    const wikipediaUrl = extractWikipediaUrl(wikipediaMeta);
    const mangadexId = extractMangaDexId(mangadexMeta) ?? undefined;
    const existingVolumes = hasExistingVolumes(volumesData);

    // Debug: Log the full metadata structure for ComicVine
    logger.info('[useAutoFetch] ComicVine metadata debug:', {
      hasComicvineMeta: !!comicvineMeta,
      comicvineMetaKeys: comicvineMeta ? Object.keys(comicvineMeta) : [],
      comicvineUrl,
      comicvineId: comicvineMeta?.['id'] ?? comicvineMeta?.['sourceId'] ?? comicvineMeta?.['comicVineId'],
      comicvineSiteDetailUrl: comicvineMeta?.['siteDetailUrl'],
      comicvineRawUrl: comicvineMeta?.['url'],
    });

    logger.info('[useAutoFetch] Checking for immediate auto-fetch:', {
      provider,
      hasFandomUrl: !!fandomUrl,
      hasComicvineUrl: !!comicvineUrl,
      hasWikipediaUrl: !!wikipediaUrl,
      hasMangadexId: !!mangadexId,
      hasExistingVolumes: existingVolumes,
    });

    const target = determineAutoFetchTarget({
      provider, fandomUrl, comicvineUrl, wikipediaUrl, mangadexId, existingVolumes, fandomMeta, selectedSourcesMetadata
    });
    if (target) {
      executeAutoFetch(target.providerName, target.url);
    } else {
      logger.info('[useAutoFetch] Skipping auto-fetch - volumeData already exists in selectedSourcesMetadata');
    }
  }, [provider, selectedSourcesMetadata, volumesData, isAutoFetching, executeAutoFetch, logger]);

  // Monitor volumesData updates for feedback
  React.useEffect(() => {
    if (!autoFetchCompleteRef.current) return;

    const volumeCount = extractVolumeCount(volumesData);
    const totalChapters = extractTotalChapters(volumesData);

    if (volumeCount > 0) {
      logger.info('[useAutoFetch] Volume data updated after auto-fetch:', {
        volumeCount,
        totalChapters,
      });
    }
    autoFetchCompleteRef.current = false;
  }, [volumesData, logger]);

  // Backup auto-fetch for Fandom if immediate check didn't trigger
  // Only triggers when provider is explicitly 'fandom'
  React.useEffect(() => {
    // Only attempt backup fetch for Fandom provider
    if (provider !== 'fandom') return;

    // Skip if enrichment already populated volumeData
    if (hasVolumeDataInMetadata(selectedSourcesMetadata, 'fandom')) {
      logger.info('[useAutoFetch] Skipping backup auto-fetch - Fandom already has volumeData from enrichment');
      return;
    }

    const fandomMeta = extractFandomMetadata(selectedSourcesMetadata);
    const fandomUrl = extractFandomUrl(fandomMeta);

    const shouldAttemptBackup =
      fandomMeta &&
      fandomUrl &&
      !hasExistingVolumes(volumesData) &&
      !isParsingVolumeUrl &&
      !hasAttemptedAutoFetchRef.current &&
      !isAutoFetching;

    if (!shouldAttemptBackup) return;

    logger.info('[useAutoFetch] Backup auto-fetch triggered for Fandom');

    const volumesUrl = extractVolumesListUrl(fandomMeta) ?? fandomUrl;
    if (volumesUrl && volumesUrl !== manualVolumeUrl) {
      executeAutoFetch('Fandom', volumesUrl);
    }
  }, [
    provider,
    selectedSourcesMetadata,
    volumesData,
    isParsingVolumeUrl,
    isAutoFetching,
    manualVolumeUrl,
    executeAutoFetch,
    logger,
  ]);

  // Post auto-fetch verification
  React.useEffect(() => {
    if (isAutoFetching || !autoFetchCompleteRef.current) return;

    const volumeCount = extractVolumeCount(volumesData);

    logger.info('[useAutoFetch] Post auto-fetch check:', {
      hasVolumes: volumeCount > 0,
      volumeCount,
    });

    if (volumeCount > 0) {
      logger.info('[useAutoFetch] Volumes successfully loaded');
      setAutoFetchError(null);
    }

    autoFetchCompleteRef.current = false;
  }, [volumesData, selectedSourcesMetadata, isAutoFetching, logger]);

  return {
    isAutoFetching,
    autoFetchError,
    setAutoFetchError,
  };
}
