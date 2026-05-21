/**
 * Helper Functions Module
 *
 * Contains all utility functions used by the wizard-to-manga mapper.
 * These functions handle URL extraction, data validation, and value processing.
 *
 * @module components/addManga/utils/wizard-mapper/helpers
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition -- defensive programming for runtime safety */

import { logger } from '@/utils/logger';

import type { Volume } from './types';

/**
 * Extract site name from a URL for externalLinks
 * @param url - The URL to extract the site name from
 * @returns The site name (e.g., "anilist" from "https://anilist.co/manga/123")
 */
export function extractSiteName(url: string): string {
  try {
    const urlObj = new URL(url);
    // Extract domain without www and TLD
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    // Return the main domain name (e.g., "anilist" from "anilist.co")
    return parts[0] ?? hostname;
  } catch {
    return 'external';
  }
}

/**
 * Check if a provider has chapter data in volumes
 */
export function hasChapterData(_providerKey: string, volumes: Volume[]): boolean {
  if (volumes.length === 0) return false;
  return volumes.some(vol => vol.chapters && Array.isArray(vol.chapters) && vol.chapters.length > 0);
}

/**
 * Check if a volume has chapters with URLs
 */
export function volumeHasChapterUrls(vol: unknown): boolean {
  const typedVol = vol as { chapters?: unknown[] };
  if (!typedVol.chapters || !Array.isArray(typedVol.chapters) || typedVol.chapters.length === 0) {
    return false;
  }

  return typedVol.chapters.some((ch: unknown) => {
    const typedCh = ch as { url?: string };
    return typedCh.url && typeof typedCh.url === 'string';
  });
}

/**
 * Check if a volume has any chapter data (regardless of whether chapters have URLs)
 * This is a less strict check than volumeHasChapterUrls - used for Fandom which has
 * chapter metadata but not necessarily chapter URLs.
 */
export function volumeHasChapters(vol: unknown): boolean {
  const typedVol = vol as { chapters?: unknown[] };
  return !!(typedVol.chapters && Array.isArray(typedVol.chapters) && typedVol.chapters.length > 0);
}

/**
 * Validate volume source format matches expected provider
 */
export function validateVolumeSourceFormat(firstVolume: Volume, resolvedVolumeSource: string): void {
  const firstVolumeObj = firstVolume as unknown as Record<string, unknown>;
  const titleCandidates = [
    firstVolume.title,
    typeof firstVolumeObj["volumeTitle"] === 'string' ? firstVolumeObj["volumeTitle"] : null
  ];
  const firstVolumeTitle: string = titleCandidates.filter((t): t is string => typeof t === 'string')[0] ?? '';

  // ComicVine volumes should have enriched format like "Fire Force #1: Subtitle"
  const hasComicVineFormat = typeof firstVolumeTitle === 'string' && firstVolumeTitle.includes('#');
  // Fandom volumes typically have format like "Fire Force 01"
  const hasFandomFormat = typeof firstVolumeTitle === 'string' && /\d{2}/.test(firstVolumeTitle);

  if (resolvedVolumeSource === 'comicvine' && !hasComicVineFormat && hasFandomFormat) {
    logger.warn('⚠️ [DATA MISMATCH] Expected ComicVine volumes but received Fandom format!', {
      resolvedVolumeSource,
      firstVolumeTitle,
      hasComicVineFormat,
      hasFandomFormat
    });
    logger.warn('⚠️ [DATA MISMATCH] Volume source mismatch detected:', {
      expected: resolvedVolumeSource,
      actualFormat: 'fandom',
      firstVolumeTitle,
      fix: 'Verify displayVolumes is being passed correctly from UniversalImportWizard'
    });
  }
}

/**
 * Format ComicVine volume title with enriched subtitle
 * Handles multiple title formats from ComicVine:
 * - "Fire Force #1: Fire Walk With Me" → "#1: Fire Walk With Me"
 * - "Fire Walk With Me" (just subtitle) → "#1: Fire Walk With Me"
 * - null/undefined → "Volume #1"
 */
export function formatComicVineTitle(rawTitle: string | undefined, volumeNumber: number | undefined): string {
  if (typeof rawTitle !== 'string' || rawTitle.trim() === '') {
    return `Volume #${volumeNumber ?? 1}`;
  }

  const trimmedTitle = rawTitle.trim();

  // Try to extract subtitle from "#1: Subtitle" pattern
  const subtitleMatch = trimmedTitle.match(/#\d+:\s*(.+?)(?:\n|$)/);
  if (subtitleMatch?.[1]) {
    return `#${volumeNumber}: ${subtitleMatch[1].trim()}`;
  }

  // Try alternate pattern: "Series Name #1: Subtitle"
  const altMatch = trimmedTitle.match(/(?:.*?)\s*#\d+:\s*(.+?)(?:\n|$)/);
  if (altMatch?.[1]) {
    return `#${volumeNumber}: ${altMatch[1].trim()}`;
  }

  // Title exists but doesn't match enriched pattern - use the actual title with volume number
  // This preserves titles like "Shinra Kusakabe Joins the Force" instead of discarding them
  return `#${volumeNumber}: ${trimmedTitle}`;
}

/**
 * Resolve 'primary' to actual provider name for volume and chapter sources.
 * When a specific source is provided but has no data, falls back to finding
 * a source that does have the required data.
 */
export function resolveSourceToProvider(
  sourceValue: string | undefined,
  metadata: Record<string, unknown>,
  defaultProvider: string,
  isChapterSource: boolean = false
): string {
  // Diagnostic: Log all provider keys and their data structure (WARN level to ensure visibility)
  logger.warn(`[resolveSourceToProvider] Starting resolution`, {
    sourceValue,
    defaultProvider,
    isChapterSource,
    metadataKeys: Object.keys(metadata)
  });

  // Helper function to find a provider with chapter data
  // Uses volumeHasChapters (less strict) to find providers with any chapter data,
  // not just chapters with URLs (Fandom has chapter data without URLs)
  const findProviderWithChapterData = (): string | null => {
    logger.warn(`[resolveSourceToProvider] findProviderWithChapterData - scanning providers:`, {
      providers: Object.keys(metadata)
    });

    for (const [providerKey, providerData] of Object.entries(metadata)) {
      const typedProviderData = providerData as { volumeData?: unknown[]; volumeDetails?: unknown[] };
      const volumeArray = typedProviderData.volumeData ?? typedProviderData.volumeDetails;

      logger.warn(`[resolveSourceToProvider] Checking provider '${providerKey}' for chapter data`, {
        hasVolumeData: !!typedProviderData.volumeData,
        hasVolumeDetails: !!typedProviderData.volumeDetails,
        volumeArrayLength: volumeArray?.length ?? 0,
        volumeArrayIsArray: Array.isArray(volumeArray)
      });

      if (!volumeArray || !Array.isArray(volumeArray)) {
        continue;
      }

      // Check first volume structure for debugging
      if (volumeArray.length > 0) {
        const firstVol = volumeArray[0] as Record<string, unknown>;
        const chapters = firstVol?.['chapters'] as unknown[] | undefined;
        logger.info(`[resolveSourceToProvider] First volume structure for '${providerKey}'`, {
          hasChaptersProperty: 'chapters' in (firstVol ?? {}),
          chaptersLength: chapters?.length ?? 0,
          firstChapter: chapters?.[0] ? JSON.stringify(chapters[0]).substring(0, 200) : 'none'
        });
      }

      // Use less strict check - any chapter data is sufficient
      const hasChapters = volumeArray.some(volumeHasChapters);
      if (hasChapters) {
        logger.info(`[resolveSourceToProvider] Found provider '${providerKey}' with chapter data`);
        return providerKey.toLowerCase();
      }
    }
    return null;
  };

  // Helper function to find a provider with volume data
  const findProviderWithVolumeData = (): string | null => {
    logger.warn(`[resolveSourceToProvider] findProviderWithVolumeData - scanning providers:`, {
      providers: Object.keys(metadata)
    });

    // Check ComicVine first
    const comicvineKey = Object.keys(metadata).find(k => k.toLowerCase() === 'comicvine');
    const comicvineData = comicvineKey ? metadata[comicvineKey] as { volumeData?: unknown[] } : undefined;
    logger.warn(`[resolveSourceToProvider] ComicVine check:`, {
      comicvineKey,
      hasVolumeData: !!comicvineData?.volumeData,
      volumeDataLength: comicvineData?.volumeData?.length ?? 0
    });
    if (comicvineData?.volumeData?.length) {
      return 'comicvine';
    }

    // Check Fandom
    const fandomKey = Object.keys(metadata).find(k => k.toLowerCase() === 'fandom');
    const fandomData = fandomKey ? metadata[fandomKey] as { volumeDetails?: unknown[] } : undefined;
    logger.warn(`[resolveSourceToProvider] Fandom check:`, {
      fandomKey,
      hasVolumeDetails: !!fandomData?.volumeDetails,
      volumeDetailsLength: fandomData?.volumeDetails?.length ?? 0
    });
    if (fandomData?.volumeDetails?.length) {
      return 'fandom';
    }
    return null;
  };

  // Helper to check if a specific provider has the required data
  // eslint-disable-next-line complexity -- Multi-provider data validation: checks volumeData, volumeDetails, chapters across AniList, ComicVine, Fandom
  const providerHasRequiredData = (provider: string): boolean => {
    const providerKey = Object.keys(metadata).find(k => k.toLowerCase() === provider.toLowerCase());

    logger.warn(`[resolveSourceToProvider] providerHasRequiredData('${provider}')`, {
      foundKey: providerKey ?? 'NOT FOUND',
      allKeys: Object.keys(metadata)
    });

    if (!providerKey) {
      logger.warn(`[resolveSourceToProvider] Provider '${provider}' not found in metadata`);
      return false;
    }

    const providerData = metadata[providerKey] as { volumeData?: unknown[]; volumeDetails?: unknown[] };
    const volumeArray = providerData?.volumeData ?? providerData?.volumeDetails;

    logger.warn(`[resolveSourceToProvider] Provider '${provider}' data check`, {
      hasVolumeData: !!providerData?.volumeData,
      hasVolumeDetails: !!providerData?.volumeDetails,
      volumeArrayLength: volumeArray?.length ?? 0,
      providerDataKeys: providerData ? Object.keys(providerData).slice(0, 15) : []
    });

    if (!volumeArray || !Array.isArray(volumeArray) || volumeArray.length === 0) {
      logger.warn(`[resolveSourceToProvider] Provider '${provider}' has no volume data`);
      return false;
    }

    if (isChapterSource) {
      // For chapter source, check if any volume has chapters (use less strict check)
      // Fandom has chapter data without URLs, so volumeHasChapters is more appropriate
      const hasChapters = volumeArray.some(volumeHasChapters);

      // Extra debugging: check first volume structure
      if (volumeArray.length > 0) {
        const firstVol = volumeArray[0] as Record<string, unknown>;
        const chapters = firstVol?.['chapters'] as unknown[] | undefined;
        logger.warn(`[resolveSourceToProvider] Provider '${provider}' first volume chapter check`, {
          hasChaptersProperty: 'chapters' in (firstVol ?? {}),
          chaptersLength: chapters?.length ?? 0,
          chaptersIsArray: Array.isArray(chapters),
          firstChapterSample: chapters?.[0] ? JSON.stringify(chapters[0]).substring(0, 150) : 'none'
        });
      }

      logger.warn(`[resolveSourceToProvider] Provider '${provider}' chapter data check: ${hasChapters}`, {
        volumeCount: volumeArray.length,
        firstVolumeHasChapters: volumeHasChapters(volumeArray[0])
      });
      return hasChapters;
    } else {
      // For volume source, just having volume data is enough
      return true;
    }
  };

  if (!sourceValue || sourceValue === 'primary') {
    // No specific source requested, find the best one
    if (isChapterSource) {
      const found = findProviderWithChapterData();
      if (found) {
        logger.info(`[wizardToMangaInputMapper] Resolved chapter source to '${found}' (has chapter URLs)`);
        return found;
      }
    } else {
      const found = findProviderWithVolumeData();
      if (found) {
        logger.info(`[wizardToMangaInputMapper] Resolved volume source to '${found}' (has volume data)`);
        return found;
      }
    }
    logger.info(`[wizardToMangaInputMapper] Resolved '${isChapterSource ? 'chapter' : 'volume'}' source to default provider '${defaultProvider}'`);
    return defaultProvider;
  }

  // A specific source was requested - check if it has data
  const requestedSource = sourceValue.toLowerCase();
  if (providerHasRequiredData(requestedSource)) {
    logger.info(`[wizardToMangaInputMapper] Using requested ${isChapterSource ? 'chapter' : 'volume'} source '${requestedSource}'`);
    return requestedSource;
  }

  // Requested source has no data - fall back to finding one that does
  logger.warn(`[wizardToMangaInputMapper] Requested ${isChapterSource ? 'chapter' : 'volume'} source '${requestedSource}' has no data, searching for fallback...`);

  if (isChapterSource) {
    const fallback = findProviderWithChapterData();
    if (fallback) {
      logger.info(`[wizardToMangaInputMapper] Falling back chapter source to '${fallback}' (has chapter data)`);
      return fallback;
    }
  } else {
    const fallback = findProviderWithVolumeData();
    if (fallback) {
      logger.info(`[wizardToMangaInputMapper] Falling back volume source to '${fallback}' (has volume data)`);
      return fallback;
    }
  }

  // No fallback found, return requested source anyway (will show warning later)
  logger.warn(`[wizardToMangaInputMapper] No fallback found for ${isChapterSource ? 'chapter' : 'volume'} source, using '${requestedSource}'`);
  return requestedSource;
}

/**
 * Extract value without provider suffix (e.g., "value::provider" → "value")
 */
export function extractValueWithoutProvider(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return value;

  // Check if value has provider suffix pattern
  if (value.includes('::')) {
    const [actualValue] = value.split('::');
    return actualValue;
  }

  return value;
}

/**
 * Extract array values without provider suffixes
 */
export function extractArrayWithoutProviders(arr: string[] | undefined): string[] | undefined {
  if (!Array.isArray(arr)) return arr;

  return arr.map(value => {
    if (typeof value === 'string' && value.includes('::')) {
      const [actualValue] = value.split('::');
      return actualValue ?? '';
    }
    return typeof value === 'string' ? value : '';
  });
}