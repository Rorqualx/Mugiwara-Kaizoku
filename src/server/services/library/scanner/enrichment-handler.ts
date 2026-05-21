/**
 * Enrichment Handler Module
 *
 * Handles metadata enrichment for scanned manga entries via
 * `MetadataEnrichmentService.oneClickEnrich` (ts-mangadex:
 * MangaDex + AniList + ComicVine in parallel). When it returns `no_matches`
 * or `error`, the caller surfaces that state — users trigger explicit
 * re-enrichment via the wizard (which runs the full pipeline) if they
 * want a deeper pass.
 *
 * @module scanner/enrichment-handler
 */

import { toNumberId } from '@/utils/id-converters';
import { serverLogger } from '@/utils/serverLogger';

import type { MetadataEnrichmentService } from '../metadataEnrichmentService';
import type { EnrichmentResult } from '../metadataEnrichmentService/types';

interface MangaInput {
  id: number;
  title: string;
}

/**
 * Enrich manga with metadata from providers.
 * Logs warnings but doesn't fail on enrichment errors.
 */
export async function enrichMangaMetadata(
  manga: Record<string, unknown>,
  enrichmentService: MetadataEnrichmentService,
): Promise<EnrichmentResult | null> {
  try {
    const mangaId = typeof manga['id'] === 'number' ? manga['id'] : 0;
    const mangaTitle = typeof manga['title'] === 'string' ? manga['title'] : '';
    const mangaInput: MangaInput = { id: mangaId, title: mangaTitle };

    return await enrichmentService.oneClickEnrich(mangaInput);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const mangaId = typeof manga['id'] === 'number' ? manga['id'] : 0;
    serverLogger.warn('Failed to auto-enrich manga', {
      mangaId: toNumberId(mangaId),
      error: errorMessage,
    });
    return null;
  }
}
