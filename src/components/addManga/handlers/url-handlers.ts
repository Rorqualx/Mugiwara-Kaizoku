/**
 * URL Parsing Handlers for Universal Import Wizard
 *
 * Provides hooks for parsing various metadata source URLs including:
 * - Basic URL parsing
 * - Metadata-specific URL parsing
 * - ComicVine volume URL parsing with detailed scraping
 *
 * Provider-specific parsing logic has been extracted to:
 * - ./providers/fandom-url-parser.ts
 * - ./providers/wikipedia-url-parser.ts
 * - ./providers/comicvine-url-parser.ts
 *
 * @module url-handlers
 * @provenance Extracted from UniversalImportWizard.tsx lines 214-449
 */

import { useCallback } from 'react';

import { useDebouncedCallback } from '@mantine/hooks';

import type {
  MediaGallery,
  ProviderMetadata,
  VolumesData,
  WizardFormData
} from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';

import {
  detectProviderFromUrl,
  parseComicVineUrl,
  parseFandomUrl,
  parseWikipediaUrl
} from './providers';

import type {
  MutationResults,
  StaticAnalysisResponse,
  WikipediaAnalysisResponse,
  WizardStepContentProps,
} from '../wizard-utils';

// ============================================================================
// MangaDex URL Parser (extracted to reduce useUrlHandlers line count)
// ============================================================================

function extractMangaDexId(url: string): string | undefined {
  return url.match(/mangadex\.org\/(?:title|manga)\/([a-f0-9-]{36})/i)?.[1];
}

function applyMangaDexVolumeData(
  data: { volumes: unknown[]; totalVolumes: number; totalChapters: number },
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void,
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void,
  setVolumeDisplaySource?: (source: string) => void,
  setChapterDisplaySource?: (source: string) => void,
): void {
  const { volumes, totalVolumes, totalChapters } = data;
  logger.info('[handleVolumeUrlParse] MangaDex volumes fetched', { volumeCount: volumes.length, totalChapters });

  setVolumesData((prev: VolumesData) => ({
    ...prev,
    mangadex: { volumes, totalVolumes, totalChapters, volumeDetails: volumes }
  } as VolumesData));

  setSelectedSourcesMetadata((prev) => ({
    ...prev,
    mangadex: {
      ...((prev['mangadex'] ?? {}) as Record<string, unknown>),
      volumes: totalVolumes, chapters: totalChapters, volumeData: volumes,
    } as ProviderMetadata
  }));

  if (setVolumeDisplaySource) setVolumeDisplaySource('mangadex');
  if (setChapterDisplaySource) setChapterDisplaySource('mangadex');
}

interface MangaDexParseParams {
  urlToParse: string;
  mutations: MutationResults;
  setSelectedSources: React.Dispatch<React.SetStateAction<string[]>>;
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void;
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void;
  setVolumeDisplaySource?: ((source: string) => void) | undefined;
  setChapterDisplaySource?: ((source: string) => void) | undefined;
}

async function parseMangaDexUrl(params: MangaDexParseParams): Promise<void> {
  const { urlToParse, mutations, setSelectedSources, setVolumesData, setSelectedSourcesMetadata, setVolumeDisplaySource, setChapterDisplaySource } = params;
  const mangadexId = extractMangaDexId(urlToParse);
  if (!mangadexId) {
    notify({ severity: 'WARNING', title: 'Invalid MangaDex URL', message: 'Could not extract MangaDex ID from URL' });
    return;
  }

  setSelectedSources((prev) => {
    if (prev.some(s => s.toLowerCase() === 'mangadex')) return prev;
    logger.info('[handleVolumeUrlParse] Added mangadex to selectedSources');
    return [...prev, 'mangadex'];
  });

  if (!mutations.fetchMangaDexVolumesMutation) {
    logger.warn('[handleVolumeUrlParse] MangaDex volumes mutation not available');
    notify({ severity: 'WARNING', title: 'MangaDex Unavailable', message: 'MangaDex volume fetching is not available' });
    return;
  }

  logger.info('[handleVolumeUrlParse] Fetching MangaDex volumes', { mangadexId });
  try {
    const result = await mutations.fetchMangaDexVolumesMutation.mutateAsync({ mangadexId, language: 'en' });
    applyMangaDexVolumeData(result, setVolumesData, setSelectedSourcesMetadata, setVolumeDisplaySource, setChapterDisplaySource);
  } catch (error) {
    logger.warn('[handleVolumeUrlParse] MangaDex volume fetch failed', { error: error instanceof Error ? error.message : String(error) });
    notify({ severity: 'ERROR', title: 'MangaDex Fetch Failed', message: 'Could not fetch volume data from MangaDex' });
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

interface UseUrlHandlersParams {
  services: WizardStepContentProps['services'];
  mutations: MutationResults;
  url: string;
  metadataUrl: string;
  manualVolumeUrl: string;
  formDataTitle: string;
  updateFormData: (data: Partial<WizardFormData>) => void;
  setMediaGallery: (gallery: MediaGallery) => void;
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void;
  setSelectedSources: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void;
  setIsValidatingUrl: (loading: boolean) => void;
  setIsValidatingMetadataUrl: (loading: boolean) => void;
  setIsParsingVolumeUrl: (loading: boolean) => void;
  provider: string;
  volumesData: VolumesData;
  selectedSources: string[];
  setVolumeDisplaySource?: (source: string) => void;
  setChapterDisplaySource?: (source: string) => void;
  // Static analysis state (optional - for pre-parsing URL analysis)
  analysisResult?: StaticAnalysisResponse | null;
  setAnalysisResult?: (result: StaticAnalysisResponse | null) => void;
  // Wikipedia static analysis state (optional)
  wikipediaAnalysisResult?: WikipediaAnalysisResponse | null;
  setWikipediaAnalysisResult?: (result: WikipediaAnalysisResponse | null) => void;
}

interface UseUrlHandlersReturn {
  handleUrlParse: () => Promise<void>;
  handleMetadataUrlParse: () => Promise<void>;
  handleVolumeUrlParse: (urlOverride?: string) => Promise<void>;
  /** Debounced URL analysis - triggers static analysis after 500ms of no input */
  debouncedAnalyzeUrl: (urlToAnalyze: string) => void;
  /** Whether static analysis is in progress */
  isAnalyzing: boolean;
}

// ============================================================================
// Custom Hook
// ============================================================================

/**
 * Hook that provides URL parsing handlers for the Universal Import Wizard
 *
 * Handles three types of URL parsing:
 * 1. Basic URL parsing - Extracts metadata from a provider URL
 * 2. Metadata URL parsing - Parses metadata-specific URLs
 * 3. Volume URL parsing - Detailed volume/chapter extraction from Fandom/ComicVine
 *
 * @param params - Hook parameters including services, mutations, and state setters
 * @returns Object containing the three URL parsing handler functions
 */
export function useUrlHandlers(params: UseUrlHandlersParams): UseUrlHandlersReturn {
  const {
    services,
    mutations,
    url,
    metadataUrl,
    manualVolumeUrl,
    formDataTitle,
    updateFormData,
    setMediaGallery,
    setVolumesData,
    setSelectedSources,
    setSelectedSourcesMetadata,
    setIsValidatingUrl,
    setIsValidatingMetadataUrl,
    setIsParsingVolumeUrl,
    provider,
    volumesData,
    setVolumeDisplaySource,
    setChapterDisplaySource,
    analysisResult,
    setAnalysisResult,
    wikipediaAnalysisResult,
    setWikipediaAnalysisResult,
  } = params;

  // Track analysis state (both Fandom and Wikipedia)
  const isAnalyzing =
    mutations.analyzeUrlMutation.isPending ||
    mutations.analyzeWikipediaUrlMutation.isPending;

  /**
   * Debounced URL analysis - triggers static analysis for Fandom and Wikipedia URLs
   * after 500ms of no input changes. Analysis results are cached and
   * used to provide parsing hints to the respective parsers.
   */
  const debouncedAnalyzeUrl = useDebouncedCallback(async (urlToAnalyze: string) => {
    const urlProvider = detectProviderFromUrl(urlToAnalyze);

    // Skip if URL is empty or too short
    if (!urlToAnalyze || urlToAnalyze.length < 20) {
      setAnalysisResult?.(null);
      setWikipediaAnalysisResult?.(null);
      return;
    }

    // Handle Fandom URLs
    if (urlProvider === 'fandom') {
      setWikipediaAnalysisResult?.(null);
      try {
        logger.debug('[debouncedAnalyzeUrl] Starting Fandom static analysis', { url: urlToAnalyze });
        const result = await mutations.analyzeUrlMutation.mutateAsync({ url: urlToAnalyze });
        setAnalysisResult?.(result);
        logger.info('[debouncedAnalyzeUrl] Fandom analysis complete', {
          url: urlToAnalyze,
          recommendedParser: result.recommendedParser.primary,
          confidence: result.recommendedParser.confidence,
        });
      } catch (error) {
        logger.warn('[debouncedAnalyzeUrl] Fandom analysis failed', {
          url: urlToAnalyze,
          error: error instanceof Error ? error.message : String(error),
        });
        setAnalysisResult?.(null);
      }
      return;
    }

    // Handle Wikipedia URLs
    if (urlProvider === 'wikipedia') {
      setAnalysisResult?.(null);
      try {
        logger.debug('[debouncedAnalyzeUrl] Starting Wikipedia static analysis', { url: urlToAnalyze });
        const result = await mutations.analyzeWikipediaUrlMutation.mutateAsync({ url: urlToAnalyze });
        setWikipediaAnalysisResult?.(result);
        logger.info('[debouncedAnalyzeUrl] Wikipedia analysis complete', {
          url: urlToAnalyze,
          pageType: result.pageType,
          recommendedParser: result.recommendedParser,
          confidence: result.confidence,
          linksToListPage: result.summary.linksToListPage,
          listPageUrl: result.parsingHints.listPageUrl,
        });
      } catch (error) {
        logger.warn('[debouncedAnalyzeUrl] Wikipedia analysis failed', {
          url: urlToAnalyze,
          error: error instanceof Error ? error.message : String(error),
        });
        setWikipediaAnalysisResult?.(null);
      }
      return;
    }

    // Clear both for unsupported providers
    setAnalysisResult?.(null);
    setWikipediaAnalysisResult?.(null);
  }, 500);

  /**
   * Parses a basic provider URL to extract metadata
   */
  const handleUrlParse = useCallback(async (): Promise<void> => {
    await services.urlParsingService.parseUrl(url, provider, {
      onSuccess: (data: unknown) => {
        const dataObj = data as Record<string, unknown>;
        const title = (dataObj["title"] as string) || formDataTitle;
        if (title) {
          updateFormData({ title });
        }
      },
      onError: (error) => {
        logger.error('URL parse error:', error);
      },
      setLoading: setIsValidatingUrl,
      setSelectedMetadata: (metadata: unknown) => updateFormData(metadata as Partial<WizardFormData>),
      setMediaGallery: (gallery: unknown) => setMediaGallery(gallery as MediaGallery),
      setVolumesData: (data: unknown) => setVolumesData(data as VolumesData)
    });
  }, [
    url,
    provider,
    formDataTitle,
    services.urlParsingService,
    updateFormData,
    setMediaGallery,
    setVolumesData,
    setIsValidatingUrl
  ]);

  /**
   * Parses a metadata-specific URL
   */
  const handleMetadataUrlParse = useCallback(async (): Promise<void> => {
    await services.urlParsingService.parseMetadataUrl(metadataUrl, {
      setSelectedMetadata: (metadata: unknown) => updateFormData(metadata as Partial<WizardFormData>),
      setLoading: setIsValidatingMetadataUrl
    });
  }, [metadataUrl, services.urlParsingService, updateFormData, setIsValidatingMetadataUrl]);

  /**
   * Parses a volume URL for detailed chapter/volume extraction
   * Supports Fandom, ComicVine, and Wikipedia URLs
   *
   * @param urlOverride - Optional URL to parse (overrides manualVolumeUrl)
   */
  const handleVolumeUrlParse = useCallback(async (urlOverride?: string): Promise<void> => {
    setIsParsingVolumeUrl(true);
    const urlToParse = urlOverride ?? manualVolumeUrl;

    // DEBUG: Log the URL being parsed
    logger.debug('[handleVolumeUrlParse] Parsing URL', {
      urlOverride,
      manualVolumeUrl,
      urlToParse,
      urlToParseLength: urlToParse.length,
    });

    try {
      // Detect provider from URL
      const urlProvider = detectProviderFromUrl(urlToParse);

      // DEBUG: Log detected provider
      logger.debug('[handleVolumeUrlParse] Detected provider', { urlProvider, url: urlToParse });

      if (urlProvider === 'fandom') {
        // Add fandom to selectedSources if not already there (use functional update to avoid race conditions)
        setSelectedSources((prev) => {
          if (prev.includes('fandom')) {
            logger.info('[handleVolumeUrlParse] fandom already in selectedSources');
            return prev;
          }
          logger.info('[handleVolumeUrlParse] Added fandom to selectedSources');
          return [...prev, 'fandom'];
        });
        await parseFandomUrl({
          urlToParse,
          mutations,
          setVolumesData,
          setSelectedSourcesMetadata,
          volumesData,
          setMediaGallery,
          // Pass analysis hints if available (from debounced pre-analysis)
          ...(analysisResult?.parsingHints ? { parsingHints: analysisResult.parsingHints } : {}),
          ...(analysisResult?.recommendedParser ? { recommendedParser: analysisResult.recommendedParser.primary } : {}),
        });
        // Auto-switch to fandom as display source to show chapter covers
        if (setVolumeDisplaySource) {
          setVolumeDisplaySource('fandom');
          logger.info('[handleVolumeUrlParse] Switched volumeDisplaySource to fandom');
        }
        if (setChapterDisplaySource) {
          setChapterDisplaySource('fandom');
          logger.info('[handleVolumeUrlParse] Switched chapterDisplaySource to fandom');
        }
      } else if (urlProvider === 'comicvine') {
        // Add comicvine to selectedSources if not already there (use functional update to avoid race conditions)
        setSelectedSources((prev) => {
          const hasComicVine = prev.some(s => s.toLowerCase() === 'comicvine');
          if (hasComicVine) {
            logger.info('[handleVolumeUrlParse] comicvine already in selectedSources');
            return prev;
          }
          logger.info('[handleVolumeUrlParse] Added comicvine to selectedSources');
          return [...prev, 'comicvine'];
        });
        await parseComicVineUrl(
          urlToParse,
          mutations,
          setVolumesData,
          setSelectedSourcesMetadata
        );
      } else if (urlProvider === 'mangadex') {
        await parseMangaDexUrl({
          urlToParse, mutations, setSelectedSources, setVolumesData,
          setSelectedSourcesMetadata, setVolumeDisplaySource, setChapterDisplaySource,
        });
      } else if (urlProvider === 'wikipedia') {
        // Add wikipedia to selectedSources if not already there (use functional update to avoid race conditions)
        setSelectedSources((prev) => {
          if (prev.includes('wikipedia')) {
            logger.info('[handleVolumeUrlParse] wikipedia already in selectedSources');
            return prev;
          }
          logger.info('[handleVolumeUrlParse] Added wikipedia to selectedSources');
          return [...prev, 'wikipedia'];
        });
        // Pass Wikipedia analysis hints if available
        const hintsToPass = wikipediaAnalysisResult?.parsingHints;
        if (hintsToPass) {
          logger.info('[handleVolumeUrlParse] Passing Wikipedia hints to parser', {
            recommendedParser: hintsToPass.recommendedParser,
            pageType: hintsToPass.pageType,
            hasListPageUrl: !!hintsToPass.listPageUrl,
          });
        }
        await parseWikipediaUrl(
          urlToParse,
          setVolumesData,
          setSelectedSourcesMetadata,
          hintsToPass
        );
      } else {
        // DEBUG: Log the unsupported URL
        logger.debug('[handleVolumeUrlParse] Unsupported URL detected', {
          urlToParse,
          urlProvider,
          includesFandom: urlToParse.includes('fandom.com'),
          includesComicvine: urlToParse.includes('comicvine.gamespot.com'),
          includesWikipedia: urlToParse.includes('wikipedia.org'),
        });
        notify({ severity: 'WARNING', title: 'Unsupported URL', message: 'Volume parsing supports Fandom, ComicVine, Wikipedia, and MangaDex URLs' });
      }
    } catch (error) {
      logger.error('[handleVolumeUrlParse] Parse error', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      notify({ severity: 'ERROR', title: 'Parse Failed', message: 'Could not extract volume data from URL' });
    } finally {
      setIsParsingVolumeUrl(false);
    }
  }, [
    analysisResult,
    wikipediaAnalysisResult,
    manualVolumeUrl,
    mutations,
    setVolumesData,
    setSelectedSources,
    setSelectedSourcesMetadata,
    setIsParsingVolumeUrl,
    volumesData,
    setMediaGallery,
    setVolumeDisplaySource,
    setChapterDisplaySource
  ]);

  return {
    handleUrlParse,
    handleMetadataUrlParse,
    handleVolumeUrlParse,
    debouncedAnalyzeUrl,
    isAnalyzing,
  };
}
