import { isSuccess, isError, type AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';

import { extractMediaFromResult } from './url-parsing/media-extractors';
import { extractMetadataFromResult } from './url-parsing/metadata-extractors';
import { ProviderParsers } from './url-parsing/provider-parsers';
import { type UrlParsingServiceConfig } from './url-parsing/utils';
import { extractVolumesFromResult } from './url-parsing/volumes-extractors';

/**
 * Service for handling URL parsing and metadata extraction
 *
 * Refactored to use modular extractors for improved maintainability.
 * Original: 579 lines → Refactored: ~200 lines
 *
 * Architecture:
 * - utils.ts: Type guards and configuration interfaces
 * - provider-parsers.ts: Provider-specific URL parsing logic
 * - metadata-extractors.ts: Metadata extraction from API responses
 * - media-extractors.ts: Media (covers, banners, gallery) extraction
 * - volumes-extractors.ts: Volume and chapter data extraction
 *
 * @see {@link ./url-parsing/README.md} for module documentation
 */
export class UrlParsingService {
  private mutations: UrlParsingServiceConfig;
  private providerParsers: ProviderParsers;

  constructor(mutations: UrlParsingServiceConfig) {
    this.mutations = mutations;
    this.providerParsers = new ProviderParsers(mutations);
  }

  /**
   * Parse a URL and extract metadata based on the provider
   *
   * Orchestrates the entire URL parsing workflow:
   * 1. Detects provider from URL
   * 2. Calls appropriate provider parser
   * 3. Extracts metadata, media, and volumes using specialized extractors
   * 4. Updates UI state through callbacks
   *
   * @param url - The URL to parse
   * @param provider - Explicit provider (if known), otherwise auto-detected
   * @param callbacks - UI state update callbacks
   */
  async parseUrl(
    url: string,
    provider: string,
    callbacks: {
      onSuccess: (data: unknown) => void;
      onError: (error: string) => void;
      setLoading: (loading: boolean) => void;
      setSelectedMetadata: (metadata: unknown) => void;
      setMediaGallery: (gallery: unknown) => void;
      setVolumesData: (data: unknown) => void;
    }
  ): Promise<void> {
    const { onSuccess, onError, setLoading, setSelectedMetadata, setMediaGallery, setVolumesData } = callbacks;

    if (!url) {
      notify({ severity: 'ERROR', title: 'No URL', message: 'Please enter a URL to parse' });
      return;
    }

    setLoading(true);

    try {
      // Detect provider from URL
      const detectedProvider = this.providerParsers.detectProviderFromUrl(url);
      logger.info('Detected provider from URL:', detectedProvider);

      let result: AsyncResult<unknown>;

      // Use provider parsers
      switch (detectedProvider) {
        case 'fandom':
          result = await this.providerParsers.parseFandomUrl(url) as AsyncResult<unknown>;
          break;

        case 'anilist':
          result = await this.providerParsers.parseAnilistUrl(url) as AsyncResult<unknown>;
          break;

        case 'comicvine':
          result = await this.providerParsers.parseComicvineUrl(url) as AsyncResult<unknown>;
          break;

        case 'wikipedia':
          result = await this.providerParsers.parseWikipediaUrl(url) as AsyncResult<unknown>;
          break;

        default:
          // Try generic parsing for unknown providers
          result = await (this.mutations.parseUrlMutation as { mutateAsync: (input: { url: string }) => Promise<AsyncResult<unknown>> }).mutateAsync({ url });
      }

      if (isSuccess(result)) {
        const data = result.data;

        // Use extracted modules for processing
        const metadata = extractMetadataFromResult(data, detectedProvider);
        setSelectedMetadata(metadata);

        const media = extractMediaFromResult(data, detectedProvider);
        setMediaGallery(media);

        const volumes = extractVolumesFromResult(data, detectedProvider);
        setVolumesData(volumes);

        notify({ severity: 'SUCCESS', title: 'URL Parsed Successfully', message: `Extracted metadata from ${detectedProvider}` });

        onSuccess(data);
      } else if (isError(result)) {
        throw new Error((result.error as Error).message || 'Failed to fetch metadata');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to parse URL:', errorMessage);

      notify({ severity: 'ERROR', title: 'Failed to parse URL', message: errorMessage });

      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Parse metadata URL (for additional metadata extraction)
   *
   * Simplified wrapper around parseUrl() for metadata-only extraction.
   * Does not update media gallery or volumes data.
   *
   * @param url - The URL to parse
   * @param callbacks - UI state update callbacks (metadata and loading only)
   */
  async parseMetadataUrl(
    url: string,
    callbacks: {
      setSelectedMetadata: (metadata: unknown) => void;
      setLoading: (loading: boolean) => void;
    }
  ): Promise<void> {
    const { setSelectedMetadata, setLoading } = callbacks;

    if (!url) {
      notify({ severity: 'ERROR', title: 'No URL', message: 'Please enter a URL to extract metadata' });
      return;
    }

    setLoading(true);

    try {
      const _result = await this.parseUrl(url, '', {
        onSuccess: (data) => {
          logger.info('Metadata extracted successfully:', data);
        },
        onError: (error) => {
          logger.error('Metadata extraction failed:', error);
        },
        setLoading,
        setSelectedMetadata,
        setMediaGallery: () => {}, // Not needed for metadata-only parsing
        setVolumesData: () => {} // Not needed for metadata-only parsing
      });
    } finally {
      setLoading(false);
    }
  }
}

export default UrlParsingService;
