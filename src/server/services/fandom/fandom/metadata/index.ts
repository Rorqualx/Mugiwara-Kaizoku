/**
 * Fandom Page Metadata Extraction
 *
 * Main aggregator that coordinates all metadata extraction modules.
 * This orchestrator delegates to focused parsers for each metadata type.
 *
 * Original: 979 lines (getPageMetadata in FandomService.ts)
 * Refactored: ~150 lines orchestrator + 4 focused modules
 */

import type { MediaWikiAPI } from '@/server/services/fandom/MediaWikiAPI';
import type { FandomPageMetadata, MediaWikiPage, WikiConfig } from '@/server/services/fandom/types';
import { logger } from '@/utils/logger';

// Import focused parsers
import { extractGallery } from './gallery-parser';
import { parseInfoboxMetadata } from './infobox-parser';

const log = logger.child('FandomMetadata');

/**
 * Get complete page metadata including volumes, chapters, and description
 */
export async function getPageMetadata(
  title: string,
  mediaWikiAPI: MediaWikiAPI,
  wikiConfig: WikiConfig
): Promise<FandomPageMetadata | null> {
  try {
    // Get the full page details
    const page = await mediaWikiAPI.getPageByTitle(title);
    if (!page) {
      log.warn('No page found for title:', title);
      return null;
    }

    log.info('Fetching metadata for page:', title);
    log.info('Page structure:', {
      hasPageprops: !!page.pageprops,
      pagepropsKeys: page.pageprops ? Object.keys(page.pageprops) : [],
      hasInfoboxes: !!page.pageprops?.infoboxes,
      hasRevisions: !!page.revisions,
      hasContent: !!page.revisions?.[0]?.slots?.main?.['*']
    });

    // Initialize with format
    const metadata: Record<string, unknown> = {
      format: 'MANGA' // Always set format for manga wikis
    };

    // Phase 1: Parse infobox from pageprops or wikitext
    const infoboxData = parseInfoboxMetadata(
      page,
      (json: string) => mediaWikiAPI.parseInfobox(json) as Record<string, unknown>[] | null,
      (infobox: Record<string, unknown>) => mediaWikiAPI.extractInfoboxData(
        infobox as unknown as Parameters<typeof mediaWikiAPI.extractInfoboxData>[0]
      ),
      wikiConfig.subdomain,
      title
    );

    // Merge infobox data into metadata (infobox values take priority for initial population)
    for (const [key, value] of Object.entries(infoboxData)) {
      if (value !== undefined && value !== null) {
        metadata[key] = value;
      }
    }

    // Phase 2: Parse wikitext content for additional metadata
    // TODO: Replace with parseWikitextContent when module is created
    if (page.revisions?.[0]?.slots?.main?.['*']) {
      const wikitext = page.revisions[0].slots.main['*'];
      await parseWikitextPhase(wikitext, mediaWikiAPI, title, metadata);
    }

    // Phase 3: Scrape volumes list for accurate count
    // TODO: Replace with scrapeVolumesList when module is created
    await scrapeVolumesListPhase(title, mediaWikiAPI, wikiConfig, metadata);

    // Phase 4: Extract gallery images + genres + defaults
    const pageAssets = await extractPageAssets(
      page, wikiConfig, title,
      metadata['coverImage'] as string | undefined,
      !!metadata['description'],
    );
    Object.assign(metadata, pageAssets);

    // Log final metadata
    logFinalMetadata(title, metadata);

    return metadata as FandomPageMetadata;
  } catch (error: unknown) {
    log.debug('Failed to get page metadata', {
      title,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/** Extract gallery images, genres, and description defaults */
async function extractPageAssets(
  page: MediaWikiPage,
  wikiConfig: WikiConfig,
  title: string,
  existingCover: string | undefined,
  hasDescription: boolean,
): Promise<Record<string, unknown>> {
  const assets: Record<string, unknown> = {};
  const { gallery, coverImage } = await extractGallery(page, wikiConfig, title, existingCover);

  if (gallery.length > 0) assets['gallery'] = gallery;
  if (coverImage) assets['coverImage'] = coverImage;
  if (page.categories) assets['genres'] = extractGenresFromCategories(page.categories);
  if (!hasDescription) assets['description'] = 'No description available';
  return assets;
}

/** Log the final collected metadata for debugging */
function logFinalMetadata(title: string, metadata: Record<string, unknown>): void {
  log.info('Final Fandom metadata collected:', {
    title,
    hasPublisher: !!metadata['publisher'],
    publisher: metadata['publisher'],
    hasAlternativeTitles:
      !!metadata['alternativeTitles'] &&
      (metadata['alternativeTitles'] as string[]).length > 0,
    alternativeTitles: metadata['alternativeTitles'],
    volumes: metadata['volumes'],
    chapters: metadata['chapters'],
    author: metadata['author'],
    artist: metadata['artist'],
    status: metadata['status'],
    format: metadata['format'],
    volumesListUrl: metadata['volumesListUrl']
  });
}

/**
 * Extract genres from page categories
 */
function extractGenresFromCategories(
  categories: Array<{ ns: number; title: string }>
): string[] {
  return categories
    .map((cat) => cat.title.replace('Category:', ''))
    .filter(
      (cat) =>
        cat.toLowerCase().includes('manga') ||
        cat.toLowerCase().includes('genre') ||
        [
          'Action',
          'Comedy',
          'Drama',
          'Fantasy',
          'Horror',
          'Mystery',
          'Romance',
          'Sci-Fi',
          'Slice of Life',
          'Sports',
          'Supernatural',
          'Thriller'
        ].some((genre) => cat.includes(genre))
    );
}

// Placeholder functions for remaining phases - to be replaced with module imports

function parseWikitextPhase(
  _wikitext: string,
  _mediaWikiAPI: MediaWikiAPI,
  _title: string,
  _metadata: Record<string, unknown>
): Promise<void> {
  // TODO: This will be replaced by importing parseWikitextContent from './content-parser'
  // For now, do nothing - the original logic remains in FandomService
  return Promise.resolve();
}

function scrapeVolumesListPhase(
  _title: string,
  _mediaWikiAPI: MediaWikiAPI,
  _wikiConfig: WikiConfig,
  _metadata: Record<string, unknown>
): Promise<void> {
  // TODO: This will be replaced by importing scrapeVolumesList from './volumes-parser'
  // For now, do nothing - the original logic remains in FandomService
  return Promise.resolve();
}

// Re-export gallery parser for direct access
export { extractGallery } from './gallery-parser';
export type { GalleryResult } from './gallery-parser';
