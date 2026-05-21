/**
 * Wizard to Manga Input Mapper - Helper Functions
 *
 * Utility functions for extracting, formatting, and resolving
 * provider data during wizard-to-manga input mapping.
 */

import type { ProviderMetadata, Volume } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

/**
 * Extract site name from a URL for externalLinks
 */
export function extractSiteName(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
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
function volumeHasChapterUrls(vol: unknown): boolean {
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
 * Validate volume source format matches expected provider
 */
export function validateVolumeSourceFormat(firstVolume: Volume, resolvedVolumeSource: string): void {
  const firstVolumeObj = firstVolume as unknown as Record<string, unknown>;
  const titleCandidates = [
    firstVolume.title,
    typeof firstVolumeObj["volumeTitle"] === 'string' ? firstVolumeObj["volumeTitle"] : null
  ];
  const firstVolumeTitle: string = titleCandidates.filter((t): t is string => typeof t === 'string')[0] ?? '';

  const hasComicVineFormat = typeof firstVolumeTitle === 'string' && firstVolumeTitle.includes('#');
  const hasFandomFormat = typeof firstVolumeTitle === 'string' && /\d{2}/.test(firstVolumeTitle);

  if (resolvedVolumeSource === 'comicvine' && !hasComicVineFormat && hasFandomFormat) {
    logger.warn('[DATA MISMATCH] Expected ComicVine volumes but received Fandom format!', {
      resolvedVolumeSource,
      firstVolumeTitle,
      hasComicVineFormat,
      hasFandomFormat
    });
    logger.warn('[DATA MISMATCH] Volume source mismatch detected:', {
      expected: resolvedVolumeSource,
      actualFormat: 'fandom',
      firstVolumeTitle,
      fix: 'Verify displayVolumes is being passed correctly from UniversalImportWizard'
    });
  }
}

/**
 * Format ComicVine volume title with enriched subtitle
 */
export function formatComicVineTitle(rawTitle: string | undefined, volumeNumber: number | undefined): string {
  if (typeof rawTitle !== 'string') {
    return `Issue #${volumeNumber}`;
  }

  const subtitleMatch = rawTitle.match(/#\d+:\s*(.+?)(?:\n|$)/);
  if (subtitleMatch?.[1]) {
    return `#${volumeNumber}: ${subtitleMatch[1].trim()}`;
  }

  const altMatch = rawTitle.match(/(?:.*?)\s*#\d+:\s*(.+?)(?:\n|$)/);
  if (altMatch?.[1]) {
    return `#${volumeNumber}: ${altMatch[1].trim()}`;
  }

  return `Issue #${volumeNumber}`;
}

/** Find the first provider that has chapter URLs in its volumeData */
function findChapterSourceProvider(metadata: Record<string, ProviderMetadata>): string | null {
  for (const [providerKey, providerData] of Object.entries(metadata)) {
    if (!providerData.volumeData || !Array.isArray(providerData.volumeData)) {
      continue;
    }
    const hasUrls = providerData.volumeData.some(volumeHasChapterUrls);
    if (hasUrls) {
      return providerKey.toLowerCase();
    }
  }
  return null;
}

/** Find the volume source provider from metadata */
function findVolumeSourceProvider(metadata: Record<string, ProviderMetadata>): string | null {
  const comicvineKey = Object.keys(metadata).find(k => k.toLowerCase() === 'comicvine');
  if (comicvineKey && metadata[comicvineKey]?.volumeData?.length) {
    return 'comicvine';
  }
  return null;
}

/**
 * Resolve 'primary' to actual provider name for volume and chapter sources
 */
export function resolveSourceToProvider(
  sourceValue: string | undefined,
  metadata: Record<string, ProviderMetadata>,
  defaultProvider: string,
  isChapterSource: boolean = false
): string {
  if (!sourceValue || sourceValue === 'primary') {
    const resolved = isChapterSource
      ? findChapterSourceProvider(metadata)
      : findVolumeSourceProvider(metadata);

    if (resolved) {
      const sourceType = isChapterSource ? 'chapter' : 'volume';
      logger.info(`[wizardToMangaInputMapper] Resolved ${sourceType} source to '${resolved}'`);
      return resolved;
    }

    logger.info(`[wizardToMangaInputMapper] Resolved '${isChapterSource ? 'chapter' : 'volume'}' source to default provider '${defaultProvider}'`);
    return defaultProvider;
  }
  return sourceValue.toLowerCase();
}

/**
 * Extract value without provider suffix (e.g., "value::provider" -> "value")
 */
export function extractValueWithoutProvider(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return value;

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
