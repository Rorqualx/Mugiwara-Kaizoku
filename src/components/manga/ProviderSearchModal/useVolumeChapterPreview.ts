/**
 * Hook for lazy-loading volume/chapter preview data from providers
 *
 * Uses the wizard's tryFetchFromProvider() pipeline to support any
 * provider (MangaDex, ComicVine, Fandom, Wikipedia) without hardcoding.
 */

import { useState, useCallback } from 'react';

import type { FetchedVolumeData, ProviderMetadataMap } from '@/components/addManga/services/quickAddService/types';
import { tryFetchFromProvider } from '@/components/addManga/services/quickAddService/volume-fetcher';
import { getProviderExternalUrl } from '@/components/manga/provider-bind-config';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

import { isRecord } from './utils';

import type { ProviderBindings, ProviderVolumePreview, VolumePreviewChapter, VolumePreviewItem } from './types';

/** Providers that tryFetchFromProvider supports */
const VOLUME_CAPABLE_PROVIDERS = new Set(['mangadex', 'comicvine', 'fandom', 'wikipedia']);

interface UseVolumeChapterPreviewOptions {
  providerData: Record<string, unknown>;
  providerBindings?: ProviderBindings | undefined;
}

interface UseVolumeChapterPreviewResult {
  previews: ProviderVolumePreview[];
  isLoading: boolean;
  error: string | null;
  loadPreview: () => Promise<void>;
}

// ============================================================================
// Metadata Map Builder
// ============================================================================

/**
 * Enrich metadata with binding-derived fields when both search data and binding exist.
 * The binding provides a reliable ID/URL even when search data has poor results.
 */
function enrichWithBinding(
  metadata: Record<string, unknown>,
  bindingId: string,
  urlField: string,
  provider: string
): Record<string, unknown> {
  const enriched = { ...metadata };
  const url = getProviderExternalUrl(provider, bindingId);

  // Always inject the binding ID so URL extractors can use it
  if (!enriched['id']) enriched['id'] = bindingId;

  // Inject binding-derived URL if the search result lacks one for this provider
  if (url && !enriched[urlField]) {
    enriched[urlField] = url;
  }

  logger.info(`[volume-preview] Enriched ${provider} metadata with binding`, {
    bindingId,
    hasUrl: typeof enriched[urlField] === 'string',
    urlField,
    url: typeof enriched[urlField] === 'string' ? (enriched[urlField] as string).substring(0, 60) : 'none',
  });

  return enriched;
}

/** Enrich or create metadata for a single provider using its binding */
function resolveProviderMetadata(
  existing: Record<string, unknown> | undefined,
  bindingId: string | undefined,
  urlField: string,
  provider: string
): Record<string, unknown> | undefined {
  if (!bindingId) return existing;

  if (existing) {
    return enrichWithBinding(existing, bindingId, urlField, provider);
  }

  // No search data — create stub from binding
  const url = getProviderExternalUrl(provider, bindingId);
  return { id: bindingId, ...(url ? { [urlField]: url } : {}) };
}

/** Build ProviderMetadataMap from modal's providerData + bindings */
function buildMetadataMap(
  providerData: Record<string, unknown>,
  providerBindings?: ProviderBindings
): ProviderMetadataMap {
  const fandomRaw = isRecord(providerData['fandom']) ? providerData['fandom'] : undefined;
  const comicvineRaw = isRecord(providerData['comicvine']) ? providerData['comicvine'] : undefined;
  const mangadexRaw = isRecord(providerData['mangadex']) ? providerData['mangadex'] : undefined;
  const wikipediaRaw = isRecord(providerData['wikipedia']) ? providerData['wikipedia'] : undefined;

  const metadataMap: ProviderMetadataMap = {
    fandomMetadata: resolveProviderMetadata(fandomRaw, providerBindings?.['fandom'], 'url', 'fandom'),
    comicvineMetadata: resolveProviderMetadata(comicvineRaw, providerBindings?.['comicvine'], 'siteDetailUrl', 'comicvine'),
    mangadexMetadata: resolveProviderMetadata(mangadexRaw, providerBindings?.['mangadex'], 'url', 'mangadex'),
    wikipediaMetadata: wikipediaRaw ?? (providerBindings?.['wikipedia'] ? { id: providerBindings['wikipedia'] } : undefined),
  };

  logger.info('[volume-preview] Built metadata map', {
    hasFandom: !!metadataMap.fandomMetadata,
    fandomUrl: typeof metadataMap.fandomMetadata?.['url'] === 'string'
      ? (metadataMap.fandomMetadata['url'] as string).substring(0, 60) : 'none',
    fandomId: metadataMap.fandomMetadata?.['id'] ?? 'none',
    hasComicvine: !!metadataMap.comicvineMetadata,
    hasMangadex: !!metadataMap.mangadexMetadata,
    hasWikipedia: !!metadataMap.wikipediaMetadata,
  });

  return metadataMap;
}

// ============================================================================
// Generic Volume/Chapter Mapper (duck-typing)
// ============================================================================

/** Map a single chapter record to VolumePreviewChapter using duck-typing */
function mapChapterItem(ch: unknown): VolumePreviewChapter | null {
  if (!isRecord(ch)) return null;

  const rawNumber = ch['chapterNumber'] ?? ch['number'] ?? ch['chapter'] ?? '';
  const number = typeof rawNumber === 'number' ? String(rawNumber) : String(rawNumber);

  const result: VolumePreviewChapter = { number };
  if (typeof ch['title'] === 'string') result.title = ch['title'];
  if (typeof ch['url'] === 'string') result.url = ch['url'];
  if (typeof ch['releaseDate'] === 'string') result.releaseDate = ch['releaseDate'];

  return result;
}

/** Parse a raw volume number from varying field shapes */
function parseVolumeNumber(vol: Record<string, unknown>): number {
  const rawVolNum = vol['volumeNumber'] ?? vol['number'] ?? vol['volume'];
  if (typeof rawVolNum === 'number') return rawVolNum;
  if (typeof rawVolNum === 'string') {
    const parsed = parseFloat(rawVolNum);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/** Map a single volume record to VolumePreviewItem using duck-typing */
function mapVolumeItem(vol: unknown): VolumePreviewItem | null {
  if (!isRecord(vol)) return null;

  const volumeNumber = parseVolumeNumber(vol);
  const rawChapters = Array.isArray(vol['chapters']) ? vol['chapters'] : [];
  const chapters = rawChapters.map(mapChapterItem).filter(Boolean) as VolumePreviewChapter[];

  const item: VolumePreviewItem = { volumeNumber, chapters };

  // Title (varies by provider: title, volumeTitle, name)
  const title =
    typeof vol['title'] === 'string' ? vol['title']
      : typeof vol['volumeTitle'] === 'string' ? vol['volumeTitle']
        : typeof vol['name'] === 'string' ? vol['name']
          : undefined;
  if (title) item.title = title;

  // Summary
  const summary =
    typeof vol['volumeSummary'] === 'string' ? vol['volumeSummary']
      : typeof vol['description'] === 'string' ? vol['description']
        : undefined;
  if (summary) item.summary = summary;

  // Cover image
  const coverImage =
    typeof vol['coverImageUrl'] === 'string' ? vol['coverImageUrl']
      : typeof vol['coverImage'] === 'string' ? vol['coverImage']
        : undefined;
  if (coverImage) item.coverImage = coverImage;

  return item;
}

/** Map FetchedVolumeData to ProviderVolumePreview */
function mapFetchedToPreview(data: FetchedVolumeData): ProviderVolumePreview {
  const sourceVolumes = data.volumeDetails ?? data.volumes;
  const volumes = sourceVolumes.map(mapVolumeItem).filter(Boolean) as VolumePreviewItem[];

  const chaptersFromVolumes = volumes.reduce((sum, v) => sum + v.chapters.length, 0);
  const totalChapters = data.totalChapters > 0 ? data.totalChapters : chaptersFromVolumes;

  return { provider: data.provider, volumes, totalChapters };
}

// ============================================================================
// Determine Available Providers
// ============================================================================

/** Get deduplicated list of providers that can be queried for volume data */
function getAvailableProviders(
  providerData: Record<string, unknown>,
  providerBindings?: ProviderBindings
): string[] {
  const providers = new Set<string>();

  for (const key of Object.keys(providerData)) {
    if (VOLUME_CAPABLE_PROVIDERS.has(key)) {
      providers.add(key);
    }
  }

  if (providerBindings) {
    for (const key of Object.keys(providerBindings)) {
      if (VOLUME_CAPABLE_PROVIDERS.has(key)) {
        providers.add(key);
      }
    }
  }

  return [...providers];
}

// ============================================================================
// Fetch & Process Results
// ============================================================================

/** Fetch from all providers and map settled results to previews */
async function fetchAllProviderPreviews(
  providers: string[],
  metadataMap: ProviderMetadataMap,
  trpcClient: Parameters<typeof tryFetchFromProvider>[2]
): Promise<ProviderVolumePreview[]> {
  const settled = await Promise.allSettled(
    providers.map((provider) => tryFetchFromProvider(provider, metadataMap, trpcClient))
  );

  const results: ProviderVolumePreview[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const provider = providers[i];
    if (!outcome || !provider) continue;

    if (outcome.status === 'rejected') {
      const msg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      logger.error(`[volume-preview] ${provider} fetch failed`, { error: msg });
      results.push({ provider, volumes: [], totalChapters: 0, error: msg });
      continue;
    }

    const data = outcome.value;
    if (data) {
      logger.info(`[volume-preview] ${provider} returned data`, {
        totalVolumes: data.totalVolumes,
        totalChapters: data.totalChapters,
        volumeCount: data.volumes.length,
      });
      results.push(mapFetchedToPreview(data));
    } else {
      logger.info(`[volume-preview] ${provider} returned null (no URL/ID found or no data)`);
    }
  }

  return results;
}

// ============================================================================
// Hook
// ============================================================================

export function useVolumeChapterPreview({
  providerData,
  providerBindings,
}: UseVolumeChapterPreviewOptions): UseVolumeChapterPreviewResult {
  const [previews, setPreviews] = useState<ProviderVolumePreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const loadPreview = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setPreviews([]);

    const providers = getAvailableProviders(providerData, providerBindings);

    if (providers.length === 0) {
      setError('No provider data or bindings found. Search for a provider or bind one first.');
      setIsLoading(false);
      return;
    }

    const metadataMap = buildMetadataMap(providerData, providerBindings);
    logger.info('[volume-preview] Fetching volume data', { providers, hasBindings: !!providerBindings });

    const results = await fetchAllProviderPreviews(providers, metadataMap, utils.client);

    if (results.length === 0) {
      setError('No volume/chapter data found from any provider.');
    }

    setPreviews(results);
    setIsLoading(false);
  }, [providerData, providerBindings, utils.client]);

  return { previews, isLoading, error, loadPreview };
}
